"""
ConcursoTrack — Scraper de Editais v5
=======================================
Fase 1: Raspa a listagem /concursos/ (rapido, sem delay)
Fase 2: Para concursos novos ou sem descricao, entra no artigo
        do PCI e extrai texto completo, links de PDF e cargos.

Dependencias:
    pip install httpx beautifulsoup4 supabase python-dotenv
"""

import os
import re
import time
import json
import hashlib
import logging
from datetime import datetime, date, timezone
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ConcursoTrackBot/1.0; +https://concursotrack.com.br/bot)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

URL_LISTAGEM = "https://www.pciconcursos.com.br/concursos/"
BASE_PCI     = "https://www.pciconcursos.com.br"
DELAY_ARTIGO = 1.5
MAX_ARTIGOS  = 80

UFS = {"AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
       "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"}

ESFERA_KEYWORDS = {
    "federal":   ["federal","ministerio","ibge","inss","receita federal","dataprev",
                  "anatel","banco do brasil","caixa economica","petrobras","exercito",
                  "marinha","aeronautica","ime ","ita ","eear","denatran","dnit","anvisa"],
    "estadual":  ["estadual","governo do estado","secretaria de estado","assembleia",
                  "tribunal de justica","pmes","cbm","pm -","pc -","tce-","tce "],
    "municipal": ["prefeitura","camara municipal","camara de","saae","samae","guarda municipal"],
}

AREA_KEYWORDS = {
    "fiscal_tributaria":  ["fiscal","tributario","receita","fazenda","auditor","dataprev","sefaz"],
    "seguranca_publica":  ["policial","delegado","perito","agente penitenciario",
                           "guarda municipal","soldado","bombeiro","pm -","pmes","cbm","eear"],
    "saude":              ["medico","enfermeiro","farmaceutico","nutricionista",
                           "psicologo","fisioterapeuta","saude","sesau","sarah"],
    "educacao":           ["professor","pedagogo","docente","educacao","seduc","magisterio"],
    "tecnologia":         ["analista de ti","tecnico de ti","desenvolvedor","tecnologia da informacao"],
    "engenharia":         ["engenheiro","arquiteto","ime ","ita "],
    "juridica":           ["advogado","procurador","defensor","promotor","juiz"],
}


def extrair_uf(title):
    m = re.search(r"-\s*([A-Z]{2})\s*[:]\s*", title)
    if m and m.group(1) in UFS:
        return m.group(1)
    return None

def extrair_vagas(texto):
    m = re.search(r"([\d][.\d]*)\s*vaga", texto, re.IGNORECASE)
    if m:
        try: return int(m.group(1).replace(".", ""))
        except: pass
    return 0

def extrair_data(texto):
    matches = re.findall(r"(\d{1,2})/(\d{2})/(\d{4})", texto)
    datas = []
    for d, m, a in matches:
        try: datas.append(date(int(a), int(m), int(d)))
        except: pass
    return max(datas) if datas else None

def detectar_esfera(orgao, titulo):
    txt = (orgao + " " + titulo).lower()
    for esfera, palavras in ESFERA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return esfera
    return "municipal" if "prefeitura" in txt else "nao_identificada"

def detectar_area(orgao, titulo):
    txt = (orgao + " " + titulo).lower()
    for area, palavras in AREA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"

def fazer_slug(orgao, fonte_url):
    base = re.sub(r"[^a-z0-9]+", "-", orgao.lower()).strip("-")[:60]
    return f"{base}-{hashlib.md5(fonte_url.encode()).hexdigest()[:6]}"


def raspar_listagem(http):
    log.info(f"[Fase 1] {URL_LISTAGEM}")
    try:
        r = http.get(URL_LISTAGEM, timeout=20)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.error(f"Erro: {e}"); return []

    soup = BeautifulSoup(r.text, "html.parser")
    concursos, vistos = [], set()

    for a in soup.select("a[href*='/noticias/']"):
        href  = a.get("href", "")
        title = a.get("title", "")
        orgao = a.get_text(strip=True)
        if not title or len(orgao) < 5: continue
        if orgao.lower() in ("noticias","notícias","nacional","sudeste","sul","norte","nordeste","centro-oeste"): continue
        if href in vistos: continue
        vistos.add(href)
        pai = a.find_parent()
        texto_pai = pai.get_text(" ", strip=True) if pai else ""
        concursos.append({
            "orgao":             orgao[:150],
            "titulo":            title[:200],
            "fonte_url":         href,
            "estado":            extrair_uf(title),
            "total_vagas":       extrair_vagas(texto_pai),
            "data_encerramento": extrair_data(texto_pai),
            "esfera":            detectar_esfera(orgao, title),
            "area_conhecimento": detectar_area(orgao, title),
            "status":            "aberto",
        })

    log.info(f"[Fase 1] {len(concursos)} concursos")
    return concursos


def raspar_artigo(http, url):
    """
    Extrai conteudo do artigo do PCI usando meta tags (og:description, description)
    que ja vem limpo pelo PCI para fins de SEO — sem os widgets de apostila
    e listas laterais que contaminam o HTML.
    Para links de PDF, usa o og:description complementado pelos links da pagina
    filtrando apenas os que estao em blocos de "Links" identificaveis.
    """
    resultado = {"descricao": None, "links_pdf": None}
    try:
        r = http.get(url, timeout=15)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning(f"Erro artigo {url}: {e}"); return resultado

    soup = BeautifulSoup(r.text, "html.parser")

    # ----- Descricao: usa meta tags que o PCI ja limpa para SEO -----
    descricao = None

    # 1. og:description — geralmente o texto mais completo e limpo
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        descricao = og_desc["content"].strip()

    # 2. Fallback: meta name="description"
    if not descricao or len(descricao) < 50:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            descricao = meta_desc["content"].strip()

    # 3. Fallback: busca paragrafos dentro do bloco de conteudo principal
    # identificado por ser o maior bloco de texto continuo da pagina
    if not descricao or len(descricao) < 50:
        candidatos = []
        for div in soup.find_all(["div", "article", "section"]):
            ps = div.find_all("p", recursive=False)
            if len(ps) >= 3:
                texto = " ".join(p.get_text(strip=True) for p in ps)
                if len(texto) > 200:
                    candidatos.append((len(texto), texto))
        if candidatos:
            descricao = max(candidatos, key=lambda x: x[0])[1][:8000]

    if descricao and len(descricao) > 50:
        resultado["descricao"] = descricao[:8000]

    # ----- Links de PDF: busca apenas dentro do bloco "Links" do PCI -----
    # O PCI tem um bloco especifico com id ou classe para os PDFs do concurso
    links_pdf = []

    # Tenta encontrar o container de links do concurso (costuma ter "Links" como heading)
    bloco_links = None
    for heading in soup.find_all(["h2", "h3", "h4", "strong", "b"]):
        if heading.get_text(strip=True).lower() in ("links", "documentos", "editais", "arquivos"):
            bloco_links = heading.find_parent()
            break

    # Se encontrou o bloco, extrai apenas os links de dentro dele
    if bloco_links:
        for a in bloco_links.find_all("a", href=True):
            href  = a.get("href", "")
            texto = a.get_text(strip=True)
            if not href or len(texto) < 3: continue
            # So aceita .pdf ou links externos que nao sejam /noticias/
            eh_pdf = ".pdf" in href.lower()
            eh_externo = href.startswith("http") and "pciconcursos.com.br" not in href
            if (eh_pdf or eh_externo) and not "/noticias/" in href:
                url_final = href if href.startswith("http") else BASE_PCI + href
                if not any(l["url"] == url_final for l in links_pdf):
                    links_pdf.append({"titulo": texto[:200], "url": url_final})
    else:
        # Fallback: varre a pagina inteira mas so aceita .pdf
        for a in soup.select("a[href]"):
            href  = a.get("href", "")
            texto = a.get_text(strip=True)
            if ".pdf" in href.lower() and len(texto) > 3:
                url_final = href if href.startswith("http") else BASE_PCI + href
                if not any(l["url"] == url_final for l in links_pdf):
                    links_pdf.append({"titulo": texto[:200], "url": url_final})

    if links_pdf:
        resultado["links_pdf"] = links_pdf[:20]

    # Links de PDF — apenas arquivos .pdf ou links externos (fora do PCI)
    # Exclui links para /noticias/ (outros artigos do PCI) que contaminam a lista
    links_pdf = []
    for a in soup.select("a[href]"):
        href  = a.get("href", "")
        texto = a.get_text(strip=True)

        if not href or len(texto) < 3:
            continue

        # Ignora links internos do PCI que não sejam PDFs
        eh_interno_pci = (
            href.startswith("/noticias/") or
            href.startswith("/concursos/") or
            "pciconcursos.com.br/noticias" in href or
            "pciconcursos.com.br/concursos" in href
        )
        if eh_interno_pci:
            continue

        # Aceita apenas se: for .pdf OU for link externo (outro domínio)
        eh_pdf_real    = ".pdf" in href.lower()
        eh_externo     = href.startswith("http") and "pciconcursos.com.br" not in href
        # Links do próprio PCI sem /noticias/ (ex: /downloads/) também valem
        eh_pci_recurso = (href.startswith("/") and
                          not href.startswith("/noticias/") and
                          not href.startswith("/concursos/"))

        if not (eh_pdf_real or eh_externo or eh_pci_recurso):
            continue

        # Para links externos sem .pdf, exige palavra indicativa no texto
        if eh_externo and not eh_pdf_real:
            palavras_doc = ["edital", "retific", "gabarito", "resultado",
                            "homolog", "inscri", "concurso", "fundatec",
                            "vunesp", "cebraspe", "cespe", "fgv", "ibfc"]
            if not any(p in texto.lower() for p in palavras_doc):
                continue

        url_final = href if href.startswith("http") else BASE_PCI + href
        if not any(l["url"] == url_final for l in links_pdf):
            links_pdf.append({"titulo": texto[:200], "url": url_final})

    if links_pdf:
        resultado["links_pdf"] = links_pdf[:20]

    return resultado


class SupabaseWriter:
    def __init__(self, db):
        self.db = db

    def salvar(self, c):
        slug = fazer_slug(c["orgao"], c["fonte_url"])
        try:
            payload = {
                "slug":              slug,
                "titulo":            c["titulo"],
                "orgao":             c["orgao"],
                "esfera":            c["esfera"],
                "estado":            c["estado"],
                "area_conhecimento": c["area_conhecimento"],
                "status":            c["status"],
                "total_vagas":       c["total_vagas"],
                "data_encerramento": c["data_encerramento"].isoformat() if c["data_encerramento"] else None,
                "edital_url":        c["fonte_url"],
                "fonte_url":         c["fonte_url"],
                "scraped_em":        datetime.now(timezone.utc).isoformat(),
            }
            res = self.db.table("concursos").upsert(payload, on_conflict="slug").execute()
            return res.data[0]["id"] if res.data else None
        except Exception as e:
            log.error(f"Erro ao salvar '{c['orgao']}': {e}"); return None

    def precisa_enriquecer(self, slug):
        try:
            res = self.db.table("concursos").select("descricao").eq("slug", slug).limit(1).execute()
            if not res.data: return True
            return not res.data[0].get("descricao")
        except: return False

    def atualizar_enriquecimento(self, slug, dados):
        try:
            payload = {}
            if dados.get("descricao"): payload["descricao"] = dados["descricao"]
            if dados.get("links_pdf"): payload["links_pdf"] = json.dumps(dados["links_pdf"], ensure_ascii=False)
            if not payload: return False
            self.db.table("concursos").update(payload).eq("slug", slug).execute()
            return True
        except Exception as e:
            log.warning(f"Erro enriquecer '{slug}': {e}"); return False


def disparar_alertas(db, novos_ids):
    if not novos_ids: return 0
    alertas   = db.table("alertas").select("*").eq("ativo", True).execute().data or []
    concursos = db.table("concursos").select("*").in_("id", novos_ids).execute().data or []
    if not alertas: return 0
    fila, agora = [], datetime.now(timezone.utc).isoformat()
    for concurso in concursos:
        for alerta in alertas:
            if alerta.get("area_conhecimento") and alerta["area_conhecimento"] != concurso.get("area_conhecimento"): continue
            if alerta.get("estado") and alerta["estado"] != concurso.get("estado"): continue
            if alerta.get("esfera") and alerta["esfera"] != concurso.get("esfera"): continue
            fila.append({"user_id": alerta["user_id"], "concurso_id": concurso["id"],
                         "canal": alerta.get("canal", "email"), "enviado": False, "criado_em": agora})
    if fila:
        try: db.table("notificacoes_fila").insert(fila).execute()
        except Exception as e: log.error(f"Erro fila: {e}")
    log.info(f"Alertas: {len(fila)}")
    return len(fila)


def main():
    log.info("=== ConcursoTrack Scraper v5 ===")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    writer   = SupabaseWriter(supabase)

    with httpx.Client(headers=HEADERS, follow_redirects=True) as http:
        concursos = raspar_listagem(http)
        salvos, novos_ids, para_enriquecer = 0, [], []

        for c in concursos:
            slug    = fazer_slug(c["orgao"], c["fonte_url"])
            res_ex  = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
            eh_novo = not bool(res_ex.data)
            cid     = writer.salvar(c)
            if cid:
                salvos += 1
                if eh_novo: novos_ids.append(cid)
            if writer.precisa_enriquecer(slug):
                para_enriquecer.append({"slug": slug, "fonte_url": c["fonte_url"]})

        log.info(f"[Fase 1] Salvos: {salvos}/{len(concursos)} | Novos: {len(novos_ids)} | Para enriquecer: {len(para_enriquecer)}")

        enriquecidos = 0
        total = min(len(para_enriquecer), MAX_ARTIGOS)
        log.info(f"[Fase 2] Enriquecendo {total} artigos...")
        for item in para_enriquecer[:MAX_ARTIGOS]:
            dados = raspar_artigo(http, item["fonte_url"])
            if dados["descricao"] or dados["links_pdf"]:
                if writer.atualizar_enriquecimento(item["slug"], dados):
                    enriquecidos += 1
                    log.info(f"  + {item['slug'][:55]}")
            time.sleep(DELAY_ARTIGO)

        log.info(f"[Fase 2] Enriquecidos: {enriquecidos}/{total}")

    disparar_alertas(supabase, novos_ids)
    log.info("=== Scraper v5 finalizado ===")


if __name__ == "__main__":
    main()

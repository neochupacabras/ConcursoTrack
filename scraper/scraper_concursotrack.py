"""
ConcursoTrack Scraper v5
Fase 1: listagem rapida em /concursos/
Fase 2: enriquece artigos com seletores certeiros baseados em diagnostico HTML
"""

import os, re, time, json, json, hashlib, logging
from datetime import datetime, date, timezone
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# Scrapers de bancas
try:
    from cebraspe import CebraspeScraper
    CEBRASPE_DISPONIVEL = True
except ImportError:
    CEBRASPE_DISPONIVEL = False

try:
    from fgv import FGVScraper
    FGV_DISPONIVEL = True
except ImportError:
    FGV_DISPONIVEL = False

try:
    from ibfc import IBFCScraper
    IBFC_DISPONIVEL = True
except ImportError:
    IBFC_DISPONIVEL = False

try:
    from fcc import FCCScraper
    FCC_DISPONIVEL = True
except ImportError:
    FCC_DISPONIVEL = False

try:
    from consulplan import ConsulplanScraper
    CONSULPLAN_DISPONIVEL = True
except ImportError:
    CONSULPLAN_DISPONIVEL = False

try:
    from quadrix import QuadrixScraper
    QUADRIX_DISPONIVEL = True
except ImportError:
    QUADRIX_DISPONIVEL = False

try:
    from avalia import AvaliaScraper
    AVALIA_DISPONIVEL = True
except ImportError:
    AVALIA_DISPONIVEL = False

try:
    from mesclar_duplicatas import gerar_relatorio
    MESCLAGEM_DISPONIVEL = True
except ImportError:
    MESCLAGEM_DISPONIVEL = False

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
HEADERS      = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
    m = re.search(r"-\s*([A-Z]{2})\s*[:]", title)
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


# ---------------------------------------------------------------------------
# Fase 1 — listagem /concursos/
# ---------------------------------------------------------------------------

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
        if orgao.lower() in ("noticias","notícias","nacional","sudeste","sul",
                             "norte","nordeste","centro-oeste"): continue
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


# ---------------------------------------------------------------------------
# Fase 2 — enriquecimento com seletores certeiros
# ---------------------------------------------------------------------------

def raspar_artigo(http, url):
    """
    Estrutura confirmada pelo diagnostico_pci.py:

    DESCRICAO:
      article#noticia > div (sem id/classe) com os <p> diretos do artigo
      Os <p> tem avô article#noticia — seletor: article#noticia > div > p
      Excluir: aside#preparacao, aside#podcast, asides sem id, div#lateral

    PDFs:
      aside#links li.pdf a — seletor exato, sem ambiguidade
      Os hrefs sao do dominio arq.pciconcursos.com.br
    """
    resultado = {"descricao": None, "links_pdf": None}
    try:
        r = http.get(url, timeout=15)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.warning(f"Erro {url}: {e}"); return resultado

    soup = BeautifulSoup(r.text, "html.parser")

    # ---- Descricao: article#noticia > div > p ----
    noticia = soup.select_one("article#noticia")
    if noticia:
        # Pega a div direta que contem os paragrafos do artigo
        # (e nao as divs de description/sharelink/breadcrumbs)
        div_conteudo = None
        for div in noticia.find_all("div", recursive=False):
            ps = div.find_all("p", recursive=False)
            if len(ps) >= 2:
                div_conteudo = div
                break

        if div_conteudo:
            paragrafos = []
            for p in div_conteudo.find_all("p", recursive=False):
                txt = p.get_text(" ", strip=True)
                if len(txt) < 20:
                    continue
                paragrafos.append(txt)

            if paragrafos:
                # O PCI termina todos os artigos com frases de propaganda
                # Truncamos no ultimo paragrafo real do concurso
                FRASES_FINAIS = [
                    "mais informações podem ser obtidas no edital completo",
                    "descubra como nossas apostilas digitais",
                    "transforme sua leitura em escuta",
                    "acompanhe mais detalhes no nosso podcast",
                ]
                paragrafos_limpos = []
                for p in paragrafos:
                    p_lower = p.lower()
                    if any(f in p_lower for f in FRASES_FINAIS):
                        # Inclui "Mais informações..." mas para ai
                        if "mais informações podem ser obtidas" in p_lower:
                            paragrafos_limpos.append(p)
                        break
                    paragrafos_limpos.append(p)

                if paragrafos_limpos:
                    resultado["descricao"] = "\n\n".join(paragrafos_limpos)[:8000]

    # Fallback: og:description se nao encontrou conteudo
    if not resultado["descricao"]:
        og = soup.find("meta", property="og:description")
        if og and og.get("content"):
            resultado["descricao"] = og["content"].strip()

    # ---- PDFs: aside#links li.pdf a ----
    links_pdf = []
    aside_links = soup.select_one("aside#links")
    if aside_links:
        for li in aside_links.select("li.pdf"):
            a = li.find("a", href=True)
            if not a:
                continue
            href  = a.get("href", "")
            texto = a.get_text(strip=True)
            if href and texto:
                url_final = href if href.startswith("http") else BASE_PCI + href
                links_pdf.append({"titulo": texto[:200], "url": url_final})

        # Tambem pega li sem classe .pdf que tenha link externo (site da banca/orgao)
        # Exclui li.li_provas (PROVAS RELACIONADAS aponta para acervo interno do PCI)
        for li in aside_links.find_all("li"):
            classes_li = li.get("class", [])
            if "pdf" in classes_li:
                continue  # ja capturado acima
            if "li_provas" in classes_li:
                continue  # link interno do PCI, nao exibir
            a = li.find("a", href=True)
            if not a:
                continue
            href  = a.get("href", "")
            texto = a.get_text(strip=True)
            # So links externos (site da banca/orgao)
            eh_externo = href.startswith("http") and "pciconcursos.com.br" not in href
            if eh_externo and texto and len(texto) > 3:
                url_final = href
                if not any(l["url"] == url_final for l in links_pdf):
                    links_pdf.append({"titulo": texto[:200], "url": url_final})

    if links_pdf:
        resultado["links_pdf"] = links_pdf[:20]

    return resultado


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------

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
            log.error(f"Erro salvar '{c['orgao']}': {e}"); return None

    def precisa_enriquecer(self, slug):
        try:
            res = self.db.table("concursos").select("descricao").eq("slug", slug).limit(1).execute()
            if not res.data: return True
            return not res.data[0].get("descricao")
        except: return False

    def salvar_banca(self, c):
        """Salva concurso vindo de uma banca externa (com PDFs e datas ja prontos)."""
        slug = fazer_slug(c["orgao"], c["fonte_url"])
        try:
            payload = {
                "slug":              slug,
                "titulo":            c.get("titulo") or c["orgao"],
                "orgao":             c["orgao"],
                "esfera":            c.get("esfera", "nao_identificada"),
                "estado":            c.get("estado"),
                "area_conhecimento": c.get("area_conhecimento", "administrativa"),
                "status":            c.get("status", "aberto"),
                "total_vagas":       c.get("total_vagas", 0),
                "data_abertura":     c["data_abertura"].isoformat() if c.get("data_abertura") else None,
                "data_encerramento": c["data_encerramento"].isoformat() if c.get("data_encerramento") else None,
                "edital_url":        c["fonte_url"],
                "fonte_url":         c["fonte_url"],
                "scraped_em":        datetime.now(timezone.utc).isoformat(),
            }
            if c.get("links_pdf"):
                payload["links_pdf"] = json.dumps(c["links_pdf"], ensure_ascii=False)
            if c.get("descricao"):
                payload["descricao"] = c["descricao"]

            res = self.db.table("concursos").upsert(payload, on_conflict="slug").execute()
            return res.data[0]["id"] if res.data else None
        except Exception as e:
            log.error(f"Erro salvar_banca '{c['orgao']}': {e}"); return None

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


# ---------------------------------------------------------------------------
# Alertas
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=== ConcursoTrack Scraper v5 ===")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    writer   = SupabaseWriter(supabase)

    with httpx.Client(headers=HEADERS, follow_redirects=True) as http:
        concursos = raspar_listagem(http)
        salvos, novos_ids, para_enriquecer = 0, [], []

        for c in concursos:
            slug   = fazer_slug(c["orgao"], c["fonte_url"])
            res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
            eh_novo = not bool(res_ex.data)
            cid     = writer.salvar(c)
            if cid:
                salvos += 1
                if eh_novo: novos_ids.append(cid)
            if writer.precisa_enriquecer(slug):
                para_enriquecer.append({"slug": slug, "fonte_url": c["fonte_url"]})

        log.info(f"[Fase 1] Salvos: {salvos}/{len(concursos)} | Novos: {len(novos_ids)} | Para enriquecer: {len(para_enriquecer)}")

        total = min(len(para_enriquecer), MAX_ARTIGOS)
        log.info(f"[Fase 2] Enriquecendo {total} artigos...")
        enriquecidos = 0
        for item in para_enriquecer[:MAX_ARTIGOS]:
            dados = raspar_artigo(http, item["fonte_url"])
            if dados["descricao"] or dados["links_pdf"]:
                if writer.atualizar_enriquecimento(item["slug"], dados):
                    enriquecidos += 1
                    log.info(f"  + {item['slug'][:55]}")
            time.sleep(DELAY_ARTIGO)

        log.info(f"[Fase 2] Enriquecidos: {enriquecidos}/{total}")

        # ── Fase 3: bancas externas ──────────────────────────────────────
        if CEBRASPE_DISPONIVEL:
            log.info("[Fase 3] Cebraspe...")
            try:
                cebraspe_scraper = CebraspeScraper(http)
                concursos_cebraspe = cebraspe_scraper.scrape()
                for c in concursos_cebraspe:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] Cebraspe: {len(concursos_cebraspe)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro Cebraspe: {e}")
        else:
            log.info("[Fase 3] Cebraspe não disponível (cebraspe.py ausente)")

        if FGV_DISPONIVEL:
            log.info("[Fase 3] FGV...")
            try:
                fgv_scraper = FGVScraper(http)
                concursos_fgv = fgv_scraper.scrape()
                for c in concursos_fgv:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] FGV: {len(concursos_fgv)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro FGV: {e}")
        else:
            log.info("[Fase 3] FGV não disponível (fgv.py ausente)")

        if IBFC_DISPONIVEL:
            log.info("[Fase 3] IBFC...")
            try:
                ibfc_scraper = IBFCScraper(http)
                concursos_ibfc = ibfc_scraper.scrape()
                for c in concursos_ibfc:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] IBFC: {len(concursos_ibfc)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro IBFC: {e}")
        else:
            log.info("[Fase 3] IBFC não disponível (ibfc.py ausente)")

        if FCC_DISPONIVEL:
            log.info("[Fase 3] FCC...")
            try:
                fcc_scraper = FCCScraper(http)
                concursos_fcc = fcc_scraper.scrape()
                for c in concursos_fcc:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] FCC: {len(concursos_fcc)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro FCC: {e}")
        else:
            log.info("[Fase 3] FCC não disponível (fcc.py ausente)")

        if CONSULPLAN_DISPONIVEL:
            log.info("[Fase 3] Instituto Consulplan...")
            try:
                consulplan_scraper = ConsulplanScraper(http)
                concursos_consulplan = consulplan_scraper.scrape()
                for c in concursos_consulplan:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] Consulplan: {len(concursos_consulplan)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro Consulplan: {e}")
        else:
            log.info("[Fase 3] Consulplan não disponível (consulplan.py ausente)")

        if QUADRIX_DISPONIVEL:
            log.info("[Fase 3] Quadrix...")
            try:
                quadrix_scraper = QuadrixScraper(http)
                concursos_quadrix = quadrix_scraper.scrape()
                for c in concursos_quadrix:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] Quadrix: {len(concursos_quadrix)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro Quadrix: {e}")
        else:
            log.info("[Fase 3] Quadrix não disponível (quadrix.py ausente)")

        if AVALIA_DISPONIVEL:
            log.info("[Fase 3] Instituto Avalia...")
            try:
                avalia_scraper = AvaliaScraper(http)
                concursos_avalia = avalia_scraper.scrape()
                for c in concursos_avalia:
                    slug   = fazer_slug(c["orgao"], c["fonte_url"])
                    res_ex = supabase.table("concursos").select("id").eq("slug", slug).limit(1).execute()
                    eh_novo = not bool(res_ex.data)
                    cid = writer.salvar_banca(c)
                    if cid and eh_novo:
                        novos_ids.append(cid)
                log.info(f"[Fase 3] Avalia: {len(concursos_avalia)} concursos processados")
            except Exception as e:
                log.error(f"[Fase 3] Erro Avalia: {e}")
        else:
            log.info("[Fase 3] Avalia não disponível (avalia.py ausente)")

    disparar_alertas(supabase, novos_ids)

    if MESCLAGEM_DISPONIVEL:
        log.info("[Fase 4] Gerando relatório de possíveis duplicatas (PCI x bancas dedicadas)...")
        log.info("[Fase 4] Esta etapa só LÊ e reporta — não aplica nada automaticamente. "
                  "Revise o relatório e rode aplicar_mesclagem.py manualmente pros pares aprovados.")
        try:
            gerar_relatorio(supabase)
        except Exception as e:
            log.error(f"[Fase 4] Erro ao gerar relatório: {e}")
    else:
        log.info("[Fase 4] Mesclagem não disponível (mesclar_duplicatas.py ausente)")

    log.info("=== Scraper v5 finalizado ===")


if __name__ == "__main__":
    main()

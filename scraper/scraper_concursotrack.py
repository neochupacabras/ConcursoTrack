"""
ConcursoTrack — Scraper de Editais (v2)
========================================
Raspa concursos das páginas de notícias do PCI Concursos,
onde os editais abertos são publicados como artigos.

Dependências:
    pip install httpx beautifulsoup4 supabase python-dotenv
"""

import os
import re
import time
import hashlib
import logging
from datetime import datetime, date
from dataclasses import dataclass
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ConcursoTrackBot/1.0; "
        "+https://concursotrack.com.br/bot)"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
}

DELAY = 1.5
MAX_PAGINAS = 3  # páginas de notícias a raspar por fonte

FONTES = [
    "https://www.pciconcursos.com.br/noticias/nacional/",
    "https://www.pciconcursos.com.br/noticias/sudeste/",
    "https://www.pciconcursos.com.br/noticias/sul/",
    "https://www.pciconcursos.com.br/noticias/nordeste/",
    "https://www.pciconcursos.com.br/noticias/centrooeste/",
    "https://www.pciconcursos.com.br/noticias/norte/",
]

ESFERA_KEYWORDS = {
    "federal": [
        "federal", "união", "ministério", "ibge", "inss", "receita federal",
        "dataprev", "anatel", "banco do brasil", "caixa", "petrobras",
        "exercito", "marinha", "aeronautica", "ime", "ita",
    ],
    "estadual": [
        "estadual", "governo do estado", "secretaria de estado",
        "pm -", "pc -", "tce", "mp -", "assembleia legislativa",
        "pmes", "cbm -",
    ],
    "municipal": [
        "prefeitura", "câmara municipal", "municipal", "cm -",
    ],
}

AREA_KEYWORDS = {
    "fiscal_tributaria":  ["fiscal", "tributário", "receita", "fazenda", "auditor", "dataprev"],
    "seguranca_publica":  [
        "policial", "delegado", "perito", "agente penitenciário",
        "guarda municipal", "soldado", "bombeiro", "policia", "pmes", "cbm",
    ],
    "saude":              [
        "médico", "enfermeiro", "farmacêutico", "nutricionista",
        "psicólogo", "fisioterapeuta", "saúde", "sesau",
    ],
    "educacao":           ["professor", "pedagogo", "docente", "educação", "seduc", "magistério"],
    "administrativa":     ["técnico administrativo", "analista administrativo", "assistente"],
    "tecnologia":         ["analista de ti", "técnico de ti", "desenvolvedor", "tecnologia da informação"],
    "engenharia":         ["engenheiro", "arquiteto", "técnico em edificações"],
    "juridica":           ["advogado", "procurador", "defensor", "promotor", "juiz"],
}


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

@dataclass
class Concurso:
    titulo:            str
    orgao:             str
    esfera:            str
    estado:            Optional[str]
    area_conhecimento: str
    status:            str
    total_vagas:       int
    data_encerramento: Optional[date]
    edital_url:        Optional[str]
    fonte_url:         str

    @property
    def slug(self) -> str:
        base = f"{self.orgao}-{self.titulo}".lower()
        base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:80]
        sufixo = hashlib.md5(self.fonte_url.encode()).hexdigest()[:6]
        return f"{base}-{sufixo}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extrair_vagas(texto: str) -> int:
    padrao = re.search(r"([\d.,]+)\s*vaga", texto, re.IGNORECASE)
    if padrao:
        return int(re.sub(r"[.,]", "", padrao.group(1)))
    return 0

def extrair_estado(texto: str) -> Optional[str]:
    match = re.search(r"[-\u2013(]\s*([A-Z]{2})\s*[)\s]", texto)
    if match:
        uf = match.group(1)
        ufs = {
            "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS",
            "MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC",
            "SE","SP","TO",
        }
        if uf in ufs:
            return uf
    estados = {
        "acre": "AC", "alagoas": "AL", "amapá": "AP", "amazonas": "AM",
        "bahia": "BA", "ceará": "CE", "distrito federal": "DF",
        "espírito santo": "ES", "goiás": "GO", "maranhão": "MA",
        "mato grosso do sul": "MS", "mato grosso": "MT", "minas gerais": "MG",
        "pará": "PA", "paraíba": "PB", "paraná": "PR", "pernambuco": "PE",
        "piauí": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
        "rio grande do sul": "RS", "rondônia": "RO", "roraima": "RR",
        "santa catarina": "SC", "são paulo": "SP", "sergipe": "SE",
        "tocantins": "TO",
    }
    txt = texto.lower()
    for nome, uf in estados.items():
        if nome in txt:
            return uf
    return None

def detectar_esfera(titulo: str) -> str:
    txt = titulo.lower()
    for esfera, palavras in ESFERA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return esfera
    if "prefeitura" in txt:
        return "municipal"
    return "nao_identificada"

def detectar_area(titulo: str) -> str:
    txt = titulo.lower()
    for area, palavras in AREA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"

def extrair_data(texto: str) -> Optional[date]:
    meses = {
        "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
        "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
        "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
    }
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", texto)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    m = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", texto, re.IGNORECASE)
    if m:
        mes_num = meses.get(m.group(2).lower())
        if mes_num:
            try:
                return date(int(m.group(3)), mes_num, int(m.group(1)))
            except ValueError:
                pass
    return None


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

class PCIScraper:
    BASE = "https://www.pciconcursos.com.br"

    def __init__(self, client: httpx.Client):
        self.http = client

    def _get(self, url: str) -> Optional[BeautifulSoup]:
        try:
            r = self.http.get(url, timeout=15)
            r.raise_for_status()
            return BeautifulSoup(r.text, "html.parser")
        except httpx.HTTPError as e:
            log.warning(f"HTTP error {url}: {e}")
            return None

    def _links_da_listagem(self, url: str) -> list:
        soup = self._get(url)
        if not soup:
            return []
        links = []
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            if "/noticias/" in href and href.count("/") >= 4:
                full = href if href.startswith("http") else self.BASE + href
                if full not in links:
                    links.append(full)
        return links

    def _parsear_noticia(self, url: str) -> Optional[Concurso]:
        soup = self._get(url)
        if not soup:
            return None

        titulo_el = soup.select_one("h1")
        if titulo_el:
            titulo = titulo_el.get_text(strip=True)
        else:
            meta = soup.find("meta", property="og:title")
            titulo = meta["content"] if meta else ""

        if not titulo:
            return None

        palavras_edital = ["concurso", "seleção", "edital", "processo seletivo", "vagas", "inscrições"]
        if not any(p in titulo.lower() for p in palavras_edital):
            return None

        texto_completo = soup.get_text(" ")
        vagas = extrair_vagas(titulo + " " + texto_completo[:1000])

        # Extrai órgão
        orgao = titulo
        m = re.match(
            r"^(.+?)\s+(?:abre|publica|divulga|lança|retifica|prorroga)",
            titulo, re.IGNORECASE
        )
        if m:
            orgao = m.group(1).strip()
        orgao = re.sub(r"\s*[-\u2013]\s*[A-Z]{2}\s*$", "", orgao).strip()[:150]

        # Data de encerramento
        data_enc = None
        for pad in [
            r"inscri[çc][õo]es?\s+at[eé]\s+(\d{1,2}/\d{1,2}/\d{4})",
            r"prazo.*?(\d{1,2}/\d{1,2}/\d{4})",
            r"at[eé]\s+o\s+dia\s+(\d{1,2}/\d{1,2}/\d{4})",
        ]:
            m2 = re.search(pad, texto_completo, re.IGNORECASE)
            if m2:
                data_enc = extrair_data(m2.group(1))
                if data_enc:
                    break

        # Link do edital
        edital_url = None
        for a in soup.select("a[href]"):
            texto_link = a.get_text(strip=True).lower()
            if any(p in texto_link for p in ["edital", "acesse o edital", "clique aqui"]):
                href = a.get("href", "")
                edital_url = href if href.startswith("http") else self.BASE + href
                break

        return Concurso(
            titulo=titulo[:200],
            orgao=orgao,
            esfera=detectar_esfera(titulo),
            estado=extrair_estado(titulo),
            area_conhecimento=detectar_area(titulo),
            status="aberto",
            total_vagas=vagas,
            data_encerramento=data_enc,
            edital_url=edital_url,
            fonte_url=url,
        )

    def scrape(self, max_paginas: int = MAX_PAGINAS) -> list:
        todos_links = []
        for fonte in FONTES:
            for pagina in range(1, max_paginas + 1):
                url = fonte if pagina == 1 else f"{fonte}?pagina={pagina}"
                log.info(f"Listagem: {url}")
                links = self._links_da_listagem(url)
                if not links:
                    break
                todos_links.extend(links)
                time.sleep(DELAY)

        vistos = set()
        links_unicos = [l for l in todos_links if not (l in vistos or vistos.add(l))]
        log.info(f"Links únicos: {len(links_unicos)}")

        concursos = []
        for url in links_unicos:
            c = self._parsear_noticia(url)
            if c:
                concursos.append(c)
                log.info(f"  + {c.orgao} | {c.total_vagas}v | {c.estado or 'BR'}")
            time.sleep(DELAY)

        log.info(f"Total: {len(concursos)} concursos")
        return concursos


# ---------------------------------------------------------------------------
# Persistência
# ---------------------------------------------------------------------------

class SupabaseWriter:
    def __init__(self, db: Client):
        self.db = db

    def salvar(self, c: Concurso) -> Optional[str]:
        try:
            payload = {
                "slug":               c.slug,
                "titulo":             c.titulo,
                "orgao":              c.orgao,
                "esfera":             c.esfera,
                "estado":             c.estado,
                "area_conhecimento":  c.area_conhecimento,
                "status":             c.status,
                "total_vagas":        c.total_vagas,
                "data_encerramento":  c.data_encerramento.isoformat() if c.data_encerramento else None,
                "edital_url":         c.edital_url,
                "fonte_url":          c.fonte_url,
                "scraped_em":         datetime.utcnow().isoformat(),
            }
            res = self.db.table("concursos").upsert(payload, on_conflict="slug").execute()
            return res.data[0]["id"] if res.data else None
        except Exception as e:
            log.error(f"Erro ao salvar '{c.orgao}': {e}")
            return None


# ---------------------------------------------------------------------------
# Alertas
# ---------------------------------------------------------------------------

def disparar_alertas(db: Client, novos_ids: list) -> int:
    if not novos_ids:
        return 0
    enviados = 0
    for cid in novos_ids:
        concurso = db.table("concursos").select("*").eq("id", cid).single().execute().data
        if not concurso:
            continue
        alertas = db.table("alertas").select("*").eq("ativo", True).execute().data or []
        for alerta in alertas:
            if alerta.get("area_conhecimento") and alerta["area_conhecimento"] != concurso.get("area_conhecimento"):
                continue
            if alerta.get("estado") and alerta["estado"] != concurso.get("estado"):
                continue
            if alerta.get("esfera") and alerta["esfera"] != concurso.get("esfera"):
                continue
            try:
                db.table("notificacoes_fila").insert({
                    "user_id":     alerta["user_id"],
                    "concurso_id": cid,
                    "canal":       alerta.get("canal", "email"),
                    "enviado":     False,
                    "criado_em":   datetime.utcnow().isoformat(),
                }).execute()
                enviados += 1
            except Exception as e:
                log.warning(f"Erro ao enfileirar alerta: {e}")
    log.info(f"Alertas enfileirados: {enviados}")
    return enviados


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=== ConcursoTrack Scraper v2 iniciado ===")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    writer   = SupabaseWriter(supabase)

    with httpx.Client(headers=HEADERS, follow_redirects=True) as http:
        scraper  = PCIScraper(http)
        concursos = scraper.scrape()

    salvos    = 0
    novos_ids = []

    for c in concursos:
        existia = (
            supabase.table("concursos").select("id")
            .eq("slug", c.slug).maybe_single().execute().data
        )
        cid = writer.salvar(c)
        if cid:
            salvos += 1
            if not existia:
                novos_ids.append(cid)

    log.info(f"Salvos/atualizados: {salvos}/{len(concursos)}")
    log.info(f"Novos (para alertas): {len(novos_ids)}")
    disparar_alertas(supabase, novos_ids)
    log.info("=== Scraper finalizado ===")


if __name__ == "__main__":
    main()

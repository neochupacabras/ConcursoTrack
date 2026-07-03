"""
ConcursoTrack — Scraper de Editais v4
=======================================
Raspa a listagem /concursos/ do PCI Concursos diretamente,
sem precisar entrar em cada artigo individualmente.
Muito mais rápido: uma única página com todos os concursos abertos.

Dependências:
    pip install httpx beautifulsoup4 supabase python-dotenv
"""

import os
import re
import hashlib
import logging
from datetime import datetime, date
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

URL_LISTAGEM = "https://www.pciconcursos.com.br/concursos/"

UFS = {
    "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
    "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
}

ESFERA_KEYWORDS = {
    "federal": [
        "federal", "ministério", "ibge", "inss", "receita federal", "dataprev",
        "anatel", "banco do brasil", "caixa econômica", "petrobras", "exercito",
        "marinha", "aeronautica", "ime ", "ita ", "eear", "denatran", "dnit",
        "funai", "incra", "iphan", "anvisa", "fiocruz", "loa ", "ancine",
    ],
    "estadual": [
        "estadual", "governo do estado", "secretaria de estado", "assembleia",
        "tribunal de justiça", "ministério público estadual", "defensoria",
        "pmes", "cbm", "pm -", "pc -", "tce-", "tce ",
    ],
    "municipal": [
        "prefeitura", "câmara municipal", "câmara de", "saae", "samae",
        "autarquia municipal", "guarda municipal",
    ],
}

AREA_KEYWORDS = {
    "fiscal_tributaria":  ["fiscal", "tributário", "receita", "fazenda", "auditor", "dataprev", "sefaz"],
    "seguranca_publica":  ["policial", "delegado", "perito", "agente penitenciário",
                           "guarda municipal", "soldado", "bombeiro", "pm -", "pmes", "cbm", "eear"],
    "saude":              ["médico", "enfermeiro", "farmacêutico", "nutricionista",
                           "psicólogo", "fisioterapeuta", "saúde", "sesau", "sarah"],
    "educacao":           ["professor", "pedagogo", "docente", "educação", "seduc",
                           "magistério", "pnd", "prova nacional docente"],
    "tecnologia":         ["analista de ti", "técnico de ti", "desenvolvedor",
                           "tecnologia da informação", "dataprev"],
    "engenharia":         ["engenheiro", "arquiteto", "ime ", "ita "],
    "juridica":           ["advogado", "procurador", "defensor", "promotor", "juiz", "cartório"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extrair_uf(title: str) -> Optional[str]:
    """Extrai UF do atributo title. Ex: 'IBGE - BR: ...' → None, 'PM - SP: ...' → 'SP'"""
    m = re.search(r"-\s*([A-Z]{2})\s*[:–\-]", title)
    if m:
        uf = m.group(1)
        if uf in UFS:
            return uf
    return None


def extrair_vagas(texto: str) -> int:
    m = re.search(r"([\d][.\d]*)\s*vaga", texto, re.IGNORECASE)
    if m:
        try:
            return int(m.group(1).replace(".", ""))
        except ValueError:
            pass
    # "Cadastro Reserva" → 0 vagas
    return 0


def extrair_data(texto: str) -> Optional[date]:
    # Procura padrão dd/mm/yyyy
    matches = re.findall(r"(\d{1,2})/(\d{2})/(\d{4})", texto)
    datas = []
    for d, m, a in matches:
        try:
            datas.append(date(int(a), int(m), int(d)))
        except ValueError:
            pass
    if not datas:
        return None
    # Se houver duas datas (período de inscrição), pega a maior (encerramento)
    return max(datas)


def detectar_esfera(orgao: str, titulo: str) -> str:
    txt = (orgao + " " + titulo).lower()
    for esfera, palavras in ESFERA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return esfera
    return "nao_identificada"


def detectar_area(orgao: str, titulo: str) -> str:
    txt = (orgao + " " + titulo).lower()
    for area, palavras in AREA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


def fazer_slug(orgao: str, fonte_url: str) -> str:
    base = orgao.lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:60]
    sufixo = hashlib.md5(fonte_url.encode()).hexdigest()[:6]
    return f"{base}-{sufixo}"


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

def raspar_listagem(http: httpx.Client) -> list[dict]:
    log.info(f"Buscando listagem: {URL_LISTAGEM}")
    try:
        r = http.get(URL_LISTAGEM, timeout=20)
        r.raise_for_status()
    except httpx.HTTPError as e:
        log.error(f"Erro HTTP: {e}")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    concursos = []
    vistos: set[str] = set()

    for a in soup.select("a[href*='/noticias/']"):
        href  = a.get("href", "")
        title = a.get("title", "")
        orgao = a.get_text(strip=True)

        # Pula links de seção/menu
        if not title or len(orgao) < 5:
            continue
        if orgao.lower() in ("notícias", "noticias", "nacional", "sudeste",
                             "sul", "norte", "nordeste", "centro-oeste"):
            continue
        if href in vistos:
            continue
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

    log.info(f"Concursos encontrados na listagem: {len(concursos)}")
    return concursos


# ---------------------------------------------------------------------------
# Persistência
# ---------------------------------------------------------------------------

class SupabaseWriter:
    def __init__(self, db: Client):
        self.db = db

    def salvar(self, c: dict) -> Optional[str]:
        slug = fazer_slug(c["orgao"], c["fonte_url"])
        try:
            payload = {
                "slug":               slug,
                "titulo":             c["titulo"],
                "orgao":              c["orgao"],
                "esfera":             c["esfera"],
                "estado":             c["estado"],
                "area_conhecimento":  c["area_conhecimento"],
                "status":             c["status"],
                "total_vagas":        c["total_vagas"],
                "data_encerramento":  c["data_encerramento"].isoformat() if c["data_encerramento"] else None,
                "edital_url":         c["fonte_url"],
                "fonte_url":          c["fonte_url"],
                "scraped_em":         datetime.utcnow().isoformat(),
            }
            res = self.db.table("concursos").upsert(payload, on_conflict="slug").execute()
            return res.data[0]["id"] if res.data else None
        except Exception as e:
            log.error(f"Erro ao salvar '{c['orgao']}': {e}")
            return None


# ---------------------------------------------------------------------------
# Alertas
# ---------------------------------------------------------------------------

def disparar_alertas(db: Client, novos_ids: list[str]) -> int:
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
    log.info("=== ConcursoTrack Scraper v4 iniciado ===")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    writer   = SupabaseWriter(supabase)

    with httpx.Client(headers=HEADERS, follow_redirects=True) as http:
        concursos = raspar_listagem(http)

    salvos    = 0
    novos_ids: list[str] = []

    for c in concursos:
        slug = fazer_slug(c["orgao"], c["fonte_url"])
        existia = (
            supabase.table("concursos").select("id")
            .eq("slug", slug).maybe_single().execute().data
        )
        cid = writer.salvar(c)
        if cid:
            salvos += 1
            if not existia:
                novos_ids.append(cid)

    log.info(f"Salvos/atualizados: {salvos}/{len(concursos)}")
    log.info(f"Novos (para alertas): {len(novos_ids)}")
    disparar_alertas(supabase, novos_ids)
    log.info("=== Scraper v4 finalizado ===")


if __name__ == "__main__":
    main()

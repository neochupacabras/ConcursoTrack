"""
ConcursoTrack — Scraper Cebraspe
=================================
Raspa a API JSON interna do Cebraspe (sem precisar de JavaScript/Playwright).

Endpoints descobertos via DevTools:
  Listagem: GET https://www.cebraspe.org.br/concursos/?_={timestamp}
  Detalhe:  GET https://www.cebraspe.org.br/{eventoURL}/?_={timestamp}
  PDFs:     https://arquivos.cebraspe.org.br/cebraspe/{nomeArquivo}

Uso standalone (teste):
    python scraper/cebraspe.py

Uso integrado (chamado pelo scraper principal):
    from scraper.cebraspe import CebraspeScraper
    scraper = CebraspeScraper(http_client)
    concursos = scraper.scrape()
"""

import re
import time
import logging
from datetime import date, datetime, timezone
from typing import Optional

import httpx

log = logging.getLogger(__name__)

API_LISTAGEM = "https://apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/"
API_DETALHE  = "https://apis.cebraspe.org.br/cebraspe/eventos/{evento_url}"
URL_PDF_BASE = "https://arquivos.cebraspe.org.br/cebraspe/"

# Fases que nos interessam
FASES_ATIVAS = {"Novos", "Inscrições Abertas"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.cebraspe.org.br/concursos",
}

DELAY = 1.2  # segundos entre requisições de detalhe


def _ts() -> int:
    """Timestamp em ms para evitar cache."""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _parse_periodo(periodo: Optional[str]) -> tuple[Optional[date], Optional[date]]:
    """
    Extrai datas de abertura e encerramento do campo periodoInscricao.
    Exemplo: "De 23/07/2026 até 21/08/2026 às 18:00, horário oficial de Brasília/DF"
    """
    if not periodo:
        return None, None
    datas = re.findall(r"(\d{2}/\d{2}/\d{4})", periodo)
    abertura    = None
    encerramento = None
    if len(datas) >= 1:
        try:
            d, m, a = datas[0].split("/")
            abertura = date(int(a), int(m), int(d))
        except ValueError:
            pass
    if len(datas) >= 2:
        try:
            d, m, a = datas[1].split("/")
            encerramento = date(int(a), int(m), int(d))
        except ValueError:
            pass
    return abertura, encerramento


def _extrair_pdfs(arquivos_edital: list) -> list[dict]:
    """Filtra apenas PDFs e monta a URL completa."""
    links = []
    for arq in (arquivos_edital or []):
        ext = arq.get("tipoExtensaoArquivo", "")
        if ext != "_.pdf":
            continue
        nome   = arq.get("nomeArquivo", "")
        titulo = arq.get("descricaoArquivo", "Edital")
        if nome:
            links.append({
                "titulo": titulo[:200],
                "url":    URL_PDF_BASE + nome,
            })
    return links


def _mapear_esfera(nome: str) -> str:
    txt = nome.lower()
    keywords_federal = [
        "federal", "anatel", "anvisa", "inss", "receita", "banco do brasil",
        "caixa", "petrobras", "exercito", "marinha", "aeronautica", "ibge",
        "ministerio", "dataprev", "dnit",
    ]
    keywords_estadual = [
        "tj ", "tce", "mp ", "pc ", "pm ", "seduc", "sefaz", "sesau",
        "sead", "seap", "detran", "tribunal", "assembleia", "governo do estado",
        "alprev", "agepar",
    ]
    if any(k in txt for k in keywords_federal):
        return "federal"
    if any(k in txt for k in keywords_estadual):
        return "estadual"
    if "prefeitura" in txt or "camara" in txt:
        return "municipal"
    return "nao_identificada"


def _mapear_area(nome: str) -> str:
    txt = nome.lower()
    mapa = {
        "fiscal_tributaria":  ["sefaz", "receita", "fiscal", "tributar", "fazenda"],
        "seguranca_publica":  ["policia", "pc ", "pm ", "bombeiro", "penal", "detran", "seguranca"],
        "saude":              ["saude", "sesau", "medico", "enfermeiro", "hospital", "sus"],
        "educacao":           ["seduc", "professor", "educacao", "escola", "magisterio"],
        "tecnologia":         ["ti ", "tecnologia", "informatica", "sistemas"],
        "juridica":           ["tj ", "tribunal", "ministerio publico", "mp ", "procurador"],
        "administrativa":     ["administrativo", "gestao", "previdencia", "alprev"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


class CebraspeScraper:
    BANCA = "CEBRASPE"

    def __init__(self, http: httpx.Client):
        self.http = http

    def _get_json(self, url: str) -> Optional[dict | list]:
        try:
            r = self.http.get(url, headers=HEADERS, timeout=15)
            r.raise_for_status()
            # Verifica se recebeu JSON ou HTML
            ct = r.headers.get("content-type", "")
            if "json" not in ct and r.text.strip().startswith("<"):
                log.warning(f"[Cebraspe] Recebeu HTML em vez de JSON: {url}")
                return None
            return r.json()
        except Exception as e:
            log.warning(f"[Cebraspe] Erro {url}: {e}")
            return None

    def _buscar_detalhe(self, evento_url: str) -> Optional[dict]:
        url = API_DETALHE.format(evento_url=evento_url) + f"?_={_ts()}"
        return self._get_json(url)

    def scrape(self) -> list[dict]:
        """
        Retorna lista de concursos no formato padrão do ConcursoTrack.
        """
        log.info("[Cebraspe] Buscando listagem...")
        data = self._get_json(f"{API_LISTAGEM}?_={_ts()}")

        if not data or not isinstance(data, list):
            log.warning("[Cebraspe] Resposta inesperada da API de listagem")
            return []

        # Filtra apenas fases ativas
        eventos_ativos = []
        for fase in data:
            nome_fase = fase.get("faseEvento", "")
            if nome_fase in FASES_ATIVAS:
                for ev in fase.get("eventos", []):
                    ev["_fase"] = nome_fase
                    eventos_ativos.append(ev)

        log.info(f"[Cebraspe] {len(eventos_ativos)} concursos nas fases ativas")

        concursos = []
        for ev in eventos_ativos:
            evento_url = ev.get("eventoURL", "")
            nome_abrev = ev.get("eventoNomeAbreviado", "")

            if not evento_url:
                continue

            # Busca detalhes (PDFs, período de inscrição, cargos)
            detalhe = self._buscar_detalhe(evento_url)
            time.sleep(DELAY)

            if not detalhe:
                detalhe = {}

            # Período de inscrição
            periodo          = detalhe.get("periodoInscricao") or ev.get("periodoInscricao")
            data_abertura, data_encerramento = _parse_periodo(periodo)

            # PDFs
            links_pdf = _extrair_pdfs(detalhe.get("arquivosEdital") or [])

            # Vagas
            try:
                vagas = int(ev.get("eventoTotalVagas", 0))
            except (ValueError, TypeError):
                vagas = 0

            # UF a partir do nome (ex: "AGEPAR PR 26" → "PR")
            ufs = re.findall(r"\b([A-Z]{2})\b", nome_abrev)
            ufs_validas = {"AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
                           "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"}
            estado = next((u for u in ufs if u in ufs_validas), None)

            # URL do concurso no Cebraspe (para referência interna, não exibida)


            concursos.append({
                "banca":             self.BANCA,
                "orgao":             nome_abrev,
                "titulo":            detalhe.get("eventoNomeCompleto") or nome_abrev,
                "esfera":            _mapear_esfera(nome_abrev),
                "estado":            estado,
                "area_conhecimento": _mapear_area(nome_abrev),
                "status":            "aberto",
                "total_vagas":       vagas,
                "salario_maximo":    ev.get("eventoSalarioMaximo"),
                "data_abertura":     data_abertura,
                "data_encerramento": data_encerramento,
                "fonte_url":         f"https://www.cebraspe.org.br/concursos/{evento_url}",
                "links_pdf":         links_pdf,
                "descricao":         None,  # Cebraspe não tem texto de artigo
            })

            log.info(f"  + {nome_abrev} | {vagas}v | {estado or 'BR'} | {len(links_pdf)} PDFs")

        log.info(f"[Cebraspe] Total: {len(concursos)} concursos")
        return concursos


# ---------------------------------------------------------------------------
# Teste standalone
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with httpx.Client(follow_redirects=True) as http:
        scraper   = CebraspeScraper(http)
        concursos = scraper.scrape()

    print(f"\n{'='*60}")
    print(f"Total: {len(concursos)} concursos")
    print(f"{'='*60}")
    for c in concursos:
        print(f"\n  {c['orgao']}")
        print(f"  Vagas: {c['total_vagas']} | Estado: {c['estado'] or 'Nacional'} | Esfera: {c['esfera']}")
        print(f"  Inscrições: {c['data_abertura']} → {c['data_encerramento']}")
        print(f"  PDFs: {len(c['links_pdf'])}")
        for pdf in c["links_pdf"]:
            print(f"    - {pdf['titulo']}")
            print(f"      {pdf['url']}")

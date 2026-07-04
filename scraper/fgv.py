"""
ConcursoTrack — Scraper FGV Conhecimento
==========================================
Raspa HTML estático da página de concursos em andamento da FGV.

Estrutura identificada via diagnostico_banca.py:
  Listagem: #tab-text-127-content div.views-row div.views-field-title span.field-content a
  Detalhe:  página individual por concurso
  PDFs:     a[href*="/sites/default/files/concursos/"] dentro de div.node__content

Uso standalone (teste):
    python scraper/fgv.py

Uso integrado:
    from fgv import FGVScraper
    scraper = FGVScraper(http_client)
    concursos = scraper.scrape()
"""

import re
import time
import logging
from datetime import date
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

URL_LISTAGEM = "https://conhecimento.fgv.br/concursos"
BASE_URL     = "https://conhecimento.fgv.br"
DELAY        = 1.2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# PDFs do rodapé/institucional a ignorar
PDFS_IGNORAR = [
    "termos-de-uso", "aviso-de-privacidade", "aviso-de-cookies",
    "politica-de", "2026.01", "2026.06", "2025.",
]


def _get(http: httpx.Client, url: str) -> Optional[BeautifulSoup]:
    try:
        r = http.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return BeautifulSoup(r.text, "html.parser")
    except Exception as e:
        log.warning(f"[FGV] Erro {url}: {e}")
        return None


def _parse_data(texto: str) -> Optional[date]:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", texto)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


def _extrair_uf(titulo: str) -> Optional[str]:
    ufs = {"AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
           "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"}
    estados = {
        "acre":"AC","alagoas":"AL","amazonas":"AM","amapá":"AP","bahia":"BA",
        "ceará":"CE","distrito federal":"DF","espírito santo":"ES","goiás":"GO",
        "maranhão":"MA","mato grosso do sul":"MS","mato grosso":"MT",
        "minas gerais":"MG","pará":"PA","paraíba":"PB","paraná":"PR",
        "pernambuco":"PE","piauí":"PI","rio de janeiro":"RJ",
        "rio grande do norte":"RN","rio grande do sul":"RS","rondônia":"RO",
        "roraima":"RR","santa catarina":"SC","são paulo":"SP","sergipe":"SE",
        "tocantins":"TO",
    }
    cidades = {
        "governador valadares":"MG","valadares":"MG","uberlândia":"MG",
        "belo horizonte":"MG","contagem":"MG","juiz de fora":"MG",
        "macaé":"RJ","campos dos goytacazes":"RJ","niterói":"RJ","petrópolis":"RJ",
        "campinas":"SP","ribeirão preto":"SP","santos":"SP","guarulhos":"SP",
        "osasco":"SP","sorocaba":"SP","são bernardo":"SP","santo andré":"SP",
        "curitiba":"PR","londrina":"PR","maringá":"PR",
        "porto alegre":"RS","caxias do sul":"RS","pelotas":"RS","canoas":"RS",
        "florianópolis":"SC","joinville":"SC","blumenau":"SC","chapecó":"SC",
        "salvador":"BA","feira de santana":"BA","vitória da conquista":"BA",
        "fortaleza":"CE","caucaia":"CE","juazeiro do norte":"CE",
        "manaus":"AM","belém":"PA","macapá":"AP",
        "campo grande":"MS","cuiabá":"MT","goiânia":"GO","anápolis":"GO",
        "natal":"RN","joão pessoa":"PB","recife":"PE","maceió":"AL",
        "teresina":"PI","são luís":"MA","palmas":"TO","porto velho":"RO",
        "boa vista":"RR","rio branco":"AC","aracaju":"SE","vitória":"ES",
    }
    txt = titulo.lower()
    for nome, uf in estados.items():
        if nome in txt:
            return uf
    for cidade, uf in cidades.items():
        if cidade in txt:
            return uf
    m = re.search(r"\b([A-Z]{2})\b", titulo)
    if m and m.group(1) in ufs:
        return m.group(1)
    return None


def _mapear_esfera(titulo: str) -> str:
    txt = titulo.lower()
    if any(p in txt for p in ["prefeitura","câmara municipal","procuradoria geral do município",
                               "câmara de "]):
        return "municipal"
    if any(p in txt for p in ["tribunal de justiça","assembleia","ministério público do estado",
                               "ministério público estadual","procuradoria-geral do estado",
                               "procuradoria geral do estado","secretaria de estado",
                               "secretaria da educação do estado","tribunal de contas",
                               "defensoria pública do estado","polícia militar",
                               "corpo de bombeiros","governo do estado"]):
        return "estadual"
    if "ministério público" in txt:
        nomes_estados = ["acre","alagoas","amapá","amazonas","bahia","ceará","espírito santo",
                         "goiás","maranhão","mato grosso","minas gerais","pará","paraíba",
                         "paraná","pernambuco","piauí","rio de janeiro","rio grande",
                         "rondônia","roraima","santa catarina","são paulo","sergipe","tocantins"]
        if any(e in txt for e in nomes_estados):
            return "estadual"
    if any(p in txt for p in ["federal","receita","dataprev","senado","nav brasil",
                               "tribunal superior","cnj","csjt","advocacia-geral da união"]):
        return "federal"
    return "nao_identificada"


def _mapear_area(titulo: str) -> str:
    txt = titulo.lower()
    mapa = {
        "fiscal_tributaria":  ["receita","fazenda","fiscal","sefaz","tribunal de contas"],
        "seguranca_publica":  ["polícia","bombeiro","defensor","penal"],
        "juridica":           ["tribunal","ministério público","procuradoria","juiz","promotor","defensoria"],
        "tecnologia":         ["dataprev","tecnologia","informação","ti "],
        "educacao":           ["educação","seduc","escola","professor"],
        "administrativa":     ["assembleia","câmara","secretaria","nav brasil"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


def _raspar_detalhe(http: httpx.Client, url: str, titulo: str) -> dict:
    """Raspa página individual do concurso para extrair PDFs e datas."""
    resultado = {
        "links_pdf": [],
        "data_abertura": None,
        "data_encerramento": None,
        "descricao": None,
        "total_vagas": 0,
    }

    soup = _get(http, url)
    if not soup:
        return resultado

    conteudo = soup.select_one("div.node__content")
    if not conteudo:
        return resultado

    # PDFs — links para /sites/default/files/concursos/
    for a in conteudo.find_all("a", href=True):
        href  = a.get("href", "")
        texto = a.get_text(strip=True)

        if not href or len(texto) < 2:
            continue
        if not (".pdf" in href.lower() or "/sites/default/files/" in href):
            continue
        # Ignora PDFs institucionais
        if any(ig in href for ig in PDFS_IGNORAR):
            continue

        url_pdf = urljoin(BASE_URL, href)
        if not any(l["url"] == url_pdf for l in resultado["links_pdf"]):
            resultado["links_pdf"].append({"titulo": texto[:200], "url": url_pdf})

    # Datas — procura padrões DD/MM/YYYY no conteúdo
    texto_pagina = conteudo.get_text(" ", strip=True)
    datas = []
    for m in re.finditer(r"(\d{2}/\d{2}/\d{4})", texto_pagina):
        d = _parse_data(m.group(1))
        if d:
            datas.append(d)
    if len(datas) >= 2:
        resultado["data_abertura"]    = min(datas)
        resultado["data_encerramento"] = max(datas)
    elif len(datas) == 1:
        resultado["data_encerramento"] = datas[0]

    # Vagas — procura "X vagas" no texto
    m_vagas = re.search(r"([\d.,]+)\s*vaga", texto_pagina, re.IGNORECASE)
    if m_vagas:
        try:
            resultado["total_vagas"] = int(m_vagas.group(1).replace(".", "").replace(",", ""))
        except ValueError:
            pass

    # Descrição — paragrafos do conteúdo principal
    paragrafos = []
    for p in conteudo.find_all("p"):
        txt = p.get_text(" ", strip=True)
        if len(txt) > 40 and "javascript" not in txt.lower():
            paragrafos.append(txt)
    if paragrafos:
        resultado["descricao"] = "\n\n".join(paragrafos[:10])[:4000]

    return resultado


class FGVScraper:
    BANCA = "FGV"

    def __init__(self, http: httpx.Client):
        self.http = http

    def scrape(self) -> list[dict]:
        log.info("[FGV] Buscando listagem...")
        soup = _get(self.http, URL_LISTAGEM)
        if not soup:
            return []

        # Pega só a aba "Em andamento" (#tab-text-127-content)
        aba_andamento = soup.select_one("#tab-text-127-content")
        if not aba_andamento:
            log.warning("[FGV] Aba 'Em andamento' não encontrada — tentando listagem geral")
            aba_andamento = soup

        links_concursos = []
        for row in aba_andamento.select("div.views-row"):
            a = row.select_one("div.views-field-title span.field-content a")
            if not a:
                continue
            titulo = a.get_text(strip=True)
            href   = a.get("href", "")
            if not href or not titulo:
                continue
            # Ignora exames (OAB, CFC, ENAM, ENAC) — não são concursos públicos
            if "/exames/" in href:
                continue
            url = urljoin(BASE_URL, href)
            links_concursos.append({"titulo": titulo, "url": url})

        log.info(f"[FGV] {len(links_concursos)} concursos em andamento")

        concursos = []
        for item in links_concursos:
            titulo = item["titulo"]
            url    = item["url"]

            detalhe = _raspar_detalhe(self.http, url, titulo)
            time.sleep(DELAY)

            # Nome do órgão: remove prefixos e artigos iniciais
            orgao = titulo
            for prefixo in ["Concurso Público para ", "Concurso Público Nacional Unificado ",
                             "Concurso Público Nacional ", "Processo Seletivo para ",
                             "Processo Seletivo Simplificado para ",
                             "XXXIX Concurso para Ingresso na Classe Inicial da Carreira do "]:
                if orgao.startswith(prefixo):
                    orgao = orgao[len(prefixo):]
                    break
            # Remove artigos iniciais: "a ", "o ", "as ", "os "
            orgao = re.sub(r"^(a |o |as |os |ao |à )", "", orgao, flags=re.IGNORECASE).strip()
            # Pega até o primeiro " - " ou " – " como nome curto
            partes = re.split(r" [-–] ", orgao, maxsplit=1)
            orgao = partes[0].strip()

            # Se as inscrições já encerraram, marca como em_andamento
            data_enc = detalhe["data_encerramento"]
            from datetime import date as _date
            status = "aberto" if (not data_enc or data_enc >= _date.today()) else "em_andamento"

            concursos.append({
                "banca":             self.BANCA,
                "orgao":             orgao[:150],
                "titulo":            titulo[:200],
                "esfera":            _mapear_esfera(titulo),
                "estado":            _extrair_uf(titulo),
                "area_conhecimento": _mapear_area(titulo),
                "status":            status,
                "total_vagas":       detalhe["total_vagas"],
                "data_abertura":     detalhe["data_abertura"],
                "data_encerramento": detalhe["data_encerramento"],
                "fonte_url":         url,
                "links_pdf":         detalhe["links_pdf"],
                "descricao":         detalhe["descricao"],
            })

            log.info(
                f"  + {orgao[:50]} | "
                f"{detalhe['total_vagas']}v | "
                f"{_extrair_uf(titulo) or 'BR'} | "
                f"{len(detalhe['links_pdf'])} PDFs"
            )

        log.info(f"[FGV] Total: {len(concursos)} concursos")
        return concursos


# ---------------------------------------------------------------------------
# Teste standalone
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with httpx.Client(follow_redirects=True, timeout=20) as http:
        scraper   = FGVScraper(http)
        concursos = scraper.scrape()

    print(f"\n{'='*60}")
    print(f"Total: {len(concursos)} concursos")
    print(f"{'='*60}")
    for c in concursos:
        print(f"\n  {c['orgao'][:60]}")
        print(f"  Esfera: {c['esfera']} | Estado: {c['estado'] or 'Nacional'}")
        print(f"  Vagas: {c['total_vagas']} | Inscrições: {c['data_abertura']} → {c['data_encerramento']}")
        print(f"  PDFs: {len(c['links_pdf'])}")
        for pdf in c["links_pdf"][:3]:
            print(f"    - {pdf['titulo'][:60]}")
            print(f"      {pdf['url'][:80]}")

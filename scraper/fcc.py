"""
ConcursoTrack — Scraper FCC (Fundação Carlos Chagas)
======================================================
Estrutura identificada via diagnostico_banca.py:
  Listagem: div.textoInstituicao2 (orgao) + div.textoConcurso2 (link)
  Detalhe PDFs: div.campoLinkArquivo a → URL /rybena/web/index.html?file=URL_REAL
  Status: #opcaoConcursos → "Inscrições abertas"
  Encoding: ISO-8859-1

Uso standalone: python scraper/fcc.py
"""

import re
import time
import logging
from datetime import date
from typing import Optional
from urllib.parse import urljoin, urlparse, parse_qs, unquote

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

URL_LISTAGEM_ABERTOS = "https://www.concursosfcc.com.br/concursoInscricaoAberta.html"
URL_LISTAGEM_NOVOS   = "https://www.concursosfcc.com.br/concursoNovo.html"
BASE_URL             = "https://www.concursosfcc.com.br"
DELAY                = 1.2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# Ignora exames e certificações
IGNORAR_TITULOS = [
    "exame", "certificação", "certificacao", "vestibular",
    "processo seletivo para medicina", "oab",
]


def _get(http: httpx.Client, url: str) -> Optional[BeautifulSoup]:
    try:
        r = http.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        texto = r.content.decode("iso-8859-1", errors="replace")
        return BeautifulSoup(texto, "html.parser")
    except Exception as e:
        log.warning(f"[FCC] Erro {url}: {e}")
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
        "manaus":"AM","belém":"PA","fortaleza":"CE","salvador":"BA",
        "recife":"PE","porto alegre":"RS","curitiba":"PR","florianópolis":"SC",
        "goiânia":"GO","campo grande":"MS","cuiabá":"MT","porto velho":"RO",
        "boa vista":"RR","rio branco":"AC","macapá":"AP","palmas":"TO",
        "natal":"RN","joão pessoa":"PB","maceió":"AL","aracaju":"SE",
        "são luís":"MA","teresina":"PI","vitória":"ES","campinas":"SP",
    }
    txt = titulo.lower()
    for nome, uf in estados.items():
        if nome in txt:
            return uf
    for cidade, uf in cidades.items():
        if cidade in txt:
            return uf
    # Sigla no título
    m = re.search(r"\b([A-Z]{2})\b", titulo)
    if m and m.group(1) in ufs:
        return m.group(1)
    return None


def _mapear_esfera(titulo: str) -> str:
    txt = titulo.lower()
    if any(p in txt for p in ["prefeitura","câmara municipal","câmara de ","procuradoria geral do município",
                               "procuradoria-geral do município","câmara de vereadores"]):
        return "municipal"
    if any(p in txt for p in ["tribunal de justiça","assembleia","ministério público do estado",
                               "ministério público estadual","procuradoria-geral do estado",
                               "secretaria de estado","tribunal de contas","defensoria pública",
                               "polícia civil","polícia militar","corpo de bombeiros",
                               "governo do estado","companhia de saneamento"]):
        return "estadual"
    if "ministério público" in txt:
        nomes_estados = ["acre","alagoas","amapá","amazonas","bahia","ceará","espírito santo",
                         "goiás","maranhão","mato grosso","minas gerais","pará","paraíba",
                         "paraná","pernambuco","piauí","rio de janeiro","rio grande",
                         "rondônia","roraima","santa catarina","são paulo","sergipe","tocantins"]
        if any(e in txt for e in nomes_estados):
            return "estadual"
    if any(p in txt for p in ["federal","receita","banco do brasil","caixa","petrobras",
                               "ministério","senado","tribunal superior","cnj"]):
        return "federal"
    return "nao_identificada"


def _mapear_area(titulo: str) -> str:
    txt = titulo.lower()
    mapa = {
        "fiscal_tributaria":  ["fiscal","receita","fazenda","tributar","sefaz","tribunal de contas"],
        "seguranca_publica":  ["polícia","bombeiro","penal","guarda","soldado"],
        "saude":              ["saúde","médico","enfermeiro","hospital","sesau","saneamento"],
        "educacao":           ["educação","professor","escola","magistério","seduc"],
        "tecnologia":         ["tecnologia","informática","ti ","dados"],
        "juridica":           ["tribunal","ministério público","procuradoria","juiz","defensor","promotor"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


def _extrair_url_real_pdf(href: str) -> str:
    """
    A FCC usa um viewer: /rybena/web/index.html?file=URL_REAL_DO_PDF
    Extrai a URL real do PDF do parâmetro ?file=
    """
    if "?file=" in href:
        params = parse_qs(urlparse(href).query)
        file_param = params.get("file", [""])[0]
        if file_param:
            return unquote(file_param)
    return href if href.startswith("http") else urljoin(BASE_URL, href)


def _raspar_links_listagem(soup: BeautifulSoup) -> list[dict]:
    """Extrai pares (órgão, cargo, url) da página de listagem."""
    itens = []
    divs = soup.find_all("div", class_=lambda c: c and ("textoInstituicao2" in c or "textoInstituicao" in c))

    for div_inst in divs:
        orgao = div_inst.get_text(strip=True)
        if not orgao or len(orgao) < 3:
            continue

        # Div do concurso vem logo após
        div_conc = div_inst.find_next_sibling("div")
        if not div_conc:
            continue

        a = div_conc.find("a", href=True)
        if not a:
            continue

        titulo = a.get_text(strip=True)
        href   = a.get("href", "")
        url    = urljoin(BASE_URL, href)

        # Ignora exames e vestibulares
        titulo_lower = titulo.lower()
        if any(ig in titulo_lower for ig in IGNORAR_TITULOS):
            continue

        itens.append({"orgao": orgao, "titulo": titulo, "url": url})

    return itens


def _raspar_detalhe(http: httpx.Client, url: str) -> dict:
    resultado = {
        "status": "aberto",
        "data_abertura": None,
        "data_encerramento": None,
        "total_vagas": 0,
        "links_pdf": [],
    }

    soup = _get(http, url)
    if not soup:
        return resultado

    # Status (produto só aceita aberto/encerrado/suspenso/previsto — sem "em_andamento")
    opcao = soup.select_one("#opcaoConcursos")
    if opcao:
        txt = opcao.get_text(strip=True).lower()
        if "inscrições abertas" in txt:
            resultado["status"] = "aberto"
        else:
            resultado["status"] = "encerrado"

    # Datas — procura em #comunicacao e em todo o texto da página
    comunicacao = soup.select_one("#comunicacao")
    texto_pagina = soup.get_text(" ")
    datas = []
    for m in re.finditer(r"(\d{2}/\d{2}/\d{4})", texto_pagina):
        d = _parse_data(m.group(1))
        if d:
            datas.append(d)
    if datas:
        hoje = date.today()
        # Filtra datas razoáveis (entre 5 anos atrás e 3 anos à frente)
        from datetime import timedelta
        datas_validas = [d for d in set(datas)
                         if (hoje - timedelta(days=365*5)) <= d <= (hoje + timedelta(days=365*3))]
        if len(datas_validas) >= 2:
            datas_ordenadas = sorted(datas_validas)
            resultado["data_abertura"]     = datas_ordenadas[0]
            resultado["data_encerramento"] = datas_ordenadas[-1]
        elif len(datas_validas) == 1:
            resultado["data_encerramento"] = datas_validas[0]

    # Vagas
    m_vagas = re.search(r"([\d.,]+)\s*(?:vagas?|cargos?)", texto_pagina, re.IGNORECASE)
    if m_vagas:
        try:
            resultado["total_vagas"] = int(m_vagas.group(1).replace(".", "").replace(",", ""))
        except ValueError:
            pass

    # PDFs — div.campoLinkArquivo a
    # Ignora links de inscrição e portal do candidato
    IGNORAR_HREFS = ["portal_candidato", "portal-candidato", "inscricao", "inscrição"]
    IGNORAR_TEXTOS = ["inscrição via internet", "inscrição online", "portal do candidato",
                      "geração de boleto", "clique aqui para se inscrever"]
    for div in soup.select("div.campoLinkArquivo"):
        for a in div.find_all("a", href=True):
            href  = a.get("href", "")
            texto = a.get_text(strip=True)
            if not texto or len(texto) < 3:
                continue
            # Ignora links de inscrição
            href_lower  = href.lower()
            texto_lower = texto.lower()
            if any(ig in href_lower for ig in IGNORAR_HREFS):
                continue
            if any(ig in texto_lower for ig in IGNORAR_TEXTOS):
                continue
            url_pdf = _extrair_url_real_pdf(href)
            if not any(l["url"] == url_pdf for l in resultado["links_pdf"]):
                resultado["links_pdf"].append({"titulo": texto[:200], "url": url_pdf})

    return resultado


class FCCScraper:
    BANCA = "FCC"

    def __init__(self, http: httpx.Client):
        self.http = http

    def _scrape_pagina(self, url_listagem: str) -> list[dict]:
        soup = _get(self.http, url_listagem)
        if not soup:
            return []
        return _raspar_links_listagem(soup)

    def scrape(self) -> list[dict]:
        log.info("[FCC] Buscando listagem...")

        # Pega inscrições abertas e novos
        itens_abertos = self._scrape_pagina(URL_LISTAGEM_ABERTOS)
        itens_novos   = self._scrape_pagina(URL_LISTAGEM_NOVOS)

        # Deduplica por URL
        vistos: set[str] = set()
        itens: list[dict] = []
        for item in itens_abertos + itens_novos:
            if item["url"] not in vistos:
                vistos.add(item["url"])
                itens.append(item)

        log.info(f"[FCC] {len(itens)} concursos encontrados")

        concursos = []
        for item in itens:
            detalhe = _raspar_detalhe(self.http, item["url"])
            time.sleep(DELAY)

            orgao  = item["orgao"][:150]
            titulo = item["titulo"][:200]

            concursos.append({
                "banca":             self.BANCA,
                "orgao":             orgao,
                "titulo":            titulo,
                "esfera":            _mapear_esfera(orgao + " " + titulo),
                "estado":            _extrair_uf(orgao + " " + titulo),
                "area_conhecimento": _mapear_area(orgao + " " + titulo),
                "status":            detalhe["status"],
                "total_vagas":       detalhe["total_vagas"],
                "data_abertura":     detalhe["data_abertura"],
                "data_encerramento": detalhe["data_encerramento"],
                "fonte_url":         item["url"],
                "links_pdf":         detalhe["links_pdf"],
                "descricao":         None,
            })

            log.info(
                f"  + {orgao[:50]} | "
                f"{_extrair_uf(orgao + titulo) or 'BR'} | "
                f"{detalhe['total_vagas']}v | "
                f"{len(detalhe['links_pdf'])} PDFs"
            )

        log.info(f"[FCC] Total: {len(concursos)} concursos")
        return concursos


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with httpx.Client(follow_redirects=True, timeout=20) as http:
        scraper   = FCCScraper(http)
        concursos = scraper.scrape()

    print(f"\n{'='*60}")
    print(f"Total: {len(concursos)} concursos")
    print(f"{'='*60}")
    for c in concursos:
        print(f"\n  {c['orgao'][:60]}")
        print(f"  Esfera: {c['esfera']} | Estado: {c['estado'] or 'Nacional'}")
        print(f"  Status: {c['status']} | Vagas: {c['total_vagas']}")
        print(f"  Inscrições: {c['data_abertura']} → {c['data_encerramento']}")
        print(f"  PDFs: {len(c['links_pdf'])}")
        for pdf in c["links_pdf"][:3]:
            print(f"    - {pdf['titulo'][:60]}")
            print(f"      {pdf['url'][:80]}")

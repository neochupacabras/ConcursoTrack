"""
ConcursoTrack — Scraper IBFC
==============================
Estrutura identificada via diagnostico_banca.py:
  Listagem: div.panel.concurso → a[href*="/informacoes/"]
  Detalhe PDFs: #tab1 li.pdf a
  Datas: #blocoInformacoesGerais div.dados
  Título: #TopoInformacoes

Uso standalone: python scraper/ibfc.py
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

URL_LISTAGEM = "https://concursos.ibfc.org.br/index/abertos/"
BASE_URL     = "https://concursos.ibfc.org.br"
DELAY        = 1.2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
}


def _get(http: httpx.Client, url: str) -> Optional[BeautifulSoup]:
    try:
        r = http.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        # IBFC usa ISO-8859-1 — decodifica o conteúdo binário explicitamente
        texto = r.content.decode("iso-8859-1", errors="replace")
        return BeautifulSoup(texto, "html.parser")
    except Exception as e:
        log.warning(f"[IBFC] Erro {url}: {e}")
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
    txt = titulo.lower()
    for nome, uf in estados.items():
        if nome in txt:
            return uf
    return None


def _mapear_esfera(titulo: str) -> str:
    txt = titulo.lower()
    if any(p in txt for p in ["federal","ibge","receita","ministério","inss",
                               "dataprev","anatel","banco do brasil","caixa"]):
        return "federal"
    if any(p in txt for p in ["estadual","governo do estado","secretaria de estado",
                               "tribunal","assembleia","ministério público estadual",
                               "polícia civil","polícia militar","bombeiro"]):
        return "estadual"
    if any(p in txt for p in ["prefeitura","câmara municipal","municipal"]):
        return "municipal"
    return "nao_identificada"


def _mapear_area(titulo: str) -> str:
    txt = titulo.lower()
    mapa = {
        "fiscal_tributaria":  ["fiscal","receita","fazenda","tributar","sefaz","auditor"],
        "seguranca_publica":  ["polícia","bombeiro","penal","guarda","soldado","militar"],
        "saude":              ["saúde","médico","enfermeiro","hospital","sesau"],
        "educacao":           ["educação","professor","seduc","escola","magistério"],
        "tecnologia":         ["tecnologia","informática","ti ","dataprev"],
        "juridica":           ["tribunal","ministério público","procuradoria","juiz","defensor"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


def _raspar_detalhe(http: httpx.Client, url: str) -> dict:
    resultado = {
        "titulo": "",
        "orgao": "",
        "links_pdf": [],
        "data_abertura": None,
        "data_encerramento": None,
        "total_vagas": 0,
        "descricao": None,
    }

    soup = _get(http, url)
    if not soup:
        return resultado

    # Título e órgão — extrai separando por tags, não por texto concatenado
    topo = soup.select_one("#TopoInformacoes")
    if topo:
        # Remove botões e links (ex: "Inscrever-se") antes de extrair texto
        for tag in topo.select("a, button, .btn, input"):
            tag.decompose()
        textos = []
        for tag in topo.find_all(["h1","h2","h3","p","strong","span"]):
            txt = tag.get_text(strip=True)
            # Ignora textos muito curtos ou que são labels de campo
            if txt and len(txt) > 5 and txt not in textos:
                textos.append(txt)
        if textos:
            resultado["titulo"] = textos[0][:200]
            # Órgão: primeiro texto que parece nome de instituição (sem verbos)
            for txt in textos:
                if not any(v in txt.lower() for v in ["inscrições", "período", "edital nº",
                                                        "processo", "concurso público"]):
                    resultado["orgao"] = txt[:150]
                    break
            if not resultado["orgao"] and textos:
                resultado["orgao"] = textos[0][:150]

    # Datas — #blocoInformacoesGerais
    bloco_info = soup.select_one("#blocoInformacoesGerais")
    if bloco_info:
        texto_info = bloco_info.get_text(" ", strip=True)
        # Padrão: "Inscrições: 12/06/2026 10:00 a 09/07/2026 14:00"
        datas = re.findall(r"(\d{2}/\d{2}/\d{4})", texto_info)
        if len(datas) >= 2:
            resultado["data_abertura"]     = _parse_data(datas[0])
            resultado["data_encerramento"] = _parse_data(datas[1])
        elif len(datas) == 1:
            resultado["data_encerramento"] = _parse_data(datas[0])

        # Vagas
        m_vagas = re.search(r"([\d.,]+)\s*vaga", texto_info, re.IGNORECASE)
        if m_vagas:
            try:
                resultado["total_vagas"] = int(m_vagas.group(1).replace(".", "").replace(",", ""))
            except ValueError:
                pass

    # PDFs — #tab1 li.pdf a
    tab1 = soup.select_one("#tab1")
    if tab1:
        for li in tab1.select("li.pdf"):
            a = li.find("a", href=True)
            if not a:
                continue
            href  = a.get("href", "")
            texto = a.get_text(strip=True)
            # Remove data colada no final: "Retificação nº 0103/07/2026" → "Retificação nº 01"
            texto_limpo = re.sub(r"\d{2}/\d{2}/\d{4}.*$", "", texto).strip()
            # Remove espaços e zeros soltos no final
            texto_limpo = re.sub(r"\s*\d{0,2}\s*$", "", texto_limpo).strip()
            if href and texto_limpo and len(texto_limpo) > 2:
                url_pdf = href if href.startswith("http") else urljoin(BASE_URL, href)
                resultado["links_pdf"].append({"titulo": texto_limpo[:200], "url": url_pdf})

    return resultado


class IBFCScraper:
    BANCA = "IBFC"

    def __init__(self, http: httpx.Client):
        self.http = http

    def scrape(self) -> list[dict]:
        log.info("[IBFC] Buscando listagem...")
        soup = _get(self.http, URL_LISTAGEM)
        if not soup:
            return []

        # Cada concurso é um div.panel.concurso
        cards = soup.select("div.panel.concurso")
        log.info(f"[IBFC] {len(cards)} concursos encontrados")

        concursos = []
        for card in cards:
            # Link para a página de detalhes
            a = card.select_one("a[href*='/informacoes/']")
            if not a:
                continue
            url_detalhe = urljoin(BASE_URL, a.get("href", ""))

            detalhe = _raspar_detalhe(self.http, url_detalhe)
            time.sleep(DELAY)

            if not detalhe["orgao"]:
                continue

            concursos.append({
                "banca":             self.BANCA,
                "orgao":             detalhe["orgao"],
                "titulo":            detalhe["titulo"] or detalhe["orgao"],
                "esfera":            _mapear_esfera(detalhe["orgao"] + " " + detalhe["titulo"]),
                "estado":            _extrair_uf(detalhe["orgao"] + " " + detalhe["titulo"]),
                "area_conhecimento": _mapear_area(detalhe["orgao"] + " " + detalhe["titulo"]),
                "status":            "aberto",
                "total_vagas":       detalhe["total_vagas"],
                "data_abertura":     detalhe["data_abertura"],
                "data_encerramento": detalhe["data_encerramento"],
                "fonte_url":         url_detalhe,
                "links_pdf":         detalhe["links_pdf"],
                "descricao":         None,
            })

            log.info(
                f"  + {detalhe['orgao'][:50]} | "
                f"{detalhe['total_vagas']}v | "
                f"{_extrair_uf(detalhe['orgao']) or 'BR'} | "
                f"{len(detalhe['links_pdf'])} PDFs"
            )

        log.info(f"[IBFC] Total: {len(concursos)} concursos")
        return concursos


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    with httpx.Client(follow_redirects=True, timeout=20) as http:
        scraper   = IBFCScraper(http)
        concursos = scraper.scrape()

    print(f"\n{'='*60}")
    print(f"Total: {len(concursos)} concursos")
    print(f"{'='*60}")
    for c in concursos:
        print(f"\n  {c['orgao'][:60]}")
        print(f"  Esfera: {c['esfera']} | Estado: {c['estado'] or 'Nacional'}")
        print(f"  Vagas: {c['total_vagas']} | Inscrições: {c['data_abertura']} → {c['data_encerramento']}")
        print(f"  PDFs: {len(c['links_pdf'])}")
        for pdf in c["links_pdf"]:
            print(f"    - {pdf['titulo'][:60]}")
            print(f"      {pdf['url'][:80]}")

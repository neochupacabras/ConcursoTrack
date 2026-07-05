"""
ConcursoTrack — Scraper Instituto Avalia
==============================================
O site novo (avalia.org.br/concursos/status/...) é uma SPA — o conteúdo é carregado
via JS e não aparece no HTML estático (confirmado: diagnóstico voltou com a tabela
vazia, zero links de concurso). Por isso usamos o site legado, que ainda está no ar
e é renderizado no servidor (JSP, sem JavaScript):

  Listagem: https://www2.avalia.org.br/concursos.jsp — página única com TODOS os
            concursos (não paginada). Cada item é um heading com link
            <a href="concurso.jsp?id=N">Nome do Órgão</a> seguido de um parágrafo
            com o status mais recente do concurso (ex: "INSCRIÇÕES ABERTAS",
            "Divulgado o Edital de Homologação...", "Breve, divulgação do Edital").
            Não há abas/filtros reais — os botões "Filtrar" no topo são só
            client-side; classificamos o status pelo texto de cada item.
  Detalhe:  https://www2.avalia.org.br/concurso.jsp?id=N
            - Heading com nome do órgão + parágrafo de descrição
            - Seção "LINKS" → ações do candidato (formulário de inscrição, portal de
              consulta) — NÃO são PDFs públicos, ignorar
            - Seção "PUBLICAÇÕES" → os PDFs reais (editais), cada item como
              "DD/MM/YYYY - Título do documento" apontando pra
              arquivos-site.avalia.org.br/publicacoes/{uuid}.pdf
            - Seção "Tabela de cargos/cursos" → um item por cargo com "Vagas : N"
  Encoding: ISO-8859-1

Uso standalone: python scraper/avalia.py
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

BASE_URL     = "https://www2.avalia.org.br"
URL_LISTAGEM = f"{BASE_URL}/concursos.jsp"
DELAY        = 1.2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# Indica que o status já não é mais útil pro produto (concurso encerrado/finalizado)
PADROES_FINALIZADO = [
    "homologa", "resultado final", "classificação final", "classificacao final",
    "aprovados", "portaria de resultado",
]
# Indica que ainda não abriu (não é útil ainda — nada pra mostrar/baixar)
PADROES_FUTURO = ["breve, divulgação", "breve, divulgacao", "previsto", "autorizado"]
# Indica cancelamento/suspensão
PADROES_PARADO = ["suspens", "cancelad"]
# Badge explícito de inscrições abertas
PADROES_ABERTO = ["inscrições abertas", "inscricoes abertas", "inscrição aberta", "inscricao aberta"]


def _get(http: httpx.Client, url: str) -> Optional[BeautifulSoup]:
    try:
        r = http.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        texto = r.content.decode("iso-8859-1", errors="replace")
        return BeautifulSoup(texto, "html.parser")
    except Exception as e:
        log.warning(f"[Avalia] Erro {url}: {e}")
        return None


def _parse_data(texto: str) -> Optional[date]:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", texto)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


def _classificar_status(descricao: str) -> Optional[str]:
    """Retorna 'aberto', 'em_andamento', ou None (não é útil — pula esse concurso)."""
    txt = descricao.lower()
    if any(p in txt for p in PADROES_ABERTO):
        return "aberto"
    if any(p in txt for p in PADROES_FUTURO):
        return None
    if any(p in txt for p in PADROES_PARADO):
        return None
    if any(p in txt for p in PADROES_FINALIZADO):
        return None
    return "em_andamento"


def _raspar_listagem(soup: BeautifulSoup) -> list[dict]:
    """
    Cada card é um heading (h1-h6) com <a href="concurso.jsp?id=N">Órgão</a>,
    seguido de um elemento irmão com o texto de status. Usa essa relação
    heading -> próximo irmão em vez de depender de classes CSS específicas.
    """
    itens = []
    vistos = set()

    for a in soup.find_all("a", href=re.compile(r"concurso\.jsp\?id=\d+")):
        m = re.search(r"id=(\d+)", a["href"])
        if not m:
            continue
        cid = m.group(1)
        if cid in vistos:
            continue

        orgao = a.get_text(strip=True)
        if not orgao or len(orgao) < 3:
            continue

        heading = a.find_parent(["h1", "h2", "h3", "h4", "h5", "h6"])
        descricao = ""
        if heading:
            prox = heading.find_next_sibling()
            tentativas = 0
            while prox and tentativas < 3:
                texto = prox.get_text(" ", strip=True)
                if texto:
                    descricao = texto
                    break
                prox = prox.find_next_sibling()
                tentativas += 1

        vistos.add(cid)
        itens.append({
            "id": cid,
            "orgao": orgao,
            "descricao": descricao,
            "url": urljoin(BASE_URL, f"/concurso.jsp?id={cid}"),
        })

    return itens


def _raspar_detalhe(http: httpx.Client, url: str) -> dict:
    resultado = {
        "links_pdf": [],
        "total_vagas": 0,
        "data_abertura": None,
        "data_encerramento": None,
    }

    soup = _get(http, url)
    if not soup:
        return resultado

    texto_pagina = soup.get_text(" ")

    # PDFs reais (edital, anexos, retificações) — varre a página inteira em vez de
    # depender de achar a seção "PUBLICAÇÕES" por heading (essa abordagem falhou no
    # teste real: a estrutura da página não usa h1-h6 pra esse título). Como só a
    # seção de publicações tem links terminando em .pdf (a seção "LINKS" aponta pra
    # link.avalia.org.br/open?chave=..., sem .pdf), isso já filtra corretamente.
    datas_pub = []
    vistos_arquivo = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if ".pdf" not in href.lower():
            continue
        texto = a.get_text(" ", strip=True)
        if not texto:
            continue

        # Dedupe pelo caminho/nome do arquivo, não pela URL completa — a página pode
        # renderizar o mesmo link duas vezes (ex: versões mobile/desktop) com query
        # strings de rastreamento diferentes, o que faria o mesmo PDF contar mais de
        # uma vez se comparássemos a URL inteira.
        chave_arquivo = re.sub(r"\?.*$", "", href).rstrip("/").rsplit("/", 1)[-1].lower()
        if chave_arquivo in vistos_arquivo:
            continue
        vistos_arquivo.add(chave_arquivo)

        m_data = re.match(r"(\d{2}/\d{2}/\d{4})\s*-\s*(.+)", texto)
        if m_data:
            data_doc, titulo_doc = m_data.group(1), m_data.group(2)
            d = _parse_data(data_doc)
            if d:
                datas_pub.append(d)
        else:
            titulo_doc = texto
        href_abs = href if href.startswith("http") else urljoin(BASE_URL, href)
        resultado["links_pdf"].append({"titulo": titulo_doc[:200], "url": href_abs})

    if datas_pub:
        resultado["data_abertura"] = min(datas_pub)

    # Vagas — soma "Vagas : N" de cada cargo na "Tabela de cargos/cursos"
    total = 0
    achou = False
    for m in re.finditer(r"Vagas\s*:\s*([\d.,]+)", texto_pagina, re.IGNORECASE):
        try:
            total += int(m.group(1).replace(".", "").replace(",", ""))
            achou = True
        except ValueError:
            pass
    if achou:
        resultado["total_vagas"] = total

    # Data de encerramento — prazo do formulário de inscrição (seção LINKS)
    m_prazo = re.search(
        r"Formul[áa]rio de Solicita[çc][ãa]o de Inscri[çc][ãa]o.*?dia\s*(\d{2}/\d{2}/\d{4})",
        texto_pagina, re.IGNORECASE | re.DOTALL,
    )
    if m_prazo:
        resultado["data_encerramento"] = _parse_data(m_prazo.group(1))

    return resultado


def _extrair_uf(titulo: str) -> Optional[str]:
    ufs = {"AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
           "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"}

    for m in re.finditer(r"[/\-]\s*([A-Z]{2})\b", titulo):
        if m.group(1) in ufs:
            return m.group(1)

    estados = {
        "acre": "AC", "alagoas": "AL", "amazonas": "AM", "amapá": "AP", "bahia": "BA",
        "ceará": "CE", "distrito federal": "DF", "espírito santo": "ES", "goiás": "GO",
        "maranhão": "MA", "mato grosso do sul": "MS", "mato grosso": "MT",
        "minas gerais": "MG", "pará": "PA", "paraíba": "PB", "paraná": "PR",
        "pernambuco": "PE", "piauí": "PI", "rio de janeiro": "RJ",
        "rio grande do norte": "RN", "rio grande do sul": "RS", "rondônia": "RO",
        "roraima": "RR", "santa catarina": "SC", "são paulo": "SP", "sergipe": "SE",
        "tocantins": "TO",
    }
    cidades = {
        "manaus": "AM", "belém": "PA", "fortaleza": "CE", "salvador": "BA",
        "recife": "PE", "porto alegre": "RS", "curitiba": "PR", "florianópolis": "SC",
        "goiânia": "GO", "campo grande": "MS", "cuiabá": "MT", "porto velho": "RO",
        "boa vista": "RR", "rio branco": "AC", "macapá": "AP", "palmas": "TO",
        "natal": "RN", "joão pessoa": "PB", "maceió": "AL", "aracaju": "SE",
        "são luís": "MA", "teresina": "PI", "vitória": "ES", "campinas": "SP",
        "niterói": "RJ", "joinville": "SC", "maringá": "PR",
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
    if any(p in txt for p in ["prefeitura", "câmara municipal", "câmara de ", "consórcio intermunicipal",
                               "procuradoria geral do município", "procuradoria-geral do município",
                               "câmara de vereadores", "autarquia municipal", "instituto de previdência",
                               "fundação da seguridade social dos servidores"]):
        return "municipal"
    if "distrito federal" in txt or re.search(r"\bdf\b", txt):
        return "estadual"
    if any(p in txt for p in ["tribunal de justiça", "assembleia", "ministério público do estado",
                               "ministério público estadual", "procuradoria-geral do estado",
                               "procuradoria geral do estado", "secretaria de estado", "tribunal de contas",
                               "defensoria pública", "polícia civil", "polícia militar", "corpo de bombeiros",
                               "governo do estado", "conselho regional", "agência reguladora",
                               "universidade estadual"]):
        return "estadual"
    if any(p in txt for p in ["federal", "receita", "banco do brasil", "caixa", "petrobras",
                               "ministério", "senado", "tribunal superior", "cnj", "trf",
                               "ibge", "universidade federal", "ebserh"]):
        return "federal"
    return "nao_identificada"


def _mapear_area(titulo: str) -> str:
    txt = titulo.lower()
    mapa = {
        "fiscal_tributaria": ["fiscal", "receita", "fazenda", "tributar", "sefaz", "tribunal de contas"],
        "seguranca_publica": ["polícia", "bombeiro", "penal", "guarda", "soldado", "socioeducativa"],
        "saude": ["saúde", "médico", "enfermeiro", "hospital", "hemope", "hemobrás", "hospitalar"],
        "educacao": ["educação", "professor", "escola", "magistério", "pedagógico", "seduc"],
        "tecnologia": ["tecnologia", "informática", "ti ", "dados"],
        "juridica": ["tribunal", "ministério público", "procuradoria", "juiz", "defensor", "promotor"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


class AvaliaScraper:
    BANCA = "Instituto Avalia"

    def __init__(self, http: httpx.Client):
        self.http = http

    def scrape(self) -> list[dict]:
        log.info("[Avalia] Buscando listagem...")
        soup = _get(self.http, URL_LISTAGEM)
        if not soup:
            return []

        itens_brutos = _raspar_listagem(soup)
        log.info(f"[Avalia] {len(itens_brutos)} concursos encontrados na listagem (todos os status)")

        concursos = []
        ignorados = 0

        for item in itens_brutos:
            status_interno = _classificar_status(item["descricao"])
            if not status_interno:
                ignorados += 1
                continue

            detalhe = _raspar_detalhe(self.http, item["url"])
            time.sleep(DELAY)

            orgao = item["orgao"][:150]
            titulo = orgao

            # O produto (frontend) só reconhece aberto/previsto/encerrado — não existe
            # "em_andamento" como status real. Mapeia pra "encerrado" só no campo
            # salvo (fica fora da busca padrão, mas continua no banco).
            status_final = "encerrado" if status_interno == "em_andamento" else status_interno

            concursos.append({
                "banca":             self.BANCA,
                "orgao":             orgao,
                "titulo":            titulo,
                "esfera":            _mapear_esfera(orgao),
                "estado":            _extrair_uf(orgao),
                "area_conhecimento": _mapear_area(orgao),
                "status":            status_final,
                "total_vagas":       detalhe["total_vagas"],
                "data_abertura":     detalhe["data_abertura"],
                "data_encerramento": detalhe["data_encerramento"],
                "fonte_url":         item["url"],
                "links_pdf":         detalhe["links_pdf"],
                "descricao":         item["descricao"][:500] if item["descricao"] else None,
            })

            log.info(
                f"  + {orgao[:50]} | "
                f"{_extrair_uf(orgao) or 'BR'} | "
                f"{status_interno} (salvo como: {status_final}) | "
                f"{detalhe['total_vagas']} vagas | "
                f"{len(detalhe['links_pdf'])} PDFs"
            )

        log.info(
            f"[Avalia] Total: {len(concursos)} concursos salvos "
            f"({ignorados} ignorados por status finalizado/futuro/suspenso)"
        )
        return concursos


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with httpx.Client(follow_redirects=True, timeout=20) as http:
        scraper   = AvaliaScraper(http)
        concursos = scraper.scrape()

    print(f"\n{'='*60}")
    print(f"Total: {len(concursos)} concursos")
    print(f"{'='*60}")
    for c in concursos[:10]:
        print(f"\n  {c['orgao'][:60]}")
        print(f"  Esfera: {c['esfera']} | Estado: {c['estado'] or 'Nacional'}")
        print(f"  Status: {c['status']} | Vagas: {c['total_vagas']}")
        print(f"  Inscrições: {c['data_abertura']} → {c['data_encerramento']}")
        print(f"  PDFs: {len(c['links_pdf'])}")
        for pdf in c["links_pdf"][:3]:
            print(f"    - {pdf['titulo'][:60]}")
            print(f"      {pdf['url'][:80]}")

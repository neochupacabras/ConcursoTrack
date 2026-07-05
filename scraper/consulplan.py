"""
ConcursoTrack — Scraper Instituto Consulplan
==============================================
Estrutura identificada via diagnostico_banca.py:
  Listagem: div.card.custom-card (card-body com título + botão "Mais Informações")
            URL: https://www.institutoconsulplan.org.br/Concursos (página única, sem paginação)
  Detalhe:  table.table-hover → linhas com editais/PDFs
            PDFs reais em cdnsite.institutoconsulplan.org.br
            (links "Acompanhamento de Inscrição" / "Consulta individual" apontam para
             concurso4.institutoconsulplan.org.br e resultado4.institutoconsulplan.org.br
             — portal do candidato, devem ser ignorados)
  Encoding: utf-8

Uso standalone: python scraper/consulplan.py
"""

import re
import copy
import time
import logging
from datetime import date, timedelta
from typing import Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

BASE_URL       = "https://www.institutoconsulplan.org.br"
URL_LISTAGEM   = f"{BASE_URL}/Concursos"
DELAY          = 1.2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

# Domínios que NÃO são PDFs reais (portal do candidato)
DOMINIOS_IGNORAR_PDF = ["concurso4.institutoconsulplan.org.br", "resultado4.institutoconsulplan.org.br"]

# Palavras que marcam onde termina o nome do órgão e começa o tipo de seleção
MARCADORES_TIPO = [
    "concurso público", "processo seletivo simplificado", "processo seletivo público",
    "processo seletivo", "seleção pública", "vestibular", "residência",
    "exame de qualificação", "pss",
]

# Ignora vestibulares e exames (fora do escopo de concursos públicos)
IGNORAR_TITULOS = ["vestibular", "exame de qualificação"]


def _get(http: httpx.Client, url: str) -> Optional[BeautifulSoup]:
    try:
        r = http.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        texto = r.content.decode("utf-8", errors="replace")
        return BeautifulSoup(texto, "html.parser")
    except Exception as e:
        log.warning(f"[Consulplan] Erro {url}: {e}")
        return None


def _parse_data(texto: str) -> Optional[date]:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", texto)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


def _texto_sem_links(tag) -> str:
    """Retorna o texto de uma tag, ignorando o conteúdo de qualquer <a> dentro dela
    (usado para separar o título do concurso dos textos dos botões)."""
    clone = BeautifulSoup(str(tag), "html.parser")
    for a in clone.find_all("a"):
        a.decompose()
    return clone.get_text(" ", strip=True)


def _separar_orgao_titulo(texto_completo: str) -> tuple[str, str]:
    """
    A Consulplan concatena órgão + tipo de seleção num único bloco de texto, ex:
    "Tribunal de Justiça de Mato Grosso do Sul - TJMS II Processo Seletivo Unificado - Juiz Leigo"
    Tenta separar órgão (antes do marcador) do texto completo (usado como título).
    """
    txt_lower = texto_completo.lower()
    pos_menor = len(texto_completo)
    for marcador in MARCADORES_TIPO:
        idx = txt_lower.find(marcador)
        if idx != -1 and idx < pos_menor:
            pos_menor = idx
    if pos_menor < len(texto_completo):
        orgao = texto_completo[:pos_menor].strip(" -–")
    else:
        orgao = texto_completo
    return orgao or texto_completo, texto_completo


def _rotulo_secao(card) -> str:
    """
    A listagem da Consulplan agrupa os cards em containers 'concursos-grid',
    cada um com um rótulo no início (ex: "Inscrições abertas / Novos", "Em andamento").
    Como não existe seção de "encerrados" visível, presença numa dessas seções já
    indica que o próprio site considera o concurso ativo — mais confiável que
    tentar inferir status por datas soltas no texto da página de detalhe.
    """
    grid = card.find_parent("div", class_=lambda c: c and "concursos-grid" in c)
    if not grid:
        return "desconhecido"
    texto = grid.get_text(" ", strip=True)[:80].lower()
    if "em andamento" in texto:
        return "em_andamento"
    if "abert" in texto or "novo" in texto:
        return "aberto"
    if "encerrado" in texto:
        return "encerrado"
    return "desconhecido"


def _raspar_links_listagem(soup: BeautifulSoup) -> list[dict]:
    """Extrai (orgao, titulo, url, status_lista) de cada card na página de listagem."""
    itens = []
    cards = soup.find_all("div", class_=lambda c: c and "custom-card" in c)

    for card in cards:
        card_body = card.find("div", class_=lambda c: c and "card-body" in c) or card

        # Link "Mais Informações" — a página do edital em si
        link_detalhe = None
        for a in card.find_all("a", href=True):
            texto_link = a.get_text(strip=True).lower()
            href = a.get("href", "")
            if "mais informa" in texto_link and BASE_URL in urljoin(BASE_URL, href):
                if "concurso4" not in href and "resultado4" not in href:
                    link_detalhe = urljoin(BASE_URL, href)
                    break

        if not link_detalhe:
            continue

        texto_completo = _texto_sem_links(card_body)
        if not texto_completo or len(texto_completo) < 5:
            continue

        titulo_lower = texto_completo.lower()
        if any(ig in titulo_lower for ig in IGNORAR_TITULOS):
            continue

        orgao, titulo = _separar_orgao_titulo(texto_completo)
        status_lista = _rotulo_secao(card)
        itens.append({"orgao": orgao, "titulo": titulo, "url": link_detalhe, "status_lista": status_lista})

    return itens


def _raspar_detalhe(http: httpx.Client, url: str) -> dict:
    resultado = {
        "status_por_data": None,
        "data_abertura": None,
        "data_encerramento": None,
        "total_vagas": 0,
        "links_pdf": [],
    }

    soup = _get(http, url)
    if not soup:
        return resultado

    texto_pagina = soup.get_text(" ")

    # Datas — varre todo o texto da página e pega a janela plausível
    datas = []
    for m in re.finditer(r"(\d{2}/\d{2}/\d{4})", texto_pagina):
        d = _parse_data(m.group(1))
        if d:
            datas.append(d)
    if datas:
        hoje = date.today()
        datas_validas = [d for d in set(datas)
                         if (hoje - timedelta(days=365 * 5)) <= d <= (hoje + timedelta(days=365 * 3))]
        if len(datas_validas) >= 2:
            datas_ordenadas = sorted(datas_validas)
            resultado["data_abertura"] = datas_ordenadas[0]
            resultado["data_encerramento"] = datas_ordenadas[-1]
        elif len(datas_validas) == 1:
            resultado["data_encerramento"] = datas_validas[0]

    # Status por data — usado só como FALLBACK quando a listagem não deu um rótulo confiável
    # (inscrições fechadas não significam concurso encerrado — pode estar em fase de prova/resultado)
    if resultado["data_encerramento"]:
        resultado["status_por_data"] = "aberto" if resultado["data_encerramento"] >= date.today() else "em_andamento"

    # Vagas
    m_vagas = re.search(r"([\d.,]+)\s*(?:vagas?|cargos?)", texto_pagina, re.IGNORECASE)
    if m_vagas:
        try:
            resultado["total_vagas"] = int(m_vagas.group(1).replace(".", "").replace(",", ""))
        except ValueError:
            pass

    # PDFs — apenas links reais em cdnsite.institutoconsulplan.org.br (ignora portal do candidato)
    for tabela in soup.select("table.table-hover, table"):
        for a in tabela.find_all("a", href=True):
            href = a.get("href", "")
            texto = a.get_text(strip=True)
            if not texto or len(texto) < 3:
                continue
            if any(dom in href for dom in DOMINIOS_IGNORAR_PDF):
                continue
            if not href.startswith("http"):
                href = urljoin(BASE_URL, href)
            if not any(l["url"] == href for l in resultado["links_pdf"]):
                resultado["links_pdf"].append({"titulo": texto[:200], "url": href})

    return resultado


def _extrair_uf(titulo: str) -> Optional[str]:
    ufs = {"AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
           "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"}

    # Prioridade máxima: padrão explícito "Cidade/UF" (ex: "Ji-Paraná/RO"), como a
    # Consulplan sempre escreve. Evita falso positivo de cidades cujo nome contém o
    # nome de outro estado (ex: "Ji-Paraná" contém "Paraná" -> não pode virar PR).
    m_slash = re.search(r"/([A-Z]{2})\b", titulo)
    if m_slash and m_slash.group(1) in ufs:
        return m_slash.group(1)

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
        "angra dos reis": "RJ", "nova iguaçu": "RJ", "duque de caxias": "RJ",
        "niterói": "RJ",
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
                               "câmara de vereadores", "autarquia municipal", "instituto de previdência"]):
        return "municipal"
    if any(p in txt for p in ["tribunal de justiça", "assembleia", "ministério público do estado",
                               "ministério público estadual", "procuradoria-geral do estado",
                               "procuradoria geral do estado", "secretaria de estado", "tribunal de contas",
                               "defensoria pública", "polícia civil", "polícia militar", "corpo de bombeiros",
                               "governo do estado", "conselho regional", "agência reguladora"]):
        return "estadual"
    if "ministério público" in txt:
        nomes_estados = ["acre", "alagoas", "amapá", "amazonas", "bahia", "ceará", "espírito santo",
                          "goiás", "maranhão", "mato grosso", "minas gerais", "pará", "paraíba",
                          "paraná", "pernambuco", "piauí", "rio de janeiro", "rio grande",
                          "rondônia", "roraima", "santa catarina", "são paulo", "sergipe", "tocantins"]
        if any(e in txt for e in nomes_estados):
            return "estadual"
    if any(p in txt for p in ["federal", "receita", "banco do brasil", "caixa", "petrobras",
                               "ministério", "senado", "tribunal superior", "cnj", "trf", "hemobrás"]):
        return "federal"
    return "nao_identificada"


def _mapear_area(titulo: str) -> str:
    txt = titulo.lower()
    mapa = {
        "fiscal_tributaria": ["fiscal", "receita", "fazenda", "tributar", "sefaz", "tribunal de contas"],
        "seguranca_publica": ["polícia", "bombeiro", "penal", "guarda", "soldado"],
        "saude": ["saúde", "médico", "enfermeiro", "hospital", "hemobrás", "saneamento"],
        "educacao": ["educação", "professor", "escola", "magistério", "seed", "pedagógico"],
        "tecnologia": ["tecnologia", "informática", "ti ", "dados", "prodabel"],
        "juridica": ["tribunal", "ministério público", "procuradoria", "juiz", "defensor", "promotor"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


class ConsulplanScraper:
    BANCA = "Instituto Consulplan"

    def __init__(self, http: httpx.Client):
        self.http = http

    def scrape(self) -> list[dict]:
        log.info("[Consulplan] Buscando listagem...")
        soup = _get(self.http, URL_LISTAGEM)
        if not soup:
            return []

        itens = _raspar_links_listagem(soup)
        log.info(f"[Consulplan] {len(itens)} concursos encontrados na listagem")

        concursos = []
        ignorados_encerrados = 0

        for item in itens:
            detalhe = _raspar_detalhe(self.http, item["url"])
            time.sleep(DELAY)

            orgao  = item["orgao"][:150]
            titulo = item["titulo"][:200]

            # Status interno: prioriza o rótulo da seção na listagem (fonte do próprio
            # site — "Inscrições abertas / Novos" ou "Em andamento"). Só cai no
            # fallback por data quando a listagem não deu rótulo confiável.
            status_lista = item["status_lista"]
            if status_lista in ("aberto", "em_andamento"):
                status_interno = status_lista
            elif status_lista == "encerrado":
                # Site já classifica como genuinamente encerrado — não é útil, pula.
                ignorados_encerrados += 1
                continue
            else:
                status_interno = detalhe["status_por_data"] or "aberto"

            # O produto (frontend) só reconhece aberto/previsto/encerrado — não existe
            # "em_andamento" como status real. Mapeia pra "encerrado" só no campo
            # salvo (fica fora da busca padrão, mas continua no banco).
            status_final = "encerrado" if status_interno == "em_andamento" else status_interno

            concursos.append({
                "banca":             self.BANCA,
                "orgao":             orgao,
                "titulo":            titulo,
                "esfera":            _mapear_esfera(orgao + " " + titulo),
                "estado":            _extrair_uf(orgao + " " + titulo),
                "area_conhecimento": _mapear_area(orgao + " " + titulo),
                "status":            status_final,
                "total_vagas":       detalhe["total_vagas"],
                "data_abertura":     detalhe["data_abertura"],
                "data_encerramento": detalhe["data_encerramento"],
                "fonte_url":         item["url"],
                "links_pdf":         detalhe["links_pdf"],
                "descricao":         None,
            })

            log.info(
                f"  + {orgao[:50]} | "
                f"{_extrair_uf(orgao + ' ' + titulo) or 'BR'} | "
                f"{status_interno} (salvo como: {status_final}) | "
                f"{len(detalhe['links_pdf'])} PDFs"
            )

        log.info(
            f"[Consulplan] Total: {len(concursos)} concursos salvos "
            f"({ignorados_encerrados} ignorados por estarem encerrados)"
        )
        return concursos


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with httpx.Client(follow_redirects=True, timeout=20) as http:
        scraper   = ConsulplanScraper(http)
        concursos = scraper.scrape()

    print(f"\n{'='*60}")
    print(f"Total: {len(concursos)} concursos")
    print(f"{'='*60}")
    for c in concursos[:10]:
        print(f"\n  {c['orgao'][:60]}")
        print(f"  Esfera: {c['esfera']} | Estado: {c['estado'] or 'Nacional'}")
        print(f"  Status: {c['status']}")
        print(f"  Inscrições: {c['data_abertura']} → {c['data_encerramento']}")
        print(f"  PDFs: {len(c['links_pdf'])}")
        for pdf in c["links_pdf"][:3]:
            print(f"    - {pdf['titulo'][:60]}")
            print(f"      {pdf['url'][:80]}")

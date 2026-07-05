"""
ConcursoTrack — Scraper Quadrix
==============================================
Estrutura confirmada via fetch direto em 2026-07-05 (o diagnóstico original usava uma
URL de listagem que não existe mais — o domínio e a estrutura da listagem mudaram):

  Listagem: cada <li> tem vários links repetidos apontando pro mesmo /informacoes/{id}/
            - 1º link: ícone/decorativo (texto = o próprio path, ignorar)
            - texto solto: "Concurso Público" ou "Processo Seletivo" (tipo)
            - 2º link: nome do órgão (o único que não é um dos textos padrão conhecidos)
            - texto solto: "Edital nº X" + "Inscrições de DATA a DATA" + "Pedidos de Isenção..."
            - link "Inscrições Abertas!" (badge — só aparece se estiver realmente aberto)
            - link "Quantidade de Vagas N"
            - link "Mais Informações"
            Abas por status, cada uma paginada (?ord=&dir=&pg=N&q=&pp=10, 10 por página):
              /index/abertos/  → Inscrições Abertas
              /index/1/        → Em andamento
              /index/3/        → Encerrados   (ignorado — não é útil)
              /index/4/        → Suspenso     (ignorado)
              /index/6/        → Em breve     (ignorado — ainda não abriu)
  Detalhe:  #TopoInformacoes           → título
            #blocoInformacoesGerais div.dados → "Inscrições: dd/mm/yyyy hh:mm a dd/mm/yyyy hh:mm"
            li.pdf a                  → PDFs (anexos.cdn.selecao.net.br / anexos-r2.selecao.net.br)
            #blocoListaVagas table    → cargos (colunas Cód/Vaga/Escolaridade/Taxa)
  Encoding: ISO-8859-1

Uso standalone: python scraper/quadrix.py
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

BASE_URL = "https://quadrix.org.br"
ABAS_UTEIS = [
    ("aberto", f"{BASE_URL}/index/abertos/"),
    ("em_andamento", f"{BASE_URL}/index/1/"),
]
DELAY = 1.2

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

MARCADORES_TIPO = [
    "concurso público", "processo seletivo simplificado", "processo seletivo público",
    "processo seletivo", "seleção pública", "vestibular", "residência",
    "exame de qualificação", "pss",
]

# Textos padrão que aparecem como link mas NÃO são o nome do órgão
TEXTOS_PADRAO_LINK = ["mais informa", "inscrições abertas", "quantidade de vagas", "/informacoes/"]

IGNORAR_TITULOS = ["vestibular", "exame de qualificação", "processo seletivo para residência"]


def _get(http: httpx.Client, url: str) -> Optional[BeautifulSoup]:
    try:
        r = http.get(url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        texto = r.content.decode("iso-8859-1", errors="replace")
        return BeautifulSoup(texto, "html.parser")
    except Exception as e:
        log.warning(f"[Quadrix] Erro {url}: {e}")
        return None


def _parse_data(texto: str) -> Optional[date]:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", texto)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    return None


def _paginar(http: httpx.Client, url_base: str) -> list[BeautifulSoup]:
    """Busca todas as páginas de uma aba (10 itens por página)."""
    paginas = []
    soup = _get(http, url_base)
    if not soup:
        return paginas
    paginas.append(soup)

    texto = soup.get_text(" ")
    m = re.search(r"Mostrando\s+\d+-\d+\s+de\s+(\d+)", texto, re.IGNORECASE)
    total = int(m.group(1)) if m else None

    if total and total > 10:
        total_paginas = -(-total // 10)  # ceil
        for pg in range(2, total_paginas + 1):
            url_pg = f"{url_base}?ord=&dir=&pg={pg}&q=&pp=10"
            sp = _get(http, url_pg)
            if sp:
                paginas.append(sp)
            time.sleep(DELAY)

    return paginas


def _raspar_links_listagem(soup: BeautifulSoup, status_aba: str) -> list[dict]:
    """
    Extrai cada card da listagem. Um card é um <li> com um ou mais links repetidos
    apontando pro mesmo /informacoes/{id}/. O nome do órgão é identificado por
    eliminação: é o único link cujo texto não é um dos textos padrão conhecidos.
    """
    itens = []
    padrao_id = re.compile(r"/informacoes/(\d+)/?")

    lis = [li for li in soup.find_all("li") if li.find("a", href=padrao_id)]

    for li in lis:
        m_id = padrao_id.search(li.find("a", href=padrao_id).get("href", ""))
        if not m_id:
            continue
        href = urljoin(BASE_URL, f"/informacoes/{m_id.group(1)}/")

        anchors = li.find_all("a", href=True)
        orgao = None
        for a in anchors:
            texto_a = a.get_text(strip=True)
            if not texto_a:
                continue
            if any(padrao in texto_a.lower() for padrao in TEXTOS_PADRAO_LINK):
                continue
            orgao = texto_a
            break

        if not orgao:
            continue  # não conseguiu identificar o nome do órgão — pula com segurança

        texto_completo = li.get_text(" ", strip=True)
        titulo_lower = texto_completo.lower()
        if any(ig in titulo_lower for ig in IGNORAR_TITULOS):
            continue

        # Tipo (Concurso Público / Processo Seletivo...) — vira prefixo do título
        tipo = ""
        for marcador in MARCADORES_TIPO:
            if marcador in titulo_lower:
                tipo = marcador
                break
        titulo = f"{tipo.capitalize()} {orgao}".strip() if tipo else orgao

        # Vagas — "Quantidade de Vagas 4788"
        vagas = 0
        m_vagas = re.search(r"Quantidade de Vagas\s*([\d.,]+)", texto_completo, re.IGNORECASE)
        if m_vagas:
            try:
                vagas = int(m_vagas.group(1).replace(".", "").replace(",", ""))
            except ValueError:
                pass

        # Datas — "Inscrições de DATA a DATA" (evita casar com "Pedidos de Isenção de DATA a DATA")
        data_abertura = data_encerramento = None
        m_datas = re.search(
            r"Inscri[çc][õo]es de\s*(\d{2}/\d{2}/\d{4})\s*a\s*(\d{2}/\d{2}/\d{4})",
            texto_completo, re.IGNORECASE,
        )
        if m_datas:
            data_abertura = _parse_data(m_datas.group(1))
            data_encerramento = _parse_data(m_datas.group(2))

        # Badge "Inscrições Abertas!" é mais confiável que a aba de onde veio
        status = "aberto" if re.search(r"inscri[çc][õo]es\s+abertas", texto_completo, re.IGNORECASE) else status_aba

        itens.append({
            "orgao": orgao[:150],
            "titulo": titulo[:200],
            "url": href,
            "vagas_listagem": vagas,
            "data_abertura": data_abertura,
            "data_encerramento": data_encerramento,
            "status": status,
        })

    return itens


def _raspar_detalhe(http: httpx.Client, url: str) -> dict:
    resultado = {
        "data_abertura": None,
        "data_encerramento": None,
        "total_vagas": 0,
        "links_pdf": [],
    }

    soup = _get(http, url)
    if not soup:
        return resultado

    # Datas — "Inscrições: 09/06/2026 10:00 a 13/07/2026 23:00"
    bloco_geral = soup.find(id="blocoInformacoesGerais")
    if bloco_geral:
        for div_dados in bloco_geral.find_all("div", class_=lambda c: c and "dados" in c):
            texto = div_dados.get_text(" ", strip=True)
            if "inscri" in texto.lower():
                datas_encontradas = re.findall(r"(\d{2}/\d{2}/\d{4})", texto)
                if len(datas_encontradas) >= 2:
                    resultado["data_abertura"] = _parse_data(datas_encontradas[0])
                    resultado["data_encerramento"] = _parse_data(datas_encontradas[1])
                elif len(datas_encontradas) == 1:
                    resultado["data_encerramento"] = _parse_data(datas_encontradas[0])
                break

    # PDFs — li.pdf a
    for li in soup.find_all("li", class_=lambda c: c and "pdf" in c):
        a = li.find("a", href=True)
        if not a:
            continue
        href = a.get("href", "")
        texto = a.get_text(" ", strip=True) or li.get_text(" ", strip=True)
        texto = re.sub(r"\s+", " ", texto).strip()
        if not href or not texto:
            continue
        if not href.startswith("http"):
            href = urljoin(BASE_URL, href)
        if not any(l["url"] == href for l in resultado["links_pdf"]):
            resultado["links_pdf"].append({"titulo": texto[:200], "url": href})

    # Cargos/vagas — #blocoListaVagas table (colunas: Cód | Vaga | Escolaridade | Taxa)
    bloco_vagas = soup.find(id="blocoListaVagas")
    if bloco_vagas:
        tabela = bloco_vagas.find("table")
        if tabela:
            linhas = tabela.find_all("tr")
            total = 0
            achou_numero = False
            for tr in linhas:
                celulas = [td.get_text(strip=True) for td in tr.find_all("td")]
                # Coluna 1 (índice 1) é "Vaga" — pula linhas de cabeçalho ou malformadas
                if len(celulas) < 2:
                    continue
                col_vaga = celulas[1]
                if re.fullmatch(r"[\d.,]+", col_vaga):
                    try:
                        total += int(col_vaga.replace(".", "").replace(",", ""))
                        achou_numero = True
                    except ValueError:
                        pass
            if achou_numero:
                resultado["total_vagas"] = total

    return resultado


def _extrair_uf(titulo: str) -> Optional[str]:
    ufs = {"AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
           "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"}

    # Prioridade máxima: padrão explícito "Cidade/UF" ou "Cidade - UF"
    # Prioridade máxima: padrão explícito "Cidade/UF" ou "Cidade - UF" / "Nome-UF".
    # Usa finditer (não só o primeiro match) porque pode haver hífens antes que não
    # sejam UF válida (ex: "20ª Região-XX (CRQ-MS)" — o "-XX" não é UF, o "-MS" é).
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
    # Distrito Federal funciona como estado — precisa vir antes do check genérico de
    # "federal", senão "Distrito Federal" é confundido com esfera federal.
    if "distrito federal" in txt or re.search(r"\bdf\b", txt):
        return "estadual"
    if any(p in txt for p in ["tribunal de justiça", "assembleia", "ministério público do estado",
                               "ministério público estadual", "procuradoria-geral do estado",
                               "procuradoria geral do estado", "secretaria de estado", "tribunal de contas",
                               "defensoria pública", "polícia civil", "polícia militar", "corpo de bombeiros",
                               "governo do estado", "conselho regional", "agência reguladora"]):
        return "estadual"
    if any(p in txt for p in ["federal", "receita", "banco do brasil", "caixa", "petrobras",
                               "ministério", "senado", "tribunal superior", "cnj", "trf"]):
        return "federal"
    return "nao_identificada"


def _mapear_area(titulo: str) -> str:
    txt = titulo.lower()
    mapa = {
        "fiscal_tributaria": ["fiscal", "receita", "fazenda", "tributar", "sefaz", "tribunal de contas"],
        "seguranca_publica": ["polícia", "bombeiro", "penal", "guarda", "soldado"],
        "saude": ["saúde", "médico", "enfermeiro", "hospital", "saneamento"],
        "educacao": ["educação", "professor", "escola", "magistério", "pedagógico"],
        "tecnologia": ["tecnologia", "informática", "ti ", "dados"],
        "juridica": ["tribunal", "ministério público", "procuradoria", "juiz", "defensor", "promotor"],
    }
    for area, palavras in mapa.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


class QuadrixScraper:
    BANCA = "Quadrix"

    def __init__(self, http: httpx.Client):
        self.http = http

    def scrape(self) -> list[dict]:
        itens_por_url: dict[str, dict] = {}

        for status_aba, url_aba in ABAS_UTEIS:
            log.info(f"[Quadrix] Buscando aba '{status_aba}'...")
            paginas = _paginar(self.http, url_aba)
            for soup in paginas:
                for item in _raspar_links_listagem(soup, status_aba):
                    # Concurso pode aparecer em mais de uma aba — "aberto" tem prioridade
                    existente = itens_por_url.get(item["url"])
                    if not existente or (item["status"] == "aberto" and existente["status"] != "aberto"):
                        itens_por_url[item["url"]] = item
            time.sleep(DELAY)

        itens = list(itens_por_url.values())
        log.info(f"[Quadrix] {len(itens)} concursos únicos encontrados (abertos + em andamento)")

        concursos = []
        for item in itens:
            detalhe = _raspar_detalhe(self.http, item["url"])
            time.sleep(DELAY)

            orgao  = item["orgao"]
            titulo = item["titulo"]

            # Datas: prioriza o que veio da listagem; usa o detalhe como fallback
            data_abertura     = item["data_abertura"] or detalhe["data_abertura"]
            data_encerramento = item["data_encerramento"] or detalhe["data_encerramento"]
            total_vagas       = item["vagas_listagem"] or detalhe["total_vagas"]

            # O produto (frontend) só reconhece aberto/previsto/encerrado — não existe
            # "em_andamento" como status real. Mapeia pra "encerrado" só no campo
            # salvo (fica fora da busca padrão, mas continua no banco).
            status_final = "encerrado" if item["status"] == "em_andamento" else item["status"]

            concursos.append({
                "banca":             self.BANCA,
                "orgao":             orgao,
                "titulo":            titulo,
                "esfera":            _mapear_esfera(orgao + " " + titulo),
                "estado":            _extrair_uf(orgao + " " + titulo),
                "area_conhecimento": _mapear_area(orgao + " " + titulo),
                "status":            status_final,
                "total_vagas":       total_vagas,
                "data_abertura":     data_abertura,
                "data_encerramento": data_encerramento,
                "fonte_url":         item["url"],
                "links_pdf":         detalhe["links_pdf"],
                "descricao":         None,
            })

            log.info(
                f"  + {orgao[:50]} | "
                f"{_extrair_uf(orgao + ' ' + titulo) or 'BR'} | "
                f"{item['status']} (salvo como: {status_final}) | "
                f"{total_vagas} vagas | "
                f"{len(detalhe['links_pdf'])} PDFs"
            )

        log.info(f"[Quadrix] Total: {len(concursos)} concursos")
        return concursos


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with httpx.Client(follow_redirects=True, timeout=20) as http:
        scraper   = QuadrixScraper(http)
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

"""
ConcursoTrack — Scraper de TESTE v4
Valida o parsing da listagem /concursos/ antes de rodar o completo.
Sem banco de dados. Termina em ~5 segundos.
"""

import re
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ConcursoTrackBot/1.0)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

URL = "https://www.pciconcursos.com.br/concursos/"
UFS = {"AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
       "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO","BR"}


def extrair_uf(title: str) -> str:
    """Extrai UF do atributo title do link. Ex: 'IBGE - BR: ...' → 'BR'"""
    m = re.search(r"-\s*([A-Z]{2})\s*[:–]", title)
    if m and m.group(1) in UFS:
        return m.group(1) if m.group(1) != "BR" else None
    return None


def extrair_vagas(texto: str) -> int:
    m = re.search(r"([\d][.\d]*)\s*vaga", texto, re.IGNORECASE)
    if m:
        return int(m.group(1).replace(".", ""))
    return 0


def extrair_data(texto: str):
    m = re.search(r"(\d{1,2})/(\d{2})/(\d{4})", texto)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1).zfill(2)}"
    return None


def extrair_salario(texto: str):
    m = re.search(r"R\$\s*([\d.,]+)", texto)
    if m:
        return float(m.group(1).replace(".", "").replace(",", "."))
    return None


def parsear_concursos(soup):
    concursos = []
    vistos = set()

    for a in soup.select("a[href*='/noticias/']"):
        href  = a.get("href", "")
        title = a.get("title", "")
        orgao = a.get_text(strip=True)

        # Pula links de seção (sem título ou orgão genérico)
        if not title or orgao.lower() in ("notícias", "noticias") or len(orgao) < 5:
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
            "salario_max":       extrair_salario(texto_pai),
            "texto_raw":         texto_pai[:200],
        })

    return concursos


def main():
    print(f"Buscando: {URL}")
    r = httpx.get(URL, headers=HEADERS, follow_redirects=True, timeout=15)
    print(f"Status: {r.status_code}")
    soup = BeautifulSoup(r.text, "html.parser")

    concursos = parsear_concursos(soup)
    print(f"\nConcursos parseados: {len(concursos)}\n")

    for i, c in enumerate(concursos[:10], 1):
        print(f"[{i}] {c['orgao'][:55]}")
        print(f"     UF: {c['estado'] or 'Nacional'}  |  Vagas: {c['total_vagas']}  |  Data: {c['data_encerramento']}  |  Salário: {c['salario_max']}")
        print(f"     URL: {c['fonte_url']}")
        print()

    com_vagas = sum(1 for c in concursos if c['total_vagas'] > 0)
    com_data  = sum(1 for c in concursos if c['data_encerramento'])
    print(f"--- Resumo ---")
    print(f"Total: {len(concursos)}  |  Com vagas: {com_vagas}  |  Com data: {com_data}")


if __name__ == "__main__":
    main()

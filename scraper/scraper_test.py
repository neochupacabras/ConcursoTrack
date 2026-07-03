"""
ConcursoTrack — Scraper de TESTE
Processa apenas 5 links e imprime diagnóstico completo.
Rode com: python scraper/scraper_test.py
"""

import re
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ConcursoTrackBot/1.0)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

FONTE = "https://www.pciconcursos.com.br/noticias/nacional/"
MAX_LINKS = 5


def get(url: str) -> BeautifulSoup:
    r = httpx.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
    print(f"  [{r.status_code}] {url}")
    return BeautifulSoup(r.text, "html.parser")


def inspecionar(url: str):
    print(f"\n{'='*60}")
    print(f"URL: {url}")
    soup = get(url)

    # Todos os h1
    h1s = soup.select("h1")
    print(f"\n--- H1s encontrados ({len(h1s)}) ---")
    for i, h in enumerate(h1s):
        print(f"  [{i}] '{h.get_text(strip=True)[:100]}'")

    # og:title
    og = soup.find("meta", property="og:title")
    print(f"\n--- og:title ---")
    print(f"  '{og['content'] if og else 'NÃO ENCONTRADO'}'")

    # og:description
    og_desc = soup.find("meta", property="og:description")
    print(f"\n--- og:description ---")
    print(f"  '{og_desc['content'][:150] if og_desc else 'NÃO ENCONTRADO'}'")

    # title da página
    title_el = soup.select_one("title")
    print(f"\n--- <title> ---")
    print(f"  '{title_el.get_text(strip=True) if title_el else 'NÃO ENCONTRADO'}'")

    # Primeiros 500 chars do texto visível
    texto = soup.get_text(" ", strip=True)[:500]
    print(f"\n--- Texto inicial ---")
    print(f"  {texto}")

    # Busca por "vaga" no texto
    vagas_match = re.search(r"([\d][.\d]*[\d]|\d+)\s*vaga", texto, re.IGNORECASE)
    print(f"\n--- Vagas encontradas ---")
    print(f"  {vagas_match.group(0) if vagas_match else 'nenhuma'}")


def main():
    print(f"Buscando links em: {FONTE}")
    soup = get(FONTE)

    links = []
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if "/noticias/" in href and href.count("/") >= 4:
            full = href if href.startswith("http") else "https://www.pciconcursos.com.br" + href
            if full not in links:
                links.append(full)

    print(f"\nLinks encontrados: {len(links)}")
    print(f"Inspecionando os primeiros {MAX_LINKS}:\n")

    for url in links[:MAX_LINKS]:
        inspecionar(url)


if __name__ == "__main__":
    main()

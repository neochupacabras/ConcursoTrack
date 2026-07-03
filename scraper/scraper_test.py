"""
ConcursoTrack — Scraper de TESTE v3
Raspa a listagem /concursos/ do PCI diretamente.
Roda em ~5 segundos. Sem banco de dados.
"""

import re
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ConcursoTrackBot/1.0)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

URL = "https://www.pciconcursos.com.br/concursos/"


def main():
    print(f"Buscando: {URL}")
    r = httpx.get(URL, headers=HEADERS, follow_redirects=True, timeout=15)
    print(f"Status: {r.status_code}")
    soup = BeautifulSoup(r.text, "html.parser")

    # Cada concurso é um <a> que aponta para /noticias/
    links = soup.select("a[href*='/noticias/']")
    print(f"\nLinks /noticias/ encontrados na página: {len(links)}")

    count = 0
    for a in links[:10]:  # mostra os 10 primeiros
        orgao = a.get_text(strip=True)
        href  = a.get("href","")
        title = a.get("title","")

        # Pega o container pai para extrair vagas/data
        pai = a.find_parent()
        texto_pai = pai.get_text(" ", strip=True) if pai else ""

        # Vagas
        vagas_m = re.search(r"([\d.,]+)\s*vaga", texto_pai, re.IGNORECASE)
        vagas   = vagas_m.group(0) if vagas_m else "?"

        # Data (dd/mm/yyyy)
        data_m = re.search(r"\d{1,2}/\d{2}/\d{4}", texto_pai)
        data   = data_m.group(0) if data_m else "?"

        # UF (sigla de 2 letras isolada)
        uf_m = re.search(r"\b([A-Z]{2})\b", texto_pai)
        uf   = uf_m.group(1) if uf_m else "?"

        print(f"\n[{count+1}] {orgao[:60]}")
        print(f"     href:  {href}")
        print(f"     title: {title[:80]}")
        print(f"     vagas: {vagas}  | data: {data}  | UF: {uf}")
        print(f"     texto: {texto_pai[:120]}")
        count += 1

    # Conta total de links únicos de notícia
    hrefs = set(a.get("href","") for a in links if "/noticias/" in a.get("href",""))
    print(f"\n\nTotal de links únicos de notícia na página: {len(hrefs)}")


if __name__ == "__main__":
    main()

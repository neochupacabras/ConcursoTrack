"""
ConcursoTrack — Relatório de possíveis duplicatas entre fontes (Fase 4)
==========================================================================
Contexto: a primeira versão desta etapa aplicava a mesclagem automaticamente
e teve uma taxa de falso positivo de ~67% em produção (14 de 21 mesclagens
feitas eram órgãos/cidades/estados diferentes — ex: "UESB (Bahia)" mesclado
com "UENP (Paraná)", "Itapetininga/SP" mesclado com "Piratininga/SP"). Nomes
de instituições públicas brasileiras têm moldes muito parecidos (ex:
"Secretaria de Estado da Saúde de X", "Universidade Estadual de Y",
"Prefeitura de Z") que enganam similaridade de texto mesmo com veto de UF.

Por isso esta etapa AGORA SÓ GERA RELATÓRIO — nunca escreve no banco sozinha.
Rodar automaticamente (Fase 4 do scraper_concursotrack.py) é seguro porque só
lê e imprime/salva um relatório; a aplicação real exige rodar
aplicar_mesclagem.py manualmente, revisando cada par antes.

Fluxo:
  1. Fase 4 do scraper roda gerar_relatorio() automaticamente → só loga
     candidatos a mesclagem, sem tocar no banco.
  2. Você revisa os candidatos (aqui ou no arquivo relatorio_mesclagem.txt).
  3. Você roda `python scraper/aplicar_mesclagem.py <pci_id_1> <pci_id_2> ...`
     só com os IDs que você aprovou manualmente.

PRÉ-REQUISITO — rodar uma vez no SQL Editor do Supabase antes do primeiro uso:

    ALTER TABLE concursos ADD COLUMN IF NOT EXISTS oculto boolean DEFAULT false;
    ALTER TABLE concursos ADD COLUMN IF NOT EXISTS mesclado_com uuid REFERENCES concursos(id);

E atualizar a query de busca (src/lib/queries.ts) pra filtrar .eq('oculto', false).
"""

import re
import logging
import unicodedata
from difflib import SequenceMatcher
from typing import Optional

log = logging.getLogger(__name__)

LIMIAR_SIMILARIDADE = 0.60

PALAVRAS_IGNORAR = {
    "concurso", "publico", "público", "processo", "seletivo", "simplificado",
    "de", "da", "do", "das", "dos", "e", "para", "no", "n", "edital",
    "prefeitura", "municipal", "municipio", "estado", "governo", "publica",
}

UFS = {"AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
       "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"}

ESTADOS_NOME = {
    "acre": "AC", "alagoas": "AL", "amazonas": "AM", "amapa": "AP", "bahia": "BA",
    "ceara": "CE", "distrito federal": "DF", "espirito santo": "ES", "goias": "GO",
    "maranhao": "MA", "mato grosso do sul": "MS", "mato grosso": "MT",
    "minas gerais": "MG", "para": "PA", "paraiba": "PB", "parana": "PR",
    "pernambuco": "PE", "piaui": "PI", "rio de janeiro": "RJ",
    "rio grande do norte": "RN", "rio grande do sul": "RS", "rondonia": "RO",
    "roraima": "RR", "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE",
    "tocantins": "TO",
}


def _normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9\s]", " ", texto)
    palavras = [p for p in texto.split() if p not in PALAVRAS_IGNORAR and len(p) > 1]
    return " ".join(palavras)


def _detectar_uf_do_texto(texto: str) -> Optional[str]:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    m = re.search(r"[/\-]\s*([A-Z]{2})\b", texto)
    if m and m.group(1) in UFS:
        return m.group(1)
    for nome, uf in ESTADOS_NOME.items():
        if nome in sem_acento:
            return uf
    return None


def _extrair_sigla(texto: str) -> Optional[str]:
    m = re.search(r"[-–—]\s*([A-ZÀ-Ú]{2,8})\s*(?:/[A-Z]{2})?\s*$", texto)
    if m:
        return m.group(1).upper()
    m = re.search(r"\(([A-ZÀ-Ú]{2,8})\)", texto)
    if m:
        return m.group(1).upper()
    return None


def _siglas_conflitam(a: str, b: str) -> bool:
    sigla_a, sigla_b = _extrair_sigla(a), _extrair_sigla(b)
    if not sigla_a or not sigla_b:
        return False
    if sigla_a == sigla_b:
        return False
    if sigla_a in sigla_b or sigla_b in sigla_a:
        return False
    return True


def _ufs_conflitam(a: str, b: str) -> bool:
    uf_a, uf_b = _detectar_uf_do_texto(a), _detectar_uf_do_texto(b)
    if not uf_a or not uf_b:
        return False
    return uf_a != uf_b


def _similaridade(a: str, b: str) -> float:
    if _siglas_conflitam(a, b):
        return 0.0
    if _ufs_conflitam(a, b):
        return 0.0
    na, nb = _normalizar(a), _normalizar(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def encontrar_candidatos(db) -> list[dict]:
    """
    Só LEITURA — busca concursos ativos não ocultos, separa PCI vs bancas
    dedicadas, e calcula o melhor candidato de cada dedicada dentre o PCI.
    Não escreve nada no banco. Retorna a lista de candidatos com score.
    """
    try:
        res = db.table("concursos").select(
            "id, orgao, estado, total_vagas, fonte_url, oculto"
        ).eq("oculto", False).execute()
        linhas = res.data or []
    except Exception as e:
        msg = str(e)
        if "oculto" in msg.lower() or "column" in msg.lower():
            log.error(
                "[Mesclagem] A coluna 'oculto' não existe ainda na tabela concursos. "
                "Rode a migração SQL descrita no topo deste arquivo antes de usar esta etapa."
            )
        else:
            log.error(f"[Mesclagem] Erro ao buscar concursos: {e}")
        return []

    pci, dedicadas = [], []
    for linha in linhas:
        if "pciconcursos.com.br" in (linha.get("fonte_url") or ""):
            pci.append(linha)
        else:
            dedicadas.append(linha)

    candidatos = []
    pci_usados = set()

    for primaria in dedicadas:
        melhor_match, melhor_score = None, 0.0
        for candidato in pci:
            if candidato["id"] in pci_usados:
                continue
            score = _similaridade(primaria["orgao"], candidato["orgao"])
            if score > melhor_score:
                melhor_score, melhor_match = score, candidato

        if not melhor_match or melhor_score < LIMIAR_SIMILARIDADE:
            continue

        pci_usados.add(melhor_match["id"])
        candidatos.append({
            "primaria_id":     primaria["id"],
            "primaria_orgao":  primaria["orgao"],
            "primaria_estado": primaria.get("estado"),
            "primaria_vagas":  primaria.get("total_vagas"),
            "pci_id":          melhor_match["id"],
            "pci_orgao":       melhor_match["orgao"],
            "pci_estado":      melhor_match.get("estado"),
            "pci_vagas":       melhor_match.get("total_vagas"),
            "score":           melhor_score,
        })

    return candidatos


def gerar_relatorio(db, salvar_em: str = "relatorio_mesclagem.txt") -> list[dict]:
    """
    Gera e loga um relatório de candidatos a mesclagem — SÓ LEITURA, nunca
    escreve no banco. Seguro pra rodar automaticamente em toda execução do
    scraper. Salva também em arquivo texto pra facilitar copiar os IDs.
    """
    candidatos = encontrar_candidatos(db)

    if not candidatos:
        log.info("[Mesclagem] Nenhum candidato a duplicata encontrado.")
        return []

    linhas_relatorio = [
        f"{len(candidatos)} candidatos a mesclagem encontrados — REVISE ANTES DE APLICAR.",
        "Rode: python scraper/aplicar_mesclagem.py <pci_id_1> <pci_id_2> ... só com os aprovados.",
        "=" * 100,
    ]

    for c in candidatos:
        linhas_relatorio.append(
            f"\nPRIMÁRIA: {c['primaria_orgao'][:60]}\n"
            f"  estado={c['primaria_estado']} vagas={c['primaria_vagas']}\n"
            f"PCI:      {c['pci_orgao'][:60]}\n"
            f"  estado={c['pci_estado']} vagas={c['pci_vagas']}\n"
            f"  score={c['score']:.2f}  pci_id={c['pci_id']}"
        )

    texto_final = "\n".join(linhas_relatorio)
    log.info(f"[Mesclagem] {len(candidatos)} candidatos encontrados — nenhuma escrita feita (relatório apenas)")
    log.info(f"[Mesclagem] Detalhes salvos em {salvar_em}")

    try:
        with open(salvar_em, "w", encoding="utf-8") as f:
            f.write(texto_final)
    except Exception as e:
        log.warning(f"[Mesclagem] Não consegui salvar o relatório em arquivo: {e}")

    return candidatos


if __name__ == "__main__":
    import os
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    from dotenv import load_dotenv
    load_dotenv()
    from supabase import create_client

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    gerar_relatorio(supabase)

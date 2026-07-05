"""
ConcursoTrack — Mesclagem de duplicatas entre fontes (Fase 4)
==============================================================
Problema: cada scraper (PCI genérico + bancas dedicadas: Cebraspe, FGV, IBFC,
FCC, Consulplan, Quadrix, Avalia) salva sua própria linha em `concursos`, com
slug baseado em orgao+fonte_url. Como a fonte_url de cada site é diferente, o
MESMO concurso do mundo real pode virar duas linhas — uma vinda do PCI
(genérico, sempre roda primeiro) e outra vinda da banca dedicada (com PDFs e
datas mais confiáveis). Isso faz o mesmo concurso aparecer duplicado na busca,
já que a query de busca não deduplica por órgão.

Esta etapa roda depois de todas as fases de scraping e:
1. Encontra pares (linha do PCI, linha de banca dedicada) que provavelmente são
   o mesmo concurso, comparando nome do órgão (fuzzy, ignorando palavras
   genéricas tipo "concurso público") + estado, quando ambos tiverem UF.
2. Preenche campos vazios da linha "primária" (banca dedicada, mais confiável)
   com dados da linha do PCI quando fizer sentido — hoje só total_vagas.
3. Marca a linha do PCI como oculto=true (some da busca), sem deletar — deletar
   quebraria FKs de simulados/questoes/notificacoes_fila que podem referenciar
   o id da linha do PCI.

PRÉ-REQUISITO — rodar uma vez no SQL Editor do Supabase antes do primeiro uso:

    ALTER TABLE concursos ADD COLUMN IF NOT EXISTS oculto boolean DEFAULT false;
    ALTER TABLE concursos ADD COLUMN IF NOT EXISTS mesclado_com uuid REFERENCES concursos(id);

E atualizar a query de busca (src/lib/queries.ts) pra filtrar .eq('oculto', false).

Uso: chamado por scraper_concursotrack.py depois da Fase 3 (ou standalone).
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


def _normalizar(texto: str) -> str:
    """Remove acentos, pontuação e palavras genéricas — sobra só o 'núcleo' do nome."""
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9\s]", " ", texto)
    palavras = [p for p in texto.split() if p not in PALAVRAS_IGNORAR and len(p) > 1]
    return " ".join(palavras)


def _extrair_sigla(texto: str) -> Optional[str]:
    """
    Extrai a sigla da instituição quando ela aparece explícita, tipo
    "Instituto Federal da Bahia - IFBA" ou "Universidade Federal (UFBA)".
    Usada como veto: duas siglas diferentes = instituições diferentes,
    mesmo que o resto do nome seja parecido (ex: IFBA vs UFBA).
    """
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


def _similaridade(a: str, b: str) -> float:
    if _siglas_conflitam(a, b):
        return 0.0
    na, nb = _normalizar(a), _normalizar(b)
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def mesclar_duplicatas(db) -> dict:
    """
    Busca concursos ativos e não ocultos, separa em (PCI) vs (bancas dedicadas),
    e tenta casar cada linha dedicada com a melhor candidata do PCI pelo nome do
    órgão + estado. Quando acha, preenche vagas faltantes e oculta a linha do PCI.
    """
    resultado = {"mesclados": 0, "vagas_preenchidas": 0, "erro": None}

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
        resultado["erro"] = msg
        return resultado

    pci, dedicadas = [], []
    for linha in linhas:
        if "pciconcursos.com.br" in (linha.get("fonte_url") or ""):
            pci.append(linha)
        else:
            dedicadas.append(linha)

    log.info(f"[Mesclagem] {len(dedicadas)} linhas de bancas dedicadas, {len(pci)} linhas do PCI")

    pci_usados = set()

    for primaria in dedicadas:
        melhor_match, melhor_score = None, 0.0

        for candidato in pci:
            if candidato["id"] in pci_usados:
                continue
            # Exige mesmo estado quando ambos tiverem UF preenchida (evita casar
            # órgãos de mesmo nome em estados diferentes, ex: duas "Câmara Municipal")
            uf_primaria  = primaria.get("estado")
            uf_candidato = candidato.get("estado")
            if uf_primaria and uf_candidato and uf_primaria != uf_candidato:
                continue

            score = _similaridade(primaria["orgao"], candidato["orgao"])
            if score > melhor_score:
                melhor_score, melhor_match = score, candidato

        if not melhor_match or melhor_score < LIMIAR_SIMILARIDADE:
            continue

        pci_usados.add(melhor_match["id"])

        atualizacoes = {}
        if not primaria.get("total_vagas") and melhor_match.get("total_vagas"):
            atualizacoes["total_vagas"] = melhor_match["total_vagas"]
            resultado["vagas_preenchidas"] += 1

        try:
            if atualizacoes:
                db.table("concursos").update(atualizacoes).eq("id", primaria["id"]).execute()
            db.table("concursos").update({
                "oculto": True,
                "mesclado_com": primaria["id"],
            }).eq("id", melhor_match["id"]).execute()
            resultado["mesclados"] += 1
            log.info(
                f"  = '{primaria['orgao'][:40]}' <- PCI '{melhor_match['orgao'][:40]}' "
                f"(similaridade {melhor_score:.2f}"
                + (f", vagas preenchidas: {atualizacoes['total_vagas']}" if atualizacoes else "")
                + ")"
            )
        except Exception as e:
            log.warning(f"[Mesclagem] Erro ao mesclar linha {primaria['id']}: {e}")

    log.info(
        f"[Mesclagem] Total: {resultado['mesclados']} duplicatas mescladas, "
        f"{resultado['vagas_preenchidas']} vagas preenchidas"
    )
    return resultado


if __name__ == "__main__":
    import os
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    from supabase import create_client

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    mesclar_duplicatas(supabase)

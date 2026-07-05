"""
ConcursoTrack — Reversão de mesclagens incorretas (uso único, pós-incidente)
==============================================================================
Reverte mesclagens específicas feitas pela versão com bug do
mesclar_duplicatas.py: desoculta a linha do PCI (oculto=false,
mesclado_com=null). NÃO tenta reverter o total_vagas que foi copiado pra
linha primária (não dá pra saber com certeza qual era o valor antes sem
guardar histórico) — revise manualmente se o total_vagas da linha primária
ficou errado após a reversão, usando o auditar_mesclagens.py como referência.

Uso:
    python scraper/reverter_mesclagem.py <id_da_linha_oculta_1> <id_da_linha_oculta_2> ...

Os IDs são os das linhas que estão oculto=true (a "PCI", que auditar_mesclagens.py
lista como "OCULTA"), não os das linhas primárias.
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def reverter(db, ids: list[str]):
    for id_ in ids:
        try:
            res = db.table("concursos").select("orgao, mesclado_com").eq("id", id_).limit(1).execute()
            if not res.data:
                log.warning(f"ID {id_} não encontrado — pulando")
                continue
            orgao = res.data[0]["orgao"]

            db.table("concursos").update({"oculto": False, "mesclado_com": None}).eq("id", id_).execute()
            log.info(f"Revertido: '{orgao}' (id={id_}) volta a aparecer na busca")
        except Exception as e:
            log.error(f"Erro ao reverter {id_}: {e}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scraper/reverter_mesclagem.py <id1> <id2> ...")
        sys.exit(1)

    from supabase import create_client
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    reverter(supabase, sys.argv[1:])

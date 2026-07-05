"""
ConcursoTrack — Aplicação manual de mesclagem (uso deliberado, não automático)
================================================================================
Recalcula os candidatos a mesclagem (mesma lógica de mesclar_duplicatas.py) e
aplica SÓ os pares cujo pci_id foi passado explicitamente na linha de comando
— ou seja, só o que você revisou e aprovou no relatório gerado por
gerar_relatorio() / relatorio_mesclagem.txt.

Uso:
    python scraper/aplicar_mesclagem.py <pci_id_1> <pci_id_2> ...

Os IDs são os da coluna "pci_id" do relatório (a linha que vai sumir da busca).
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

from mesclar_duplicatas import encontrar_candidatos


def aplicar(db, pci_ids_aprovados: list[str]) -> dict:
    resultado = {"aplicados": 0, "vagas_preenchidas": 0, "nao_encontrados": []}

    candidatos = encontrar_candidatos(db)
    candidatos_por_pci_id = {c["pci_id"]: c for c in candidatos}

    for pci_id in pci_ids_aprovados:
        c = candidatos_por_pci_id.get(pci_id)
        if not c:
            log.warning(f"pci_id {pci_id} não está mais entre os candidatos calculados agora — pulando")
            resultado["nao_encontrados"].append(pci_id)
            continue

        atualizacoes = {}
        if not c["primaria_vagas"] and c["pci_vagas"]:
            atualizacoes["total_vagas"] = c["pci_vagas"]
            resultado["vagas_preenchidas"] += 1

        try:
            if atualizacoes:
                db.table("concursos").update(atualizacoes).eq("id", c["primaria_id"]).execute()
            db.table("concursos").update({
                "oculto": True,
                "mesclado_com": c["primaria_id"],
            }).eq("id", c["pci_id"]).execute()
            resultado["aplicados"] += 1
            log.info(
                f"Aplicado: '{c['primaria_orgao'][:40]}' <- PCI '{c['pci_orgao'][:40]}'"
                + (f" (vagas preenchidas: {atualizacoes['total_vagas']})" if atualizacoes else "")
            )
        except Exception as e:
            log.error(f"Erro ao aplicar mesclagem de {c['pci_id']}: {e}")

    log.info(
        f"Total: {resultado['aplicados']} mesclagens aplicadas, "
        f"{resultado['vagas_preenchidas']} vagas preenchidas, "
        f"{len(resultado['nao_encontrados'])} não encontrados"
    )
    return resultado


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scraper/aplicar_mesclagem.py <pci_id_1> <pci_id_2> ...")
        print("Rode antes: python scraper/mesclar_duplicatas.py  (gera o relatório com os IDs)")
        sys.exit(1)

    from dotenv import load_dotenv
    load_dotenv()
    from supabase import create_client

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    aplicar(supabase, sys.argv[1:])

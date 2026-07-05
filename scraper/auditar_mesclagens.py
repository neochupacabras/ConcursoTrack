"""
ConcursoTrack — Auditoria de mesclagens (uso único, pós-incidente)
====================================================================
Contexto: a primeira versão do mesclar_duplicatas.py tinha um bug de
segurança (veto de UF dependia do campo `estado` já salvo, que fica None
com frequência pro PCI por causa de uma regex de extração restritiva).
Isso já mesclou incorretamente pelo menos 3 pares em produção (confirmado
via log: SP/ES, BA/PR, BA/PB — estados/instituições diferentes).

Este script lista TODAS as linhas atualmente marcadas oculto=true com seu
par (mesclado_com), pra você revisar visualmente quais fazem sentido e
quais precisam ser revertidas com reverter_mesclagem.py.

Uso: python scraper/auditar_mesclagens.py
"""

import os
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def auditar(db):
    ocultos = db.table("concursos").select(
        "id, orgao, estado, total_vagas, fonte_url, mesclado_com"
    ).eq("oculto", True).execute().data or []

    if not ocultos:
        print("Nenhuma linha oculta (mesclada) encontrada.")
        return []

    ids_primarias = list({o["mesclado_com"] for o in ocultos if o.get("mesclado_com")})
    primarias_raw = db.table("concursos").select(
        "id, orgao, estado, total_vagas, fonte_url"
    ).in_("id", ids_primarias).execute().data or []
    primarias = {p["id"]: p for p in primarias_raw}

    print(f"\n{'='*100}")
    print(f"{len(ocultos)} linhas mescladas (oculto=true) — revise cada par abaixo:")
    print(f"{'='*100}\n")

    pares = []
    for o in ocultos:
        primaria = primarias.get(o.get("mesclado_com"))
        if not primaria:
            print(f"[SEM PAR] oculto id={o['id']} orgao='{o['orgao']}' — mesclado_com aponta pra id inexistente")
            continue

        pares.append({"pci": o, "primaria": primaria})
        mesmo_estado = (primaria.get("estado") == o.get("estado")) or not (primaria.get("estado") and o.get("estado"))
        alerta = "" if mesmo_estado else "  <<< ESTADOS DIFERENTES — REVISAR COM ATENÇÃO"

        print(f"PRIMÁRIA (fica visível): {primaria['orgao'][:60]}")
        print(f"  estado={primaria.get('estado')} vagas={primaria.get('total_vagas')} url={primaria['fonte_url'][:70]}")
        print(f"OCULTA   (PCI, some da busca): {o['orgao'][:60]}{alerta}")
        print(f"  estado={o.get('estado')} vagas={o.get('total_vagas')} url={o['fonte_url'][:70]}")
        print(f"  id da linha oculta (use pra reverter): {o['id']}")
        print("-" * 100)

    return pares


if __name__ == "__main__":
    from supabase import create_client
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    auditar(supabase)

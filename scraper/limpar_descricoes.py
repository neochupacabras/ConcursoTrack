"""
ConcursoTrack — Limpeza retroativa de descrições com propaganda do PCI
========================================================================
Contexto: a lógica de corte de propaganda em raspar_artigo() (Fase 2 do PCI,
em scraper_concursotrack.py) usava frases fixas que não cobriam todas as
variações de redação do PCI (ex: "no edital completo" vs "nos editais
completos"), deixando parágrafos promocionais ("apostila", "podcast") dentro
da descricao de concursos já salvos. Isso foi corrigido pra artigos novos,
mas os concursos já salvos continuam sujos — o enriquecimento só roda de novo
quando descricao está vazia, então eles nunca seriam reprocessados sozinhos.

Este script varre os concursos já salvos e aplica a mesma lógica de corte por
palavra-chave (mantém tudo até o parágrafo antes de mencionar "apostila" ou
"podcast", descarta o resto).

SÓ REPORTA por padrão — nada é escrito a menos que você use --aplicar. Mesma
cautela adotada em mesclar_duplicatas.py depois do incidente de mesclagem
automática: mudança em massa no banco merece revisão antes de aplicar.

Uso:
    python scraper/limpar_descricoes.py             # dry-run: só mostra o que mudaria
    python scraper/limpar_descricoes.py --aplicar    # aplica de fato
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

PALAVRAS_PROPAGANDA = ["apostila", "podcast"]
TAMANHO_PAGINA = 500


def _limpar_descricao(descricao: str) -> str:
    """Mesma lógica usada em raspar_artigo() — corta no primeiro parágrafo
    que mencionar propaganda (apostila/podcast), mantém o resto."""
    paragrafos = [p for p in descricao.split("\n\n") if p.strip()]
    limpos = []
    for p in paragrafos:
        p_lower = p.lower()
        if any(palavra in p_lower for palavra in PALAVRAS_PROPAGANDA):
            break
        limpos.append(p)
    return "\n\n".join(limpos).strip()


def _buscar_todos_com_descricao(db) -> list[dict]:
    linhas = []
    pagina = 0
    while True:
        inicio = pagina * TAMANHO_PAGINA
        res = (
            db.table("concursos")
            .select("id, orgao, descricao")
            .range(inicio, inicio + TAMANHO_PAGINA - 1)
            .execute()
        )
        lote = res.data or []
        linhas.extend(lote)
        if len(lote) < TAMANHO_PAGINA:
            break
        pagina += 1
    # Filtra no lado do Python — evita depender de sintaxe de filtro
    # not-null específica de versão do cliente supabase-py
    return [l for l in linhas if (l.get("descricao") or "").strip()]


def processar(db, aplicar: bool = False) -> dict:
    resultado = {"total": 0, "sujos": 0, "limpos": 0, "ignorados_vazio": 0}

    linhas = _buscar_todos_com_descricao(db)
    resultado["total"] = len(linhas)
    log.info(f"{len(linhas)} concursos com descrição pra revisar")

    for linha in linhas:
        descricao_original = linha["descricao"]
        descricao_limpa = _limpar_descricao(descricao_original)

        if descricao_limpa == descricao_original.strip():
            continue  # nada de propaganda encontrada, já estava limpo

        resultado["sujos"] += 1

        if not descricao_limpa:
            # Cortar tudo deixaria a descrição vazia — mais seguro não mexer
            # e revisar manualmente depois
            resultado["ignorados_vazio"] += 1
            log.warning(f"[Pular] '{linha['orgao'][:50]}' (id={linha['id']}) ficaria vazio — não alterado")
            continue

        prefixo = "APLICANDO" if aplicar else "DRY-RUN"
        log.info(f"[{prefixo}] '{linha['orgao'][:50]}' (id={linha['id']})")
        log.info(f"  Antes:  ...{descricao_original[-150:]!r}")
        log.info(f"  Depois: ...{descricao_limpa[-150:]!r}")

        if aplicar:
            try:
                db.table("concursos").update({"descricao": descricao_limpa}).eq("id", linha["id"]).execute()
                resultado["limpos"] += 1
            except Exception as e:
                log.error(f"Erro ao atualizar {linha['id']}: {e}")

    modo = "aplicadas" if aplicar else "identificadas (dry-run — nada foi escrito)"
    log.info(
        f"\nTotal: {resultado['total']} revisados | {resultado['sujos']} com propaganda "
        f"{modo} | {resultado['limpos']} atualizados de fato | "
        f"{resultado['ignorados_vazio']} pulados (ficariam vazios)"
    )
    if not aplicar and resultado["sujos"] > 0:
        log.info("Rode novamente com --aplicar pra gravar essas mudanças de verdade.")
    return resultado


if __name__ == "__main__":
    aplicar = "--aplicar" in sys.argv

    from dotenv import load_dotenv
    load_dotenv()
    from supabase import create_client

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    if not aplicar:
        log.info("Modo DRY-RUN — nada será escrito no banco. Use --aplicar pra gravar de verdade.\n")

    processar(supabase, aplicar=aplicar)

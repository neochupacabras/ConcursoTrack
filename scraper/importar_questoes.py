"""
ConcursoTrack — Importador de questões transcritas (provas reais)
====================================================================
Lê um JSON no formato descrito em docs/PIPELINE_QUESTOES.md e grava no banco:
  1. Resolve/cria a banca (por sigla, na tabela `bancas` já existente)
  2. Resolve/cria o órgão (por nome+estado, tabela `orgaos`)
  3. Cria a prova (tabela `provas`)
  4. Pra cada questão: resolve/cria matéria → tópico (assunto) → subtópico
     (tabela `materias`/`topicos`, hierarquia por parent_id) e insere a questão
     (tabela `questoes`, reaproveitando as colunas já existentes + as novas)

Idempotente: rodar o mesmo arquivo duas vezes não duplica nada — órgão/matéria/
tópico são resolvidos por nome (upsert), e questões têm UNIQUE(prova_id, numero)
(a prova em si pode duplicar se você importar o mesmo arquivo com um ID de prova
diferente — ver aviso no final da execução).

Uso:
    python scraper/importar_questoes.py caminho/para/prova.json
"""

import os
import sys
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

ALTERNATIVAS_VALIDAS = {"A", "B", "C", "D", "E"}

MAPA_AREA = {
    "fiscal_tributaria": ["fiscal", "receita", "fazenda", "tributar", "sefaz", "tribunal de contas", "auditor"],
    "seguranca_publica": ["polícia", "policia", "bombeiro", "penal", "guarda", "soldado"],
    "saude": ["saúde", "saude", "médico", "medico", "enfermeiro", "hospital"],
    "educacao": ["educação", "educacao", "professor", "escola", "magistério", "magisterio", "pedagógico", "pedagogico"],
    "tecnologia": ["tecnologia", "informática", "informatica", "dados", " ti "],
    "juridica": ["tribunal", "ministério público", "ministerio publico", "procuradoria", "juiz", "defensor", "promotor", "judiciário", "judiciario"],
}


def _inferir_area(cargo: str, orgao_nome: str) -> str:
    """Mesma heurística por palavra-chave usada nos scrapers — só uma aproximação,
    vale conferir manualmente se ficou certa."""
    txt = f"{cargo or ''} {orgao_nome or ''}".lower()
    for area, palavras in MAPA_AREA.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"


def _resolver_banca(db, sigla: str) -> str:
    """Acha a banca pela sigla; cria uma linha mínima se não existir."""
    res = db.table("bancas").select("id").eq("sigla", sigla).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    log.warning(f"Banca '{sigla}' não encontrada em `bancas` — criando registro mínimo")
    novo = db.table("bancas").insert({"nome": sigla, "sigla": sigla}).execute()
    return novo.data[0]["id"]


def _resolver_orgao(db, nome: str, esfera, estado) -> str:
    query = db.table("orgaos").select("id").eq("nome", nome)
    query = query.eq("estado", estado) if estado else query.is_("estado", "null")
    res = query.limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    novo = db.table("orgaos").insert({"nome": nome, "esfera": esfera, "estado": estado}).execute()
    return novo.data[0]["id"]


def _resolver_materia(db, nome: str) -> str:
    res = db.table("materias").select("id").eq("nome", nome).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    novo = db.table("materias").insert({"nome": nome}).execute()
    return novo.data[0]["id"]


def _resolver_topico(db, materia_id: str, parent_id, nome: str) -> str:
    query = db.table("topicos").select("id").eq("materia_id", materia_id).eq("nome", nome)
    query = query.eq("parent_id", parent_id) if parent_id else query.is_("parent_id", "null")
    res = query.limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    novo = db.table("topicos").insert({
        "materia_id": materia_id, "parent_id": parent_id, "nome": nome,
    }).execute()
    return novo.data[0]["id"]


def _resolver_topico_completo(db, materia_nome: str, assunto, subassunto):
    """Resolve a cadeia matéria -> assunto -> subassunto, criando o que faltar,
    e retorna o id do nó mais específico informado."""
    materia_id = _resolver_materia(db, materia_nome)
    if not assunto:
        return None
    assunto_id = _resolver_topico(db, materia_id, None, assunto)
    if not subassunto:
        return assunto_id
    return _resolver_topico(db, materia_id, assunto_id, subassunto)


def _validar_questao(q: dict, indice: int) -> list:
    erros = []
    campos_obrigatorios = ["numero", "materia", "enunciado", "alternativas", "gabarito"]
    for campo in campos_obrigatorios:
        if not q.get(campo) and q.get(campo) != 0:
            erros.append(f"questão #{indice} (numero={q.get('numero', '?')}): falta '{campo}'")

    alternativas = q.get("alternativas", {})
    if isinstance(alternativas, dict):
        letras_presentes = set(alternativas.keys())
        if not letras_presentes.issubset(ALTERNATIVAS_VALIDAS):
            erros.append(f"questão #{indice}: letras de alternativa inválidas: {letras_presentes - ALTERNATIVAS_VALIDAS}")
        for letra, texto in alternativas.items():
            if not texto or not str(texto).strip():
                erros.append(f"questão #{indice}: alternativa '{letra}' está vazia")

    gabarito = q.get("gabarito")
    if gabarito and gabarito not in alternativas:
        erros.append(f"questão #{indice}: gabarito '{gabarito}' não existe entre as alternativas informadas")

    return erros


def importar(db, caminho_json: str) -> dict:
    with open(caminho_json, "r", encoding="utf-8") as f:
        dados = json.load(f)

    prova_info = dados.get("prova", {})
    questoes = dados.get("questoes", [])

    if not questoes:
        log.error("Nenhuma questão encontrada no JSON — nada a importar")
        return {"importadas": 0, "erros": ["JSON sem questões"]}

    # Validação prévia — pega problema ANTES de gravar qualquer coisa no banco
    erros_validacao = []
    numeros_vistos = set()
    for i, q in enumerate(questoes, 1):
        erros_validacao.extend(_validar_questao(q, i))
        numero = q.get("numero")
        if numero in numeros_vistos:
            erros_validacao.append(f"questão #{i}: número {numero} repetido dentro do mesmo arquivo")
        numeros_vistos.add(numero)

    if erros_validacao:
        log.error(f"{len(erros_validacao)} erro(s) de validação — corrija o JSON antes de importar:")
        for erro in erros_validacao:
            log.error(f"  - {erro}")
        return {"importadas": 0, "erros": erros_validacao}

    banca_id = _resolver_banca(db, prova_info["banca_sigla"])
    orgao_id = _resolver_orgao(
        db, prova_info["orgao_nome"], prova_info.get("esfera"), prova_info.get("estado"),
    )

    prova = db.table("provas").insert({
        "banca_id": banca_id,
        "orgao_id": orgao_id,
        "cargo": prova_info.get("cargo"),
        "ano": prova_info.get("ano"),
        "escolaridade": prova_info.get("escolaridade"),
        "area_conhecimento": prova_info.get("area_conhecimento") or _inferir_area(
            prova_info.get("cargo"), prova_info.get("orgao_nome")
        ),
    }).execute()
    prova_id = prova.data[0]["id"]
    log.info(f"Prova criada: id={prova_id} ({prova_info.get('orgao_nome')} — {prova_info.get('cargo')}/{prova_info.get('ano')})")

    importadas, falhas = 0, []
    for q in questoes:
        try:
            topico_id = _resolver_topico_completo(
                db, q["materia"], q.get("assunto"), q.get("subassunto"),
            )
            db.table("questoes").insert({
                "prova_id":     prova_id,
                "numero":       q["numero"],
                "enunciado":    q["enunciado"],
                "texto_apoio":  q.get("texto_apoio"),
                "alternativas": q["alternativas"],
                "gabarito":     q["gabarito"],
                "materia":      q["materia"],
                "topico_id":    topico_id,
                "banca_sigla":  prova_info["banca_sigla"],
                "ano":          prova_info.get("ano"),
                "anulada":      q.get("anulada", False),
                "premium":      q.get("premium", False),
                "concurso_id":  prova_info.get("concurso_id"),
            }).execute()
            importadas += 1
        except Exception as e:
            falhas.append(f"questão numero={q.get('numero')}: {e}")
            log.error(f"Erro ao importar questão numero={q.get('numero')}: {e}")

    log.info(f"Total: {importadas}/{len(questoes)} questões importadas, {len(falhas)} falharam")
    if importadas > 0:
        log.info(
            "Lembrete: se importar este mesmo arquivo de novo, uma NOVA prova será criada "
            "(cria uma prova por execução) — apague a prova antiga antes de reimportar, "
            "ou ajuste manualmente se for só correção pontual."
        )
    return {"importadas": importadas, "falhas": falhas, "prova_id": prova_id}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scraper/importar_questoes.py caminho/para/prova.json")
        sys.exit(1)

    from dotenv import load_dotenv
    load_dotenv()
    from supabase import create_client

    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    importar(supabase, sys.argv[1])

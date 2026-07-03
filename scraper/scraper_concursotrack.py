"""
ConcursoTrack — Scraper de Editais
===================================
Raspa concursos do PCI Concursos e persiste no Supabase.
Executado via GitHub Actions (cron diário) ou manualmente.

Dependências:
    pip install httpx beautifulsoup4 supabase python-dotenv

Variáveis de ambiente (.env ou GitHub Secrets):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

import os
import re
import time
import hashlib
import logging
from datetime import datetime, date
from dataclasses import dataclass, field, asdict
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ConcursoTrackBot/1.0; "
        "+https://concursotrack.com.br/bot)"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
}

DELAY_ENTRE_PAGINAS = 2.0   # segundos entre requisições
MAX_PAGINAS = 50             # limite de segurança por execução

# Mapeamento de esferas detectadas via texto
ESFERA_KEYWORDS = {
    "federal":   ["federal", "união", "ministério", "ibge", "inss", "receita federal"],
    "estadual":  ["estadual", "governo do estado", "secretaria de estado"],
    "municipal": ["prefeitura", "câmara municipal", "municipal"],
}

# Mapeamento de áreas de conhecimento por palavras-chave no título/cargo
AREA_KEYWORDS = {
    "fiscal_tributaria":     ["fiscal", "tributário", "receita", "fazenda", "auditor"],
    "seguranca_publica":     ["policial", "delegado", "perito", "agente penitenciário"],
    "saude":                 ["médico", "enfermeiro", "farmacêutico", "nutricionista", "psicólogo"],
    "educacao":              ["professor", "pedagogo", "diretor escolar"],
    "administrativa":        ["técnico administrativo", "analista administrativo", "assistente"],
    "tecnologia":            ["analista de ti", "técnico de ti", "desenvolvedor", "banco de dados"],
    "engenharia":            ["engenheiro", "arquiteto", "técnico em edificações"],
    "juridica":              ["advogado", "procurador", "defensor", "promotor", "juiz"],
}


# ---------------------------------------------------------------------------
# Modelos de dados
# ---------------------------------------------------------------------------

@dataclass
class Cargo:
    titulo: str
    escolaridade: str
    vagas: int
    salario_inicial: Optional[float]
    salario_final: Optional[float]
    localidade: str


@dataclass
class Concurso:
    titulo: str
    orgao: str
    banca_sigla: str
    esfera: str
    estado: Optional[str]
    area_conhecimento: str
    status: str                     # aberto | encerrado | suspenso | previsto
    total_vagas: int
    data_abertura: Optional[date]
    data_encerramento: Optional[date]
    data_prova: Optional[date]
    edital_url: Optional[str]
    fonte_url: str
    cargos: list[Cargo] = field(default_factory=list)

    @property
    def slug(self) -> str:
        """Gera slug único a partir do título e órgão."""
        base = f"{self.orgao}-{self.titulo}".lower()
        base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
        sufixo = hashlib.md5(self.fonte_url.encode()).hexdigest()[:6]
        return f"{base}-{sufixo}"


# ---------------------------------------------------------------------------
# Utilitários de parsing
# ---------------------------------------------------------------------------

def parse_data_br(texto: str) -> Optional[date]:
    """Converte datas nos formatos dd/mm/yyyy e yyyy-mm-dd."""
    texto = texto.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def parse_salario(texto: str) -> Optional[float]:
    """Extrai valor numérico de strings como 'R$ 3.456,78'."""
    texto = re.sub(r"[R$\s]", "", texto)
    texto = texto.replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def detectar_esfera(texto: str) -> str:
    txt = texto.lower()
    for esfera, palavras in ESFERA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return esfera
    return "nao_identificada"


def detectar_area(titulo: str, cargos_texto: str = "") -> str:
    txt = (titulo + " " + cargos_texto).lower()
    for area, palavras in AREA_KEYWORDS.items():
        if any(p in txt for p in palavras):
            return area
    return "administrativa"  # fallback mais comum


def detectar_estado(texto: str) -> Optional[str]:
    """Extrai sigla UF de textos como 'Governo de São Paulo - SP'."""
    match = re.search(r"\b([A-Z]{2})\b", texto)
    if match:
        sigla = match.group(1)
        ufs_validas = {
            "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS",
            "MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC",
            "SE","SP","TO",
        }
        if sigla in ufs_validas:
            return sigla
    return None


# ---------------------------------------------------------------------------
# Scraper — PCI Concursos
# ---------------------------------------------------------------------------

class PCIScaper:
    """
    Raspa concursos abertos do PCI Concursos (pciconcursos.com.br).

    Estratégia:
        1. Itera as páginas da listagem de concursos abertos
        2. Para cada card de concurso, extrai dados da listagem
        3. Acessa a página individual para dados completos (cargos, datas)
        4. Normaliza e retorna objetos Concurso
    """

    BASE_URL = "https://www.pciconcursos.com.br"
    LISTA_URL = f"{BASE_URL}/concursos/abertos/"

    def __init__(self, client: httpx.Client):
        self.client = client

    def _get(self, url: str) -> Optional[BeautifulSoup]:
        try:
            r = self.client.get(url, timeout=15)
            r.raise_for_status()
            return BeautifulSoup(r.text, "html.parser")
        except httpx.HTTPError as e:
            log.warning(f"Erro HTTP ao acessar {url}: {e}")
            return None

    def _parse_card_listagem(self, card) -> Optional[dict]:
        """Extrai dados básicos de um card na página de listagem."""
        try:
            titulo_el = card.select_one(".titulo-concurso, h2 a, .concurso-nome a")
            if not titulo_el:
                return None

            titulo = titulo_el.get_text(strip=True)
            href = titulo_el.get("href", "")
            url = href if href.startswith("http") else self.BASE_URL + href

            orgao_el = card.select_one(".orgao, .instituicao, .concurso-orgao")
            orgao = orgao_el.get_text(strip=True) if orgao_el else titulo

            vagas_el = card.select_one(".vagas, .numero-vagas")
            vagas_txt = vagas_el.get_text(strip=True) if vagas_el else "0"
            vagas = int(re.sub(r"\D", "", vagas_txt) or "0")

            banca_el = card.select_one(".banca, .organizadora")
            banca = banca_el.get_text(strip=True) if banca_el else "Não informada"

            return {
                "titulo": titulo,
                "orgao": orgao,
                "banca_sigla": banca[:20],
                "total_vagas": vagas,
                "fonte_url": url,
            }
        except Exception as e:
            log.debug(f"Falha ao parsear card: {e}")
            return None

    def _parse_pagina_concurso(self, soup: BeautifulSoup, dados_base: dict) -> Concurso:
        """Extrai dados completos da página individual do concurso."""

        # Datas
        data_abertura = data_encerramento = data_prova = None
        for label in soup.select(".campo-data, .info-data, dt"):
            txt = label.get_text(strip=True).lower()
            valor_el = label.find_next_sibling()
            valor = valor_el.get_text(strip=True) if valor_el else ""
            if "abertura" in txt or "inscrição" in txt:
                data_abertura = parse_data_br(valor)
            elif "encerramento" in txt or "prazo" in txt:
                data_encerramento = parse_data_br(valor)
            elif "prova" in txt or "aplicação" in txt:
                data_prova = parse_data_br(valor)

        # Edital
        edital_url = None
        for link in soup.select("a[href]"):
            href = link["href"]
            if "edital" in href.lower() or "edital" in link.get_text().lower():
                edital_url = href if href.startswith("http") else self.BASE_URL + href
                break

        # Cargos
        cargos: list[Cargo] = []
        tabela = soup.select_one("table.cargos, table.vagas, .lista-cargos table")
        if tabela:
            for linha in tabela.select("tr")[1:]:   # pula cabeçalho
                cels = [td.get_text(strip=True) for td in linha.select("td")]
                if len(cels) >= 3:
                    cargos.append(Cargo(
                        titulo=cels[0],
                        escolaridade=cels[1] if len(cels) > 1 else "",
                        vagas=int(re.sub(r"\D", "", cels[2]) or "0") if len(cels) > 2 else 0,
                        salario_inicial=parse_salario(cels[3]) if len(cels) > 3 else None,
                        salario_final=parse_salario(cels[4]) if len(cels) > 4 else None,
                        localidade=cels[5] if len(cels) > 5 else dados_base["orgao"],
                    ))

        texto_completo = soup.get_text(" ")
        cargos_texto = " ".join(c.titulo for c in cargos)

        return Concurso(
            titulo=dados_base["titulo"],
            orgao=dados_base["orgao"],
            banca_sigla=dados_base["banca_sigla"],
            esfera=detectar_esfera(texto_completo),
            estado=detectar_estado(dados_base["orgao"] + " " + texto_completo),
            area_conhecimento=detectar_area(dados_base["titulo"], cargos_texto),
            status="aberto",
            total_vagas=dados_base["total_vagas"] or sum(c.vagas for c in cargos),
            data_abertura=data_abertura,
            data_encerramento=data_encerramento,
            data_prova=data_prova,
            edital_url=edital_url,
            fonte_url=dados_base["fonte_url"],
            cargos=cargos,
        )

    def scrape(self, max_paginas: int = MAX_PAGINAS) -> list[Concurso]:
        concursos: list[Concurso] = []

        for pagina in range(1, max_paginas + 1):
            url = self.LISTA_URL if pagina == 1 else f"{self.LISTA_URL}?pagina={pagina}"
            log.info(f"Raspando listagem — página {pagina}: {url}")
            soup = self._get(url)
            if not soup:
                break

            cards = soup.select(".concurso-card, .item-concurso, article.concurso")
            if not cards:
                log.info(f"Nenhum card encontrado na página {pagina}, encerrando.")
                break

            for card in cards:
                dados_base = self._parse_card_listagem(card)
                if not dados_base:
                    continue

                time.sleep(DELAY_ENTRE_PAGINAS)
                soup_individual = self._get(dados_base["fonte_url"])
                if not soup_individual:
                    continue

                concurso = self._parse_pagina_concurso(soup_individual, dados_base)
                concursos.append(concurso)
                log.info(f"  + {concurso.orgao} ({concurso.total_vagas} vagas)")

            time.sleep(DELAY_ENTRE_PAGINAS)

        log.info(f"Total raspado: {len(concursos)} concursos")
        return concursos


# ---------------------------------------------------------------------------
# Persistência — Supabase (upsert por slug)
# ---------------------------------------------------------------------------

class SupabaseWriter:
    def __init__(self, client: Client):
        self.db = client

    def _garantir_banca(self, sigla: str) -> Optional[str]:
        """Retorna id da banca, criando se não existir."""
        res = self.db.table("bancas").select("id").eq("sigla", sigla).maybe_single().execute()
        if res.data:
            return res.data["id"]
        ins = self.db.table("bancas").insert({"nome": sigla, "sigla": sigla}).execute()
        return ins.data[0]["id"] if ins.data else None

    def salvar(self, concurso: Concurso) -> bool:
        try:
            banca_id = self._garantir_banca(concurso.banca_sigla)

            payload = {
                "slug":               concurso.slug,
                "banca_id":           banca_id,
                "titulo":             concurso.titulo,
                "orgao":              concurso.orgao,
                "esfera":             concurso.esfera,
                "estado":             concurso.estado,
                "area_conhecimento":  concurso.area_conhecimento,
                "status":             concurso.status,
                "total_vagas":        concurso.total_vagas,
                "data_abertura":      concurso.data_abertura.isoformat() if concurso.data_abertura else None,
                "data_encerramento":  concurso.data_encerramento.isoformat() if concurso.data_encerramento else None,
                "data_prova":         concurso.data_prova.isoformat() if concurso.data_prova else None,
                "edital_url":         concurso.edital_url,
                "fonte_url":          concurso.fonte_url,
                "scraped_em":         datetime.utcnow().isoformat(),
            }

            # Upsert: atualiza se o slug já existe
            res = (
                self.db.table("concursos")
                .upsert(payload, on_conflict="slug")
                .execute()
            )

            if not res.data:
                return False

            concurso_id = res.data[0]["id"]

            # Salva cargos (deleta antigos e reinsere)
            if concurso.cargos:
                self.db.table("cargos").delete().eq("concurso_id", concurso_id).execute()
                cargos_payload = [
                    {
                        "concurso_id":    concurso_id,
                        "titulo":         c.titulo,
                        "escolaridade":   c.escolaridade,
                        "vagas":          c.vagas,
                        "salario_inicial": c.salario_inicial,
                        "salario_final":  c.salario_final,
                        "localidade":     c.localidade,
                    }
                    for c in concurso.cargos
                ]
                self.db.table("cargos").insert(cargos_payload).execute()

            return True

        except Exception as e:
            log.error(f"Erro ao salvar '{concurso.titulo}': {e}")
            return False


# ---------------------------------------------------------------------------
# Notificações — dispara alertas de usuários após import
# ---------------------------------------------------------------------------

def disparar_alertas(db: Client, novos_ids: list[str]) -> int:
    """
    Para cada concurso novo, verifica alertas cadastrados
    e insere notificações na fila (tabela notificacoes_fila).
    A fila é processada por uma Edge Function separada (Resend).
    """
    if not novos_ids:
        return 0

    enviados = 0
    for concurso_id in novos_ids:
        concurso = db.table("concursos").select("*").eq("id", concurso_id).single().execute().data
        if not concurso:
            continue

        alertas = (
            db.table("alertas")
            .select("*")
            .eq("ativo", True)
            .or_(
                f"area_conhecimento.eq.{concurso['area_conhecimento']},"
                f"area_conhecimento.is.null"
            )
            .execute()
            .data
        )

        for alerta in alertas:
            # Filtra por estado se o alerta tiver estado definido
            if alerta.get("estado") and alerta["estado"] != concurso.get("estado"):
                continue
            if alerta.get("esfera") and alerta["esfera"] != concurso.get("esfera"):
                continue

            db.table("notificacoes_fila").insert({
                "user_id":      alerta["user_id"],
                "concurso_id":  concurso_id,
                "canal":        alerta.get("canal", "email"),
                "enviado":      False,
                "criado_em":    datetime.utcnow().isoformat(),
            }).execute()
            enviados += 1

    log.info(f"Alertas enfileirados: {enviados}")
    return enviados


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    log.info("=== ConcursoTrack Scraper iniciado ===")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    writer = SupabaseWriter(supabase)

    with httpx.Client(headers=HEADERS, follow_redirects=True) as http:
        scraper = PCIScaper(http)
        concursos = scraper.scrape()

    salvos = 0
    novos_ids: list[str] = []

    for concurso in concursos:
        # Verifica se já existia antes do upsert
        existia = (
            supabase.table("concursos")
            .select("id")
            .eq("slug", concurso.slug)
            .maybe_single()
            .execute()
            .data
        )

        ok = writer.salvar(concurso)
        if ok:
            salvos += 1
            if not existia:
                # Busca o id recém-inserido para a fila de alertas
                novo = (
                    supabase.table("concursos")
                    .select("id")
                    .eq("slug", concurso.slug)
                    .single()
                    .execute()
                    .data
                )
                if novo:
                    novos_ids.append(novo["id"])

    log.info(f"Concursos salvos/atualizados: {salvos}/{len(concursos)}")
    log.info(f"Concursos novos (para alertas): {len(novos_ids)}")

    disparar_alertas(supabase, novos_ids)
    log.info("=== Scraper finalizado ===")


if __name__ == "__main__":
    main()

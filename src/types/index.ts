// ============================================================
// ConcursoTrack — Tipos TypeScript
// ============================================================

export type Esfera = 'federal' | 'estadual' | 'municipal' | 'nao_identificada'
export type Status = 'aberto' | 'encerrado' | 'suspenso' | 'previsto'
export type Plano  = 'free' | 'pro'
export type Canal  = 'email' | 'push'

// --------------- Núcleo ---------------

export interface Banca {
  id: string
  nome: string
  sigla: string
  site_url: string | null
  logo_url: string | null
  criado_em: string
}

export interface Cargo {
  id: string
  concurso_id: string
  titulo: string
  escolaridade: string | null
  vagas: number
  salario_inicial: number | null
  salario_final:   number | null
  localidade: string | null
}

export interface Concurso {
  id: string
  banca_id: string | null
  slug: string
  titulo: string
  orgao: string
  esfera: Esfera | null
  estado: string | null
  area_conhecimento: string | null
  status: Status
  total_vagas: number
  data_abertura:      string | null
  data_encerramento:  string | null
  data_prova:         string | null
  edital_url:  string | null
  fonte_url:   string
  scraped_em:  string | null
  criado_em:   string
  // campos de deduplicação entre fontes (PCI vs bancas dedicadas)
  oculto?:        boolean
  mesclado_com?:  string | null
  // campos de enriquecimento
  descricao?:   string | null
  links_pdf?:   string | null   // JSON string de [{titulo, url}]
  // relações opcionais (join)
  bancas?:            Banca
  cargos?:            Cargo[]
  provas_anteriores?: ProvaAnterior[]
}

export interface ProvaAnterior {
  id: string
  concurso_id: string
  ano: number | null
  tipo: string | null
  pdf_url: string
  gabarito_url: string | null
  criado_em: string
}

// --------------- Usuário ---------------

export interface Profile {
  id: string
  nome: string | null
  email: string | null
  plano: Plano
  stripe_customer_id: string | null
  plano_expira_em: string | null
  criado_em: string
}

export interface Alerta {
  id: string
  user_id: string
  area_conhecimento: string | null
  estado: string | null
  esfera: Esfera | null
  orgao:  string | null
  canal:  Canal
  ativo:  boolean
  criado_em: string
}

// --------------- Simulados ---------------

export interface Orgao {
  id: string
  nome: string
  esfera: Esfera | null
  estado: string | null
  criado_em: string
}

export interface Materia {
  id: string
  nome: string
}

export interface Topico {
  id: string
  materia_id: string
  parent_id: string | null
  nome: string
}

export interface Prova {
  id: string
  banca_id: string | null
  orgao_id: string | null
  concurso_id: string | null
  cargo: string | null
  ano: number | null
  escolaridade: string | null
  area_conhecimento: string | null
  criado_em: string
}

export type Alternativas = Record<'A' | 'B' | 'C' | 'D' | 'E', string>

export interface Questao {
  id: string
  concurso_id: string | null
  prova_id: string | null
  numero: number | null
  enunciado: string
  texto_apoio: string | null
  alternativas: Alternativas
  gabarito: string
  materia: string | null
  topico_id: string | null
  banca_sigla: string | null
  ano: number | null
  anulada: boolean
  premium: boolean
  criado_em: string
}

export interface Simulado {
  id: string
  user_id: string
  concurso_id: string | null
  total_questoes: number
  acertos: number
  tempo_segundos: number | null
  concluido: boolean
  iniciado_em: string
  concluido_em: string | null
}

export interface RespostaSimulado {
  id: string
  simulado_id: string
  questao_id:  string
  resposta_usuario: string | null
  correta: boolean | null
}

// --------------- API responses ---------------

export interface ConcursosListResponse {
  data: Concurso[]
  total: number
  pagina: number
  por_pagina: number
}

export interface BuscaParams {
  q?: string
  area?: string
  esfera?: Esfera
  estado?: string
  status?: Status
  pagina?: number
}

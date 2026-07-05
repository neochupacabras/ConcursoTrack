import { createClient } from './supabase/server'
import type { BuscaParams, Concurso, ConcursosListResponse } from '@/types'

const POR_PAGINA = 20

/**
 * Lista concursos com filtros. Usado pela página de busca e pela API.
 */
export async function getConcursos(params: BuscaParams = {}): Promise<ConcursosListResponse> {
  const supabase = await createClient()
  const { q, area, esfera, estado, status = 'aberto', pagina = 1 } = params
  const from = (pagina - 1) * POR_PAGINA

  let query = supabase
    .from('concursos')
    .select('*, bancas(sigla, logo_url)', { count: 'exact' })
    .eq('status', status)
    .eq('oculto', false)
    .order('data_encerramento', { ascending: true })
    .range(from, from + POR_PAGINA - 1)

  if (q) query = query.ilike('titulo || \' \' || orgao', `%${q}%`)
  if (area) query = query.eq('area_conhecimento', area)
  if (esfera) query = query.eq('esfera', esfera)
  if (estado) query = query.eq('estado', estado)

  const { data, count, error } = await query
  if (error) throw error

  return {
    data: (data ?? []) as Concurso[],
    total: count ?? 0,
    pagina,
    por_pagina: POR_PAGINA,
  }
}

/**
 * Busca concurso único por slug com cargos e provas anteriores.
 */
export async function getConcursoBySlug(slug: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('concursos')
    .select(`
      *,
      bancas(nome, sigla, site_url, logo_url),
      cargos(*),
      provas_anteriores(*)
    `)
    .eq('slug', slug)
    .single()
  // descricao e links_pdf já vêm no * acima

  if (error) return null
  return data as Concurso
}

/**
 * Concursos com prazo encerrando nos próximos N dias.
 * Usado no widget de destaques da home.
 */
export async function getConcursosUrgentes(dias = 7) {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const limite = new Date(Date.now() + dias * 86_400_000).toISOString().split('T')[0]

  const { data } = await supabase
    .from('concursos')
    .select('id, slug, titulo, orgao, data_encerramento, total_vagas, area_conhecimento, esfera, estado, status')
    .eq('status', 'aberto')
    .eq('oculto', false)
    .gte('data_encerramento', hoje)
    .lte('data_encerramento', limite)
    .order('data_encerramento', { ascending: true })
    .limit(6)

  return data ?? []
}

/**
 * Questões para simulado — filtra premium se usuário for free.
 */
export async function getQuestoesPorConcurso(concursoId: string, isPro: boolean, limit = 20) {
  const supabase = await createClient()

  let query = supabase
    .from('questoes')
    .select('*')
    .eq('concurso_id', concursoId)
    .limit(limit)

  if (!isPro) query = query.eq('premium', false)

  const { data } = await query
  return data ?? []
}

// ============================================================
// Queries de Simulado
// ============================================================

/**
 * Lista simulados do usuário com nome do concurso.
 */
export async function getSimuladosDoUsuario(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('simulados')
    .select('*, concursos(titulo, orgao, slug)')
    .eq('user_id', userId)
    .order('iniciado_em', { ascending: false })
  return data ?? []
}

/**
 * Busca simulado completo com todas as respostas e questões.
 * Usado na tela de resultado.
 */
export async function getSimuladoCompleto(simuladoId: string, userId: string) {
  const supabase = await createClient()
  const { data: simulado } = await supabase
    .from('simulados')
    .select('*, concursos(titulo, orgao, slug, area_conhecimento)')
    .eq('id', simuladoId)
    .eq('user_id', userId)
    .single()

  if (!simulado) return null

  const { data: respostas } = await supabase
    .from('respostas_simulado')
    .select('*, questoes(*)')
    .eq('simulado_id', simuladoId)

  return { simulado, respostas: respostas ?? [] }
}

/**
 * Cria um novo simulado e retorna o id.
 */
export async function criarSimulado(
  userId: string,
  concursoId: string,
  questaoIds: string[]
) {
  const supabase = await createClient()

  const { data: simulado, error } = await supabase
    .from('simulados')
    .insert({
      user_id:        userId,
      concurso_id:    concursoId,
      total_questoes: questaoIds.length,
      acertos:        0,
      concluido:      false,
    })
    .select('id')
    .single()

  if (error || !simulado) throw error

  const respostas = questaoIds.map((qid) => ({
    simulado_id:      simulado.id,
    questao_id:       qid,
    resposta_usuario: null,
    correta:          null,
  }))

  await supabase.from('respostas_simulado').insert(respostas)

  return simulado.id as string
}

/**
 * Registra resposta de uma questão e retorna se está correta.
 */
export async function responderQuestao(
  simuladoId: string,
  questaoId:  string,
  resposta:   string,
  gabarito:   string
) {
  const supabase = await createClient()
  const correta  = resposta.toUpperCase() === gabarito.toUpperCase()

  await supabase
    .from('respostas_simulado')
    .update({ resposta_usuario: resposta, correta })
    .eq('simulado_id', simuladoId)
    .eq('questao_id',  questaoId)

  return correta
}

/**
 * Finaliza o simulado: conta acertos e marca como concluído.
 */
export async function finalizarSimulado(simuladoId: string, tempoSegundos: number) {
  const supabase = await createClient()

  const { data: respostas } = await supabase
    .from('respostas_simulado')
    .select('correta')
    .eq('simulado_id', simuladoId)

  const acertos = (respostas ?? []).filter((r) => r.correta).length

  await supabase
    .from('simulados')
    .update({
      acertos,
      tempo_segundos: tempoSegundos,
      concluido:      true,
      concluido_em:   new Date().toISOString(),
    })
    .eq('id', simuladoId)

  return acertos
}

// ============================================================
// Queries de Alertas
// ============================================================

/**
 * Lista todos os alertas do usuário (ativos e inativos).
 */
export async function getAlertasDoUsuario(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('alertas')
    .select('*')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
  return data ?? []
}

/**
 * Cria um novo alerta. Retorna erro se já existir um idêntico.
 */
export async function criarAlerta(
  userId: string,
  params: {
    area_conhecimento?: string | null
    estado?: string | null
    esfera?: string | null
    orgao?: string | null
    canal?: string
  }
) {
  const supabase = await createClient()

  // Verifica duplicata ativa
  let query = supabase
    .from('alertas')
    .select('id')
    .eq('user_id', userId)
    .eq('ativo', true)

  if (params.area_conhecimento) query = query.eq('area_conhecimento', params.area_conhecimento)
  else query = query.is('area_conhecimento', null)

  if (params.estado) query = query.eq('estado', params.estado)
  else query = query.is('estado', null)

  if (params.esfera) query = query.eq('esfera', params.esfera)
  else query = query.is('esfera', null)

  const { data: existente } = await query.maybeSingle()
  if (existente) return { error: 'Você já tem um alerta com esses critérios.' }

  const { data, error } = await supabase
    .from('alertas')
    .insert({
      user_id:           userId,
      area_conhecimento: params.area_conhecimento ?? null,
      estado:            params.estado ?? null,
      esfera:            params.esfera ?? null,
      orgao:             params.orgao ?? null,
      canal:             params.canal ?? 'email',
      ativo:             true,
    })
    .select('*')
    .single()

  if (error) return { error: 'Erro ao criar alerta.' }
  return { data }
}

/**
 * Ativa ou desativa um alerta.
 */
export async function toggleAlerta(alertaId: string, userId: string, ativo: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('alertas')
    .update({ ativo })
    .eq('id', alertaId)
    .eq('user_id', userId)
  return !error
}

/**
 * Remove um alerta definitivamente.
 */
export async function deletarAlerta(alertaId: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('alertas')
    .delete()
    .eq('id', alertaId)
    .eq('user_id', userId)
  return !error
}

/**
 * Busca notificações pendentes para envio (usada pela Edge Function / cron).
 * Retorna no máximo 50 para processar em batch.
 */
export async function getNotificacoesPendentes(limit = 50) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notificacoes_fila')
    .select(`
      id,
      canal,
      user_id,
      concurso_id,
      profiles ( email, nome ),
      concursos ( titulo, orgao, slug, data_encerramento, total_vagas, area_conhecimento )
    `)
    .eq('enviado', false)
    .order('criado_em', { ascending: true })
    .limit(limit)
  return data ?? []
}

/**
 * Marca notificações como enviadas.
 */
export async function marcarNotificacoesEnviadas(ids: string[]) {
  const supabase = await createClient()
  await supabase
    .from('notificacoes_fila')
    .update({ enviado: true, enviado_em: new Date().toISOString() })
    .in('id', ids)
}

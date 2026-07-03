import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuestoesPorConcurso, criarSimulado } from '@/lib/queries'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const { concurso_id, total = 10 } = body

  if (!concurso_id) {
    return NextResponse.json({ error: 'concurso_id obrigatório' }, { status: 400 })
  }

  // Verifica plano do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('plano, plano_expira_em')
    .eq('id', user.id)
    .single()

  const isPro = profile?.plano === 'pro' &&
    (!profile.plano_expira_em || new Date(profile.plano_expira_em) > new Date())

  // Limita questões para free
  const limite = isPro ? Math.min(total, 40) : Math.min(total, 10)

  const questoes = await getQuestoesPorConcurso(concurso_id, isPro, limite)

  if (questoes.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma questão disponível para este concurso' },
      { status: 404 }
    )
  }

  try {
    const simuladoId = await criarSimulado(
      user.id,
      concurso_id,
      questoes.map((q) => q.id)
    )
    return NextResponse.json({ simulado_id: simuladoId, total: questoes.length })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar simulado' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { responderQuestao, finalizarSimulado } from '@/lib/queries'

interface Params { params: Promise<{ id: string }> }

// PATCH — salva resposta de uma questão
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id: simuladoId } = await params
  const { questao_id, resposta, gabarito } = await request.json()

  // Garante que o simulado pertence ao usuário
  const { data: sim } = await supabase
    .from('simulados')
    .select('id, concluido')
    .eq('id', simuladoId)
    .eq('user_id', user.id)
    .single()

  if (!sim) return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 })
  if (sim.concluido) return NextResponse.json({ error: 'Simulado já finalizado' }, { status: 400 })

  const correta = await responderQuestao(simuladoId, questao_id, resposta, gabarito)
  return NextResponse.json({ correta })
}

// POST — finaliza o simulado
export async function POST(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id: simuladoId } = await params
  const { tempo_segundos = 0 } = await request.json()

  const { data: sim } = await supabase
    .from('simulados')
    .select('id')
    .eq('id', simuladoId)
    .eq('user_id', user.id)
    .single()

  if (!sim) return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 })

  const acertos = await finalizarSimulado(simuladoId, tempo_segundos)
  return NextResponse.json({ acertos })
}

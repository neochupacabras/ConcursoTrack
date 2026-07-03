import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAlertasDoUsuario, criarAlerta } from '@/lib/queries'

// GET — lista alertas do usuário autenticado
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const alertas = await getAlertasDoUsuario(user.id)
  return NextResponse.json(alertas)
}

// POST — cria novo alerta
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const { area_conhecimento, estado, esfera, orgao, canal } = body

  // Pelo menos um critério obrigatório
  if (!area_conhecimento && !estado && !esfera && !orgao) {
    return NextResponse.json(
      { error: 'Informe ao menos um critério: área, estado, esfera ou órgão.' },
      { status: 400 }
    )
  }

  const resultado = await criarAlerta(user.id, { area_conhecimento, estado, esfera, orgao, canal })

  if (resultado.error) {
    return NextResponse.json({ error: resultado.error }, { status: 409 })
  }

  return NextResponse.json(resultado.data, { status: 201 })
}

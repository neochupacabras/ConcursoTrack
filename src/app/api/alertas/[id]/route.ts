import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toggleAlerta, deletarAlerta } from '@/lib/queries'

interface Params { params: Promise<{ id: string }> }

// PATCH — ativa ou desativa
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const { ativo } = await request.json()

  const ok = await toggleAlerta(id, user.id, ativo)
  if (!ok) return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove definitivamente
export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const ok = await deletarAlerta(id, user.id)
  if (!ok) return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

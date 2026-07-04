import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

  if (ids.length < 2 || ids.length > 4) {
    return NextResponse.json(
      { error: 'Informe entre 2 e 4 IDs de concursos.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('concursos')
    .select(`
      id, slug, titulo, orgao, esfera, estado,
      area_conhecimento, status, total_vagas,
      data_abertura, data_encerramento, data_prova,
      edital_url, fonte_url,
      bancas ( nome, sigla ),
      cargos ( titulo, escolaridade, vagas, salario_inicial, salario_final, localidade )
    `)
    .in('id', ids)

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar concursos.' }, { status: 500 })
  }

  // Mantém a ordem dos IDs solicitados
  const ordenado = ids
    .map((id) => data?.find((c) => c.id === id))
    .filter(Boolean)

  return NextResponse.json(ordenado)
}

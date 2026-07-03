import { NextResponse } from 'next/server'
import { getConcursos } from '@/lib/queries'
import type { BuscaParams, Esfera, Status } from '@/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const params: BuscaParams = {
    q:      searchParams.get('q') ?? undefined,
    area:   searchParams.get('area') ?? undefined,
    esfera: searchParams.get('esfera') as Esfera | undefined,
    estado: searchParams.get('estado') ?? undefined,
    status: (searchParams.get('status') as Status | undefined) ?? 'aberto',
    pagina: searchParams.has('pagina') ? Number(searchParams.get('pagina')) : 1,
  }

  try {
    const resultado = await getConcursos(params)
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[GET /api/concursos]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

import { Suspense } from 'react'
import { getConcursos } from '@/lib/queries'
import { ConcursoCard } from '@/components/concursos/ConcursoCard'
import { FiltrosBusca } from '@/components/concursos/FiltrosBusca'
import { Paginacao } from '@/components/ui/Paginacao'
import type { Metadata } from 'next'
import type { BuscaParams, Esfera, Status } from '@/types'

export const metadata: Metadata = {
  title: 'Busca de concursos públicos',
  description: 'Filtre editais por área, estado, esfera e data de encerramento.',
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function BuscaPage({ searchParams }: Props) {
  const sp = await searchParams

  const params: BuscaParams = {
    q:      sp.q      as string | undefined,
    area:   sp.area   as string | undefined,
    esfera: sp.esfera as Esfera | undefined,
    estado: sp.estado as string | undefined,
    status: (sp.status as Status | undefined) ?? 'aberto',
    pagina: sp.pagina ? Number(sp.pagina) : 1,
  }

  const resultado = await getConcursos(params)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">Busca de concursos</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 flex-shrink-0">
          <FiltrosBusca params={params} />
        </aside>

        <div className="flex-1">
          <p className="text-sm text-slate-500 mb-4">
            {resultado.total.toLocaleString('pt-BR')} concurso
            {resultado.total !== 1 ? 's' : ''} encontrado
            {resultado.total !== 1 ? 's' : ''}
          </p>

          <Suspense fallback={<div className="h-96 bg-slate-100 rounded-xl animate-pulse" />}>
            {resultado.data.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-lg mb-2">Nenhum concurso encontrado</p>
                <p className="text-sm">Tente ajustar os filtros ou ampliar a busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {resultado.data.map((c) => (
                  <ConcursoCard key={c.id} concurso={c} />
                ))}
              </div>
            )}
          </Suspense>

          <div className="mt-8">
            <Paginacao
              paginaAtual={resultado.pagina}
              total={resultado.total}
              porPagina={resultado.por_pagina}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

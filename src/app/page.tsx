import { Suspense } from 'react'
import { getConcursosUrgentes } from '@/lib/queries'
import { ConcursoCard } from '@/components/concursos/ConcursoCard'
import { HeroSearch } from '@/components/layout/HeroSearch'
import { AlertasBanner } from '@/components/layout/AlertasBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ConcursoTrack — Concursos Públicos do Brasil',
  description: 'Editais abertos, simulados gratuitos e alertas de novos concursos.',
}

// Revalida a cada 1 hora
export const revalidate = 3600

export default async function HomePage() {
  const urgentes = await getConcursosUrgentes(7)

  return (
    <>
      <HeroSearch />

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Inscrições encerrando em breve
          </h2>
          <a href="/busca" className="text-sm text-blue-600 hover:underline">
            Ver todos →
          </a>
        </div>

        <Suspense fallback={<ConcursoGridSkeleton />}>
          {urgentes.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Nenhum concurso com prazo curto no momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {urgentes.map((c) => (
                <ConcursoCard key={c.id} concurso={c} />
              ))}
            </div>
          )}
        </Suspense>
      </section>

      <AlertasBanner />

      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-semibold mb-8 text-slate-900">
            Por que usar o ConcursoTrack?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.titulo} className="bg-white rounded-xl p-6 border border-slate-100">
                <div className="text-2xl mb-3">{f.icone}</div>
                <h3 className="font-semibold mb-2 text-slate-900">{f.titulo}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function ConcursoGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

const FEATURES = [
  {
    icone: '🔔',
    titulo: 'Alertas gratuitos',
    desc: 'Receba um e-mail assim que sair um edital na sua área ou órgão de interesse.',
  },
  {
    icone: '📝',
    titulo: 'Simulados com gabarito',
    desc: 'Treine com provas reais dos últimos anos, organizadas por banca e matéria.',
  },
  {
    icone: '📅',
    titulo: 'Calendário centralizado',
    desc: 'Todas as datas de inscrição e aplicação de provas em um só lugar, sempre atualizadas.',
  },
]

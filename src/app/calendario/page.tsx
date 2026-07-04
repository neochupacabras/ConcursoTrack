import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Calendário de provas — ConcursoTrack',
  description: 'Datas de aplicação de provas de concursos públicos organizadas por mês.',
}

export const revalidate = 3600

function mesAno(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default async function CalendarioPage() {
  const supabase = await createClient()

  const hoje = new Date().toISOString().split('T')[0]

  const { data: concursos } = await supabase
    .from('concursos')
    .select('id, slug, titulo, orgao, data_prova, data_encerramento, total_vagas, esfera, estado')
    .eq('status', 'aberto')
    .not('data_prova', 'is', null)
    .gte('data_prova', hoje)
    .order('data_prova', { ascending: true })
    .limit(200)

  // Agrupa por mês
  const porMes: Record<string, typeof concursos> = {}
  for (const c of concursos ?? []) {
    const mes = mesAno(c.data_prova!)
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes]!.push(c)
  }

  const meses = Object.keys(porMes)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Calendário de provas</h1>
          <p className="text-slate-500 text-sm">
            {(concursos ?? []).length} provas agendadas a partir de hoje
          </p>
        </div>
        <Link href="/busca" className="text-sm text-blue-600 hover:underline">
          Ver todos os editais →
        </Link>
      </div>

      {meses.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-500 text-sm">Nenhuma prova com data agendada no momento.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {meses.map((mes) => (
            <section key={mes}>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 capitalize">
                {mes}
              </h2>
              <div className="space-y-2">
                {porMes[mes]!.map((c) => {
                  const diasRestantes = Math.ceil(
                    (new Date(c.data_prova!).getTime() - Date.now()) / 86_400_000
                  )
                  return (
                    <Link
                      key={c.id}
                      href={`/concursos/${c.slug}`}
                      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all group"
                    >
                      {/* Data em destaque */}
                      <div className="flex-shrink-0 w-14 text-center">
                        <p className="text-xl font-bold text-blue-600 leading-none">
                          {new Date(c.data_prova!).getDate()}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">
                          {new Date(c.data_prova!).toLocaleDateString('pt-BR', { month: 'short' })}
                        </p>
                      </div>

                      {/* Divisor */}
                      <div className="w-px h-10 bg-slate-100 flex-shrink-0" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                          {c.orgao}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {c.titulo}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.estado && (
                          <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                            {c.estado}
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          diasRestantes <= 7
                            ? 'bg-red-50 text-red-600'
                            : diasRestantes <= 30
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-50 text-slate-500'
                        }`}>
                          {diasRestantes === 0 ? 'Hoje' :
                           diasRestantes === 1 ? 'Amanhã' :
                           `${diasRestantes}d`}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* CTA alertas */}
      <div className="mt-10 bg-blue-50 rounded-xl border border-blue-100 p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900 mb-1">Não perca a data da sua prova</p>
          <p className="text-xs text-slate-500">
            Ative alertas gratuitos e receba um e-mail quando sair um edital na sua área.
          </p>
        </div>
        <Link
          href="/alertas"
          className="flex-shrink-0 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition whitespace-nowrap"
        >
          Configurar alertas
        </Link>
      </div>
    </div>
  )
}

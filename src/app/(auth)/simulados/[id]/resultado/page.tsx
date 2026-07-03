import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSimuladoCompleto } from '@/lib/queries'
import { GabaritoRevision } from '@/components/simulados/GabaritoRevision'
import type { Metadata } from 'next'
import type { Questao } from '@/types'

export const metadata: Metadata = { title: 'Resultado do simulado' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResultadoPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: simuladoId } = await params
  const resultado = await getSimuladoCompleto(simuladoId, user.id)
  if (!resultado) notFound()

  const { simulado, respostas } = resultado
  if (!simulado.concluido) redirect(`/simulados/${simuladoId}`)

  const concurso = simulado.concursos as {
    titulo: string; orgao: string; slug: string; area_conhecimento: string
  } | null

  const total    = simulado.total_questoes
  const acertos  = simulado.acertos
  const erros    = total - acertos
  const pct      = total > 0 ? Math.round((acertos / total) * 100) : 0

  // Agrupa por matéria para análise
  const porMateria: Record<string, { acertos: number; total: number }> = {}
  respostas.forEach((r) => {
    const q = r.questoes as Questao
    const m = q?.materia ?? 'Geral'
    if (!porMateria[m]) porMateria[m] = { acertos: 0, total: 0 }
    porMateria[m].total++
    if (r.correta) porMateria[m].acertos++
  })

  function tempoFmt(s: number | null) {
    if (!s) return '—'
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m}min ${ss}s`
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">

      {/* Cabeçalho do resultado */}
      <div className="text-center mb-10">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Resultado</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">
          {concurso?.orgao ?? 'Simulado concluído'}
        </h1>
        {concurso?.titulo && (
          <p className="text-slate-500 text-sm">{concurso.titulo}</p>
        )}
      </div>

      {/* Nota principal */}
      <div className="flex flex-col items-center mb-8">
        <div className={`w-32 h-32 rounded-full flex flex-col items-center justify-center border-4 mb-4 ${
          pct >= 70 ? 'border-green-400 bg-green-50'
          : pct >= 50 ? 'border-amber-400 bg-amber-50'
          : 'border-red-400 bg-red-50'
        }`}>
          <span className={`text-3xl font-bold ${
            pct >= 70 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600'
          }`}>
            {pct}%
          </span>
          <span className="text-xs text-slate-500 mt-0.5">de acerto</span>
        </div>

        <p className={`text-lg font-semibold ${
          pct >= 70 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600'
        }`}>
          {pct >= 70 ? 'Muito bem!' : pct >= 50 ? 'Bom desempenho' : 'Continue praticando'}
        </p>
        <p className="text-slate-500 text-sm mt-1">
          {pct >= 70
            ? 'Você está no caminho certo para a aprovação.'
            : pct >= 50
            ? 'Revise os erros abaixo para melhorar.'
            : 'Foco nas matérias com mais erros.'}
        </p>
      </div>

      {/* Cards de stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Acertos" valor={String(acertos)} cor="green" />
        <StatCard label="Erros"   valor={String(erros)}   cor="red"   />
        <StatCard label="Total"   valor={String(total)}   cor="slate" />
        <StatCard label="Tempo"   valor={tempoFmt(simulado.tempo_segundos)} cor="slate" />
      </div>

      {/* Desempenho por matéria */}
      {Object.keys(porMateria).length > 1 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Desempenho por matéria</h2>
          <div className="space-y-2.5">
            {Object.entries(porMateria)
              .sort((a, b) => (b[1].acertos / b[1].total) - (a[1].acertos / a[1].total))
              .map(([materia, dados]) => {
                const p = Math.round((dados.acertos / dados.total) * 100)
                return (
                  <div key={materia}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 truncate mr-2">{materia}</span>
                      <span className={`font-semibold flex-shrink-0 ${
                        p >= 70 ? 'text-green-600' : p >= 50 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {dados.acertos}/{dados.total} ({p}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          p >= 70 ? 'bg-green-400' : p >= 50 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3 mb-10">
        <a
          href={`/simulados?concurso=${simulado.concurso_id}`}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
        >
          Refazer simulado
        </a>
        {concurso?.slug && (
          <a
            href={`/concursos/${concurso.slug}`}
            className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
          >
            Ver edital
          </a>
        )}
        <a
          href="/simulados"
          className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
        >
          Histórico
        </a>
      </div>

      {/* Revisão do gabarito */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Revisão do gabarito</h2>
        <GabaritoRevision respostas={respostas} />
      </section>
    </div>
  )
}

function StatCard({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  const cores: Record<string, string> = {
    green: 'bg-green-50 border-green-100 text-green-900',
    red:   'bg-red-50 border-red-100 text-red-800',
    slate: 'bg-slate-50 border-slate-100 text-slate-800',
  }
  return (
    <div className={`rounded-xl border p-4 ${cores[cor] ?? cores.slate}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold">{valor}</p>
    </div>
  )
}

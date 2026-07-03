import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSimuladosDoUsuario } from '@/lib/queries'
import { IniciarSimuladoForm } from '@/components/simulados/IniciarSimuladoForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Simulados' }

export default async function SimuladosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/simulados')

  const sp = await searchParams
  const concursoId = sp.concurso

  const [{ data: profile }, simulados] = await Promise.all([
    supabase.from('profiles').select('plano, plano_expira_em').eq('id', user.id).single(),
    getSimuladosDoUsuario(user.id),
  ])

  const isPro = profile?.plano === 'pro' &&
    (!profile?.plano_expira_em || new Date(profile.plano_expira_em) > new Date())

  // Se veio de /concursos/[slug] com ?concurso=id, exibe o form de iniciar
  let concursoNome: string | null = null
  if (concursoId) {
    const { data: c } = await supabase
      .from('concursos')
      .select('titulo, orgao')
      .eq('id', concursoId)
      .single()
    concursoNome = c ? `${c.orgao} — ${c.titulo}` : null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Simulados</h1>
        {!isPro && (
          <a href="/plano" className="text-xs text-blue-600 hover:underline">
            Pro: até 40 questões por simulado →
          </a>
        )}
      </div>

      {/* Form de iniciar simulado */}
      {concursoId && (
        <div className="mb-10">
          <IniciarSimuladoForm
            concursoId={concursoId}
            concursoNome={concursoNome}
            isPro={isPro}
          />
        </div>
      )}

      {!concursoId && (
        <div className="mb-8 p-5 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
          Para iniciar um simulado, acesse a página de um concurso e clique em{' '}
          <strong>"Fazer simulado"</strong>.{' '}
          <a href="/busca" className="underline hover:text-blue-900">Ver concursos →</a>
        </div>
      )}

      {/* Histórico */}
      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          Histórico de simulados
        </h2>

        {simulados.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-12 text-center">
            <p className="text-slate-500 text-sm mb-1">Nenhum simulado realizado ainda.</p>
            <p className="text-slate-400 text-xs">
              Acesse um concurso e clique em "Fazer simulado" para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {simulados.map((s) => {
              const pct = s.concluido && s.total_questoes > 0
                ? Math.round((s.acertos / s.total_questoes) * 100)
                : null
              const concurso = s.concursos as { titulo: string; orgao: string; slug: string } | null

              return (
                <a
                  key={s.id}
                  href={`/simulados/${s.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition group"
                >
                  {/* Nota circular */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    pct === null         ? 'bg-amber-100 text-amber-700' :
                    pct >= 70            ? 'bg-green-100 text-green-700' :
                    pct >= 50            ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-600'
                  }`}>
                    {pct !== null ? `${pct}%` : '...'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                      {concurso?.orgao ?? 'Concurso'} — {concurso?.titulo ?? ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.total_questoes} questões ·{' '}
                      {new Date(s.iniciado_em).toLocaleDateString('pt-BR')}
                      {s.concluido ? '' : ' · Em andamento'}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {s.concluido ? (
                      <>
                        <p className="text-sm font-semibold text-slate-800">
                          {s.acertos}/{s.total_questoes}
                        </p>
                        <p className="text-xs text-slate-400">acertos</p>
                      </>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                        Continuar
                      </span>
                    )}
                  </div>

                  <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M6 3l5 5-5 5"/>
                  </svg>
                </a>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Simulado, Alerta } from '@/types'

export const metadata: Metadata = { title: 'Meu painel' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: simulados }, { data: alertas }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('simulados').select('*').eq('user_id', user.id)
      .order('iniciado_em', { ascending: false }).limit(5),
    supabase.from('alertas').select('*').eq('user_id', user.id).eq('ativo', true),
  ])

  const mediaAcertos = simulados && simulados.length > 0
    ? Math.round(simulados.reduce((acc: number, s: Simulado) => acc + (s.acertos / s.total_questoes) * 100, 0) / simulados.length)
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {profile?.nome?.split(' ')[0] ?? 'candidato'}</h1>

        </div>

      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Simulados feitos" valor={String(simulados?.length ?? 0)} />
        <StatCard label="Média de acertos" valor={mediaAcertos !== null ? `${mediaAcertos}%` : '—'} />
        <StatCard label="Alertas ativos" valor={String(alertas?.length ?? 0)} />
        <StatCard label="Concursos salvos" valor="—" />
      </div>

      {/* Últimos simulados */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Últimos simulados</h2>
          <a href="/simulados" className="text-sm text-blue-600 hover:underline">Ver todos →</a>
        </div>
        {!simulados || simulados.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center">
            <p className="text-slate-500 text-sm mb-3">Você ainda não fez nenhum simulado.</p>
            <a href="/busca" className="text-blue-600 text-sm hover:underline">
              Encontrar um concurso para simular →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {(simulados as Simulado[]).map((s) => (
              <SimuladoRow key={s.id} simulado={s} />
            ))}
          </div>
        )}
      </section>

      {/* Alertas ativos */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Alertas ativos</h2>
          <a href="/alertas" className="text-sm text-blue-600 hover:underline">Gerenciar →</a>
        </div>
        {!alertas || alertas.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center">
            <p className="text-slate-500 text-sm mb-3">Nenhum alerta configurado.</p>
            <a href="/alertas" className="text-blue-600 text-sm hover:underline">
              Criar alerta de concurso →
            </a>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(alertas as Alerta[]).map((a) => (
              <span key={a.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-full">
                {a.area_conhecimento ?? 'Todos'} {a.estado ? `· ${a.estado}` : ''} {a.esfera ? `· ${a.esfera}` : ''}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{valor}</p>
    </div>
  )
}

function SimuladoRow({ simulado }: { simulado: Simulado }) {
  const pct = Math.round((simulado.acertos / simulado.total_questoes) * 100)
  return (
    <a
      href={`/simulados/${simulado.id}`}
      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-slate-50 transition"
    >
      <div>
        <p className="text-sm font-medium text-slate-800">
          {simulado.total_questoes} questões
        </p>
        <p className="text-xs text-slate-400">
          {new Date(simulado.iniciado_em).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${pct >= 60 ? 'text-green-600' : 'text-red-500'}`}>
          {simulado.concluido ? `${pct}%` : 'Em andamento'}
        </p>
        <p className="text-xs text-slate-400">
          {simulado.acertos}/{simulado.total_questoes} acertos
        </p>
      </div>
    </a>
  )
}

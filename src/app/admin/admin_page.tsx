import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Painel admin' }

async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')
  if (user.user_metadata?.role !== 'admin') redirect('/')
  return user
}

function StatCard({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{valor}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminPage() {
  await exigirAdmin()

  // Painel admin lê com service role — as contagens abaixo cruzam dados de
  // todos os usuários/concursos, o que a policy de RLS normal não permitiria
  // (e nem deveria, fora deste contexto já verificado como admin acima).
  const db = createServiceClient()

  const [
    { count: concursosAbertos },
    { count: concursosEncerrados },
    { count: concursosOcultos },
    { count: totalUsuarios },
    { count: usuariosPro },
    { count: totalSimulados },
    { count: simuladosConcluidos },
    { count: totalQuestoes },
    { count: totalProvas },
    { data: ultimosConcursos },
  ] = await Promise.all([
    db.from('concursos').select('id', { count: 'exact', head: true }).eq('status', 'aberto'),
    db.from('concursos').select('id', { count: 'exact', head: true }).eq('status', 'encerrado'),
    db.from('concursos').select('id', { count: 'exact', head: true }).eq('oculto', true),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('plano', 'pro'),
    db.from('simulados').select('id', { count: 'exact', head: true }),
    db.from('simulados').select('id', { count: 'exact', head: true }).eq('concluido', true),
    db.from('questoes').select('id', { count: 'exact', head: true }),
    db.from('provas').select('id', { count: 'exact', head: true }),
    db.from('concursos').select('orgao, titulo, scraped_em, status')
      .order('scraped_em', { ascending: false }).limit(8),
  ])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Painel admin</h1>
      <p className="text-sm text-slate-500 mb-8">Visão geral da plataforma</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Concursos abertos" valor={String(concursosAbertos ?? 0)} />
        <StatCard label="Concursos encerrados" valor={String(concursosEncerrados ?? 0)} />
        <StatCard
          label="Concursos ocultos"
          valor={String(concursosOcultos ?? 0)}
          sub="duplicatas mescladas"
        />
        <StatCard label="Usuários" valor={String(totalUsuarios ?? 0)} sub={`${usuariosPro ?? 0} no plano Pro`} />
        <StatCard
          label="Simulados"
          valor={String(totalSimulados ?? 0)}
          sub={`${simuladosConcluidos ?? 0} concluídos`}
        />
        <StatCard label="Questões no banco" valor={String(totalQuestoes ?? 0)} />
        <StatCard label="Provas cadastradas" valor={String(totalProvas ?? 0)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-10">
        <a
          href="/admin/usuarios"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-200 hover:bg-slate-50 transition group"
        >
          <p className="font-medium text-slate-800 group-hover:text-blue-700">Usuários →</p>
          <p className="text-xs text-slate-500 mt-1">Lista de contas cadastradas e planos</p>
        </a>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="font-medium text-slate-800">Mesclagem de duplicatas</p>
          <p className="text-xs text-slate-500 mt-1">
            Roda pelo scraper (não por aqui) — veja{' '}
            <code className="bg-slate-100 px-1 rounded">relatorio_mesclagem.txt</code> gerado
            na última execução, e aplique com{' '}
            <code className="bg-slate-100 px-1 rounded">aplicar_mesclagem.py</code>.
          </p>
        </div>
      </div>

      <section>
        <h2 className="font-semibold text-slate-900 mb-4">Últimos concursos raspados</h2>
        <div className="space-y-2">
          {(ultimosConcursos ?? []).map((c: { orgao: string; titulo: string; scraped_em: string | null; status: string }, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 text-sm"
            >
              <div className="min-w-0">
                <p className="text-slate-800 truncate">{c.orgao}</p>
                <p className="text-xs text-slate-400 truncate">{c.titulo}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.status === 'aberto' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {c.status}
                </span>
                <span className="text-xs text-slate-400">
                  {c.scraped_em ? new Date(c.scraped_em).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

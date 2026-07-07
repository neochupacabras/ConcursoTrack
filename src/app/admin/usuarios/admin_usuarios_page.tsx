import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import type { Profile } from '@/types'

export const metadata: Metadata = { title: 'Usuários — Admin' }

const POR_PAGINA = 30

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/usuarios')
  if (user.user_metadata?.role !== 'admin') redirect('/')

  const sp = await searchParams
  const pagina = Math.max(1, Number(sp.pagina ?? '1'))
  const from = (pagina - 1) * POR_PAGINA

  const db = createServiceClient()
  const { data: usuarios, count } = await db
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(from, from + POR_PAGINA - 1)

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-1">{count ?? 0} contas cadastradas</p>
        </div>
        <a href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Painel</a>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Desde</th>
            </tr>
          </thead>
          <tbody>
            {((usuarios ?? []) as Profile[]).map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 text-slate-800">{u.nome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{u.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    u.plano === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {u.plano === 'pro' ? 'Pro' : 'Gratuito'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(u.criado_em).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}

            {(!usuarios || usuarios.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-sm">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 text-sm">
          {pagina > 1 && (
            <a href={`/admin/usuarios?pagina=${pagina - 1}`} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              ← Anterior
            </a>
          )}
          <span className="text-slate-500">Página {pagina} de {totalPaginas}</span>
          {pagina < totalPaginas && (
            <a href={`/admin/usuarios?pagina=${pagina + 1}`} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
              Próxima →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

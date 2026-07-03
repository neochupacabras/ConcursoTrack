import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAlertasDoUsuario } from '@/lib/queries'
import { AlertasManager } from '@/components/alertas/AlertasManager'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meus alertas de concursos',
  description: 'Configure alertas por área, estado e esfera para receber e-mails sobre novos editais.',
}

export default async function AlertasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/alertas')

  const [alertas, { data: profile }] = await Promise.all([
    getAlertasDoUsuario(user.id),
    supabase.from('profiles').select('plano, email').eq('id', user.id).single(),
  ])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Meus alertas</h1>
        <p className="text-slate-500 text-sm">
          Receba um e-mail em <strong className="text-slate-700">{profile?.email}</strong> sempre
          que um novo edital corresponder aos seus critérios.
        </p>
      </div>

      <AlertasManager alertasIniciais={alertas} />
    </div>
  )
}

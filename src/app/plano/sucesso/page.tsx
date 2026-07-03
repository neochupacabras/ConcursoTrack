import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Assinatura ativada!' }

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

export default async function SucessoPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  // Sem session_id válido, redireciona
  if (!session_id) redirect('/plano')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verifica a sessão no Stripe para exibir detalhes corretos
  let nomeCliente = ''
  let emailCliente = ''
  let isTrial = false

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    })
    nomeCliente  = session.customer_details?.name ?? ''
    emailCliente = session.customer_details?.email ?? ''
    const sub    = session.subscription as { status?: string } | null
    isTrial      = sub?.status === 'trialing'
  } catch {
    // Se não conseguir buscar, continua sem os detalhes
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">

      {/* Ícone de sucesso animado */}
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <svg
          className="w-10 h-10 text-green-600"
          viewBox="0 0 40 40" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        >
          <path d="M8 21l8 8 16-16"
            strokeDasharray="45"
            strokeDashoffset="45"
            style={{ animation: 'draw 0.5s ease forwards 0.2s' }}
          />
        </svg>
        <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {isTrial ? 'Trial ativado!' : 'Bem-vindo ao Pro!'}
      </h1>

      <p className="text-slate-500 mb-1">
        {nomeCliente && <span className="font-medium text-slate-700">{nomeCliente}, </span>}
        {isTrial
          ? 'seu trial de 7 dias está ativo. Aproveite acesso completo sem nenhum custo.'
          : 'sua assinatura Pro está ativa. Aproveite acesso completo a todos os recursos.'}
      </p>

      {emailCliente && (
        <p className="text-xs text-slate-400 mb-8">
          Confirmação enviada para <strong className="text-slate-600">{emailCliente}</strong>
        </p>
      )}

      {/* O que desbloquear */}
      <div className="bg-slate-50 rounded-2xl p-5 text-left mb-8 border border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Você desbloqueou
        </p>
        <ul className="space-y-2">
          {[
            'Simulados com até 40 questões',
            'Questões premium com gabarito comentado',
            'Plano de estudos personalizado por edital',
            'Comparador de editais lado a lado',
            'Alertas instantâneos de novos concursos',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 8.5l3.5 3.5 6.5-7"/>
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/busca"
          className="px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
        >
          Explorar concursos
        </a>
        <a
          href="/dashboard"
          className="px-6 py-3 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
        >
          Ir para o painel
        </a>
      </div>
    </div>
  )
}

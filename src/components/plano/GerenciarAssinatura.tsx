'use client'
import { useState } from 'react'

interface Assinatura {
  status:                 string
  plano:                  string
  periodo_fim:            string | null
  stripe_subscription_id: string | null
}

interface Props {
  assinatura:    Assinatura
  planoExpiraEm: string | null
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Ativa',          cls: 'bg-green-100 text-green-800' },
  trialing: { label: 'Trial gratuito', cls: 'bg-blue-100 text-blue-800'  },
  past_due: { label: 'Pagamento pendente', cls: 'bg-amber-100 text-amber-800' },
  canceled: { label: 'Cancelada',      cls: 'bg-slate-100 text-slate-600' },
}

export function GerenciarAssinatura({ assinatura, planoExpiraEm }: Props) {
  const [loading, setLoading] = useState(false)
  const [erro,    setErro   ] = useState('')

  const cfg = STATUS_CONFIG[assinatura.status] ?? STATUS_CONFIG.active

  const proximaCobranca = assinatura.periodo_fim
    ? new Date(assinatura.periodo_fim).toLocaleDateString('pt-BR', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : null

  async function abrirPortal() {
    setErro('')
    setLoading(true)

    const res  = await fetch('/api/plano/portal', { method: 'POST' })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setErro(json.error ?? 'Não foi possível abrir o portal.')
      return
    }

    window.location.href = json.url
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Card de status */}
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden mb-6">

        {/* Cabeçalho */}
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900">ConcursoTrack Pro</p>
              <p className="text-xs text-blue-600">Acesso completo ativo</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cfg.cls}`}>
            {cfg.label}
          </span>
        </div>

        {/* Detalhes */}
        <div className="px-6 py-5 space-y-4">
          {proximaCobranca && assinatura.status !== 'canceled' && (
            <div className="flex items-center justify-between py-3 border-b border-slate-50">
              <span className="text-sm text-slate-500">
                {assinatura.status === 'trialing' ? 'Trial termina em' : 'Próxima cobrança'}
              </span>
              <span className="text-sm font-medium text-slate-800">{proximaCobranca}</span>
            </div>
          )}

          {assinatura.status === 'past_due' && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2L1.5 13.5h13L8 2zM8 6v4M8 11.5v.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm text-amber-800">
                O pagamento mais recente falhou. Atualize seu método de pagamento para manter o acesso Pro.
              </p>
            </div>
          )}

          {assinatura.status === 'trialing' && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6"/>
                <path d="M8 5v3l2 1" strokeLinecap="round"/>
              </svg>
              <p className="text-sm text-blue-800">
                Você está no período de trial. Nenhum valor será cobrado até {proximaCobranca}.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">O que está incluído</p>
              <div className="flex flex-wrap gap-1.5">
                {['Simulados ilimitados', 'Gabarito comentado', 'Plano de estudos', 'Alertas instantâneos'].map((f) => (
                  <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={abrirPortal}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Abrindo portal...</>
            ) : (
              <>Gerenciar assinatura<svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg></>
            )}
          </button>

          <a
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
          >
            Ir para o painel
          </a>
        </div>

        {erro && (
          <p className="text-center text-sm text-red-600 pb-4">{erro}</p>
        )}
      </div>

      {/* Info sobre portal */}
      <p className="text-center text-xs text-slate-400 leading-relaxed">
        O portal de gerenciamento é hospedado pelo Stripe com segurança bancária.
        Lá você pode atualizar o cartão, trocar de plano ou cancelar a assinatura.
      </p>
    </div>
  )
}

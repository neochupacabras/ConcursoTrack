'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PLANOS } from '@/lib/stripe'
import type { BillingInterval } from '@/lib/stripe'

interface Props {
  estaLogado: boolean
}

export function PlanoToggle({ estaLogado }: Props) {
  const router = useRouter()
  const [intervalo, setIntervalo]   = useState<BillingInterval>('anual')
  const [loading, setLoading]       = useState<BillingInterval | null>(null)
  const [erro, setErro]             = useState('')
  const [, startTransition]         = useTransition()

  async function assinar(iv: BillingInterval) {
    if (!estaLogado) {
      startTransition(() => router.push('/login?next=/plano'))
      return
    }

    setErro('')
    setLoading(iv)

    const res = await fetch('/api/plano/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ intervalo: iv }),
    })

    const json = await res.json()
    setLoading(null)

    if (!res.ok) {
      setErro(json.error ?? 'Erro ao iniciar checkout.')
      return
    }

    // Redireciona para o Stripe Checkout
    window.location.href = json.url
  }

  const economia = Math.round(
    ((PLANOS.pro.mensal * 12 - PLANOS.pro.anual) / (PLANOS.pro.mensal * 12)) * 100
  )

  return (
    <div>
      {/* Toggle mensal/anual */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <button
          onClick={() => setIntervalo('mensal')}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition ${
            intervalo === 'mensal'
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Mensal
        </button>

        <button
          onClick={() => setIntervalo('anual')}
          className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition ${
            intervalo === 'anual'
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Anual
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
            intervalo === 'anual'
              ? 'bg-green-400 text-green-900'
              : 'bg-green-100 text-green-700'
          }`}>
            -{economia}%
          </span>
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

        {/* Free */}
        <div className="rounded-2xl border border-slate-200 bg-white p-7 flex flex-col">
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {PLANOS.free.nome}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">R$ 0</span>
              <span className="text-slate-400 text-sm">/mês</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 h-4">Para sempre</p>
          </div>

          <ul className="space-y-2.5 mb-8 flex-1">
            {PLANOS.free.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 8.5l3.5 3.5 6.5-7"/>
                </svg>
                {f}
              </li>
            ))}
            {PLANOS.free.limitacoes.map((l) => (
              <li key={l} className="flex items-start gap-2.5 text-sm text-slate-400">
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 8h8"/>
                </svg>
                {l}
              </li>
            ))}
          </ul>

          <button
            disabled
            className="w-full py-3 rounded-xl border border-slate-200 text-slate-400 text-sm font-medium cursor-default"
          >
            Plano atual
          </button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-blue-500 bg-white p-7 flex flex-col relative overflow-hidden">
          {/* Badge mais popular */}
          <div className="absolute top-5 right-5">
            <span className="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-full">
              Mais popular
            </span>
          </div>

          <div className="mb-6">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">
              {PLANOS.pro.nome}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900">
                R$ {intervalo === 'anual'
                  ? PLANOS.pro.por_mes_anual.toFixed(2).replace('.', ',')
                  : PLANOS.pro.mensal.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-slate-400 text-sm">/mês</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 h-4">
              {intervalo === 'anual'
                ? `R$ ${PLANOS.pro.anual.toFixed(2).replace('.', ',')} cobrado anualmente`
                : 'Cobrado mensalmente'}
            </p>
          </div>

          <ul className="space-y-2.5 mb-8 flex-1">
            {PLANOS.pro.features.map((f, i) => (
              <li key={f} className={`flex items-start gap-2.5 text-sm ${i === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
                <svg
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${i === 0 ? 'text-slate-300' : 'text-blue-500'}`}
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                >
                  <path d="M3 8.5l3.5 3.5 6.5-7"/>
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {erro && (
            <p className="text-red-600 text-xs mb-3 text-center">{erro}</p>
          )}

          <button
            onClick={() => assinar(intervalo)}
            disabled={loading !== null}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition flex items-center justify-center gap-2"
          >
            {loading === intervalo ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                {estaLogado ? 'Começar trial grátis de 7 dias' : 'Criar conta e assinar'}
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 mt-3">
            Sem cobrança no trial · Cancele a qualquer momento
          </p>
        </div>
      </div>
    </div>
  )
}

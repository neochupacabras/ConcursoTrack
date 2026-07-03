'use client'
import { useState } from 'react'
import type { Alerta } from '@/types'
import { NovoAlertaForm } from './NovoAlertaForm'
import { AlertaCard } from './AlertaCard'

interface Props {
  alertasIniciais: Alerta[]
}

export function AlertasManager({ alertasIniciais }: Props) {
  const [alertas, setAlertas]     = useState<Alerta[]>(alertasIniciais)
  const [mostraForm, setMostraForm] = useState(false)

  function onCriado(novo: Alerta) {
    setAlertas((prev) => [novo, ...prev])
    setMostraForm(false)
  }

  async function onToggle(id: string, ativo: boolean) {
    const res = await fetch(`/api/alertas/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ativo }),
    })
    if (res.ok) {
      setAlertas((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ativo } : a))
      )
    }
  }

  async function onDeletar(id: string) {
    const res = await fetch(`/api/alertas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAlertas((prev) => prev.filter((a) => a.id !== id))
    }
  }

  const ativos   = alertas.filter((a) => a.ativo)
  const inativos = alertas.filter((a) => !a.ativo)

  return (
    <div>
      {/* Botão de novo alerta */}
      {!mostraForm && (
        <button
          onClick={() => setMostraForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all mb-6"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          Criar novo alerta
        </button>
      )}

      {/* Formulário de novo alerta */}
      {mostraForm && (
        <div className="mb-6">
          <NovoAlertaForm
            onCriado={onCriado}
            onCancelar={() => setMostraForm(false)}
          />
        </div>
      )}

      {/* Lista de alertas ativos */}
      {ativos.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Ativos ({ativos.length})
          </p>
          <div className="space-y-2">
            {ativos.map((alerta) => (
              <AlertaCard
                key={alerta.id}
                alerta={alerta}
                onToggle={onToggle}
                onDeletar={onDeletar}
              />
            ))}
          </div>
        </section>
      )}

      {/* Lista de alertas inativos */}
      {inativos.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Pausados ({inativos.length})
          </p>
          <div className="space-y-2">
            {inativos.map((alerta) => (
              <AlertaCard
                key={alerta.id}
                alerta={alerta}
                onToggle={onToggle}
                onDeletar={onDeletar}
              />
            ))}
          </div>
        </section>
      )}

      {/* Estado vazio */}
      {alertas.length === 0 && !mostraForm && (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-slate-600 font-medium mb-1">Nenhum alerta configurado</p>
          <p className="text-slate-400 text-sm mb-5">
            Crie alertas para receber e-mails quando saírem novos editais na sua área.
          </p>
          <button
            onClick={() => setMostraForm(true)}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Criar meu primeiro alerta
          </button>
        </div>
      )}

      {/* Nota informativa */}
      {alertas.length > 0 && (
        <p className="text-xs text-slate-400 text-center mt-8 leading-relaxed">
          Os alertas são verificados diariamente após a atualização dos editais.
          Você receberá no máximo um e-mail por edital novo.
        </p>
      )}
    </div>
  )
}

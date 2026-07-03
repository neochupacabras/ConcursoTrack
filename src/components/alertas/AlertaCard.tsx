'use client'
import { useState } from 'react'
import type { Alerta } from '@/types'
import { areaLabel } from '@/lib/utils'

interface Props {
  alerta:    Alerta
  onToggle:  (id: string, ativo: boolean) => void
  onDeletar: (id: string) => void
}

const ESFERA_LABEL: Record<string, string> = {
  federal:   'Federal',
  estadual:  'Estadual',
  municipal: 'Municipal',
}

export function AlertaCard({ alerta, onToggle, onDeletar }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const [toggling,    setToggling   ] = useState(false)

  async function handleToggle() {
    setToggling(true)
    await onToggle(alerta.id, !alerta.ativo)
    setToggling(false)
  }

  async function handleDeletar() {
    await onDeletar(alerta.id)
  }

  // Monta a descrição legível do alerta
  const criterios: string[] = []
  if (alerta.area_conhecimento) criterios.push(areaLabel(alerta.area_conhecimento))
  if (alerta.esfera)            criterios.push(ESFERA_LABEL[alerta.esfera] ?? alerta.esfera)
  if (alerta.estado)            criterios.push(alerta.estado)
  if (alerta.orgao)             criterios.push(alerta.orgao)
  if (criterios.length === 0)   criterios.push('Todos os concursos')

  return (
    <div className={`rounded-xl border transition-all ${
      alerta.ativo
        ? 'border-slate-200 bg-white'
        : 'border-slate-100 bg-slate-50 opacity-60'
    }`}>
      {!confirmando ? (
        <div className="flex items-center gap-4 px-4 py-3.5">
          {/* Ícone de sino */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            alerta.ativo ? 'bg-blue-50' : 'bg-slate-100'
          }`}>
            <svg
              className={`w-4.5 h-4.5 ${alerta.ativo ? 'text-blue-500' : 'text-slate-400'}`}
              style={{ width: 18, height: 18 }}
              viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <path d="M13.333 7.5a3.333 3.333 0 10-6.666 0c0 3.333-1.667 4.167-1.667 4.167h10s-1.667-.834-1.667-4.167zM11.25 14.167a1.25 1.25 0 01-2.5 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Critérios */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {criterios.join(' · ')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              via {alerta.canal === 'email' ? 'e-mail' : 'push'} ·{' '}
              criado em {new Date(alerta.criado_em).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Toggle ativo/inativo */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={alerta.ativo ? 'Pausar alerta' : 'Ativar alerta'}
              className={`relative w-10 h-6 rounded-full transition-colors flex items-center ${
                alerta.ativo ? 'bg-blue-500' : 'bg-slate-200'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              <span className={`w-4 h-4 bg-white rounded-full shadow-sm absolute transition-transform ${
                alerta.ativo ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>

            {/* Deletar */}
            <button
              onClick={() => setConfirmando(true)}
              title="Remover alerta"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l.8 8.5a1 1 0 001 .9h6.4a1 1 0 001-.9L13 4"/>
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* Confirmação de exclusão */
        <div className="flex items-center gap-3 px-4 py-3.5 bg-red-50 rounded-xl border border-red-100">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2L1.5 13.5h13L8 2zM8 6v4M8 11.5v.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm text-red-700 flex-1">
            Remover alerta de <strong>{criterios[0]}</strong>?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setConfirmando(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeletar}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
            >
              Remover
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

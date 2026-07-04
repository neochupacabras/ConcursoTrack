'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  concursoId:   string
  concursoNome: string | null
}

export function IniciarSimuladoForm({ concursoId, concursoNome }: Props) {
  const router = useRouter()
  const [total, setTotal]   = useState(20)
  const [erro, setErro]     = useState('')
  const [isPending, start]  = useTransition()

  async function iniciar() {
    setErro('')
    start(async () => {
      const res = await fetch('/api/simulados', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ concurso_id: concursoId, total }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErro(json.error ?? 'Erro ao criar simulado.')
        return
      }
      router.push(`/simulados/${json.simulado_id}`)
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900 mb-1">Iniciar simulado</h2>
      {concursoNome && (
        <p className="text-sm text-slate-500 mb-5 truncate">{concursoNome}</p>
      )}

      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-600 mb-2">
          Número de questões
        </label>

        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={40}
            step={5}
            value={total}
            onChange={(e) => setTotal(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-2xl font-bold text-slate-900 min-w-[3ch] text-right">
            {total}
          </span>
        </div>

        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>5 questões</span>
          <span>40 questões</span>
        </div>
      </div>

      {erro && (
        <p className="text-red-600 text-sm mb-4">{erro}</p>
      )}

      <button
        onClick={iniciar}
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Preparando simulado...
          </>
        ) : (
          <>
            Iniciar simulado com {total} questões
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 8h10M9 4l4 4-4 4"/>
            </svg>
          </>
        )}
      </button>
    </div>
  )
}

'use client'
import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'

const AREAS_POPULARES = [
  { label: 'Fiscal / Tributária', value: 'fiscal_tributaria' },
  { label: 'Segurança Pública',   value: 'seguranca_publica' },
  { label: 'Saúde',               value: 'saude' },
  { label: 'Tecnologia',          value: 'tecnologia' },
  { label: 'Educação',            value: 'educacao' },
  { label: 'Jurídica',            value: 'juridica' },
]

export function HeroSearch() {
  const router  = useRouter()
  const [q, setQ] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function buscar(query: string = q, area?: string) {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (area) params.set('area', area)
    startTransition(() => {
      router.push(`/busca?${params.toString()}`)
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    buscar()
  }

  return (
    <section className="bg-gradient-to-b from-blue-50 to-white py-16 md:py-20 px-4">
      <div className="max-w-2xl mx-auto text-center">

        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-100 px-3 py-1 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Atualizado diariamente
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
          Encontre seu concurso
        </h1>
        <p className="text-slate-500 text-lg mb-8 leading-relaxed">
          Editais abertos, provas e alertas — tudo em um só lugar.
        </p>

        {/* Campo de busca */}
        <form onSubmit={onSubmit} className="relative mb-6">
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 focus-within:border-blue-400 focus-within:shadow-md transition-all">
            <svg className="w-5 h-5 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6"/>
              <path d="M15 15l3 3" strokeLinecap="round"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por órgão, cargo ou banca..."
              className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-base outline-none"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isPending}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition disabled:opacity-60"
            >
              {isPending ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </form>

        {/* Atalhos por área */}
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs text-slate-400 self-center mr-1">Áreas:</span>
          {AREAS_POPULARES.map((area) => (
            <button
              key={area.value}
              onClick={() => buscar('', area.value)}
              className="text-xs text-slate-600 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
            >
              {area.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import type { BuscaParams, Esfera, Status } from '@/types'

const AREAS = [
  { value: 'administrativa',    label: 'Administrativa' },
  { value: 'fiscal_tributaria', label: 'Fiscal / Tributária' },
  { value: 'seguranca_publica', label: 'Segurança Pública' },
  { value: 'saude',             label: 'Saúde' },
  { value: 'educacao',          label: 'Educação' },
  { value: 'tecnologia',        label: 'Tecnologia' },
  { value: 'engenharia',        label: 'Engenharia' },
  { value: 'juridica',          label: 'Jurídica' },
]

const ESFERAS: { value: Esfera; label: string }[] = [
  { value: 'federal',   label: 'Federal' },
  { value: 'estadual',  label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
]

const STATUS: { value: Status; label: string }[] = [
  { value: 'aberto',    label: 'Aberto' },
  { value: 'previsto',  label: 'Previsto' },
  { value: 'encerrado', label: 'Encerrado' },
]

const ESTADOS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

interface Props {
  params: BuscaParams
}

export function FiltrosBusca({ params }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const [, startTransition] = useTransition()

  function atualizar(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('pagina') // volta para página 1 ao mudar filtro
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  function limpar() {
    startTransition(() => {
      router.push(pathname)
    })
  }

  const temFiltros = !!(params.area || params.esfera || params.estado || params.status !== 'aberto')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Filtros</h3>
        {temFiltros && (
          <button
            onClick={limpar}
            className="text-xs text-blue-600 hover:underline"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {/* Status */}
      <FiltroGrupo titulo="Status">
        <div className="space-y-1.5">
          {STATUS.map((s) => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="status"
                value={s.value}
                checked={(params.status ?? 'aberto') === s.value}
                onChange={() => atualizar('status', s.value)}
                className="w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </FiltroGrupo>

      {/* Área */}
      <FiltroGrupo titulo="Área">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="area"
              value=""
              checked={!params.area}
              onChange={() => atualizar('area', null)}
              className="w-3.5 h-3.5 text-blue-600 border-slate-300"
            />
            <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
              Todas
            </span>
          </label>
          {AREAS.map((a) => (
            <label key={a.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="area"
                value={a.value}
                checked={params.area === a.value}
                onChange={() => atualizar('area', a.value)}
                className="w-3.5 h-3.5 text-blue-600 border-slate-300"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                {a.label}
              </span>
            </label>
          ))}
        </div>
      </FiltroGrupo>

      {/* Esfera */}
      <FiltroGrupo titulo="Esfera">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="esfera"
              value=""
              checked={!params.esfera}
              onChange={() => atualizar('esfera', null)}
              className="w-3.5 h-3.5 text-blue-600 border-slate-300"
            />
            <span className="text-sm text-slate-600 group-hover:text-slate-900">Todas</span>
          </label>
          {ESFERAS.map((e) => (
            <label key={e.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="esfera"
                value={e.value}
                checked={params.esfera === e.value}
                onChange={() => atualizar('esfera', e.value)}
                className="w-3.5 h-3.5 text-blue-600 border-slate-300"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900">{e.label}</span>
            </label>
          ))}
        </div>
      </FiltroGrupo>

      {/* Estado */}
      <FiltroGrupo titulo="Estado">
        <select
          value={params.estado ?? ''}
          onChange={(e) => atualizar('estado', e.target.value || null)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        >
          <option value="">Todos os estados</option>
          {ESTADOS.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </FiltroGrupo>
    </div>
  )
}

function FiltroGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {titulo}
      </p>
      {children}
    </div>
  )
}

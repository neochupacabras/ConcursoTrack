'use client'
import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { formatDate, formatSalario, areaLabel } from '@/lib/utils'
import Link from 'next/link'

interface ConcursoResumido {
  id: string
  titulo: string
  orgao: string
  esfera: string | null
  estado: string | null
  total_vagas: number
  data_encerramento: string | null
}

interface Cargo {
  titulo: string
  escolaridade: string | null
  vagas: number
  salario_inicial: number | null
  salario_final: number | null
  localidade: string | null
}

interface ConcursoCompleto {
  id: string
  slug: string
  titulo: string
  orgao: string
  esfera: string | null
  estado: string | null
  area_conhecimento: string | null
  status: string
  total_vagas: number
  data_abertura: string | null
  data_encerramento: string | null
  data_prova: string | null
  edital_url: string | null
  fonte_url: string
  bancas?: { nome: string; sigla: string } | null
  cargos?: Cargo[]
}

interface Props {
  todosOsConcursos: ConcursoResumido[]
  selecionadosIniciais: Record<string, unknown>[]
  idsIniciais: string[]
}

const ESFERA_LABEL: Record<string, string> = {
  federal:          'Federal',
  estadual:         'Estadual',
  municipal:        'Municipal',
  nao_identificada: '—',
}

export function ComparadorClient({ todosOsConcursos, selecionadosIniciais, idsIniciais }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [idsSelecionados, setIdsSelecionados] = useState<string[]>(idsIniciais.slice(0, 4))
  const [comparando, setComparando]           = useState<ConcursoCompleto[]>(
    selecionadosIniciais as unknown as ConcursoCompleto[]
  )
  const [busca, setBusca]     = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')

  const concursosFiltrados = todosOsConcursos.filter((c) => {
    if (idsSelecionados.includes(c.id)) return false
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return c.orgao.toLowerCase().includes(q) || c.titulo.toLowerCase().includes(q)
  })

  async function adicionar(id: string) {
    if (idsSelecionados.length >= 4) return
    const novosIds = [...idsSelecionados, id]
    setIdsSelecionados(novosIds)
    await buscarComparar(novosIds)
    atualizarUrl(novosIds)
  }

  function remover(id: string) {
    const novosIds = idsSelecionados.filter((i) => i !== id)
    setIdsSelecionados(novosIds)
    setComparando((prev) => prev.filter((c) => c.id !== id))
    atualizarUrl(novosIds)
  }

  const buscarComparar = useCallback(async (ids: string[]) => {
    if (ids.length < 2) { setComparando([]); return }
    setLoading(true)
    setErro('')
    try {
      const res  = await fetch(`/api/comparador?ids=${ids.join(',')}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComparando(data)
    } catch {
      setErro('Não foi possível carregar os dados.')
    } finally {
      setLoading(false)
    }
  }, [])

  function atualizarUrl(ids: string[]) {
    const params = ids.length ? `?ids=${ids.join(',')}` : ''
    router.replace(`${pathname}${params}`, { scroll: false })
  }

  const podeComparar = idsSelecionados.length >= 2

  return (
    <div className="space-y-8">

      {/* Seletor */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-800">
            Concursos selecionados
            <span className={`ml-2 text-xs font-normal ${idsSelecionados.length >= 4 ? 'text-amber-600' : 'text-slate-400'}`}>
              {idsSelecionados.length}/4
            </span>
          </p>
          {idsSelecionados.length > 0 && (
            <button
              onClick={() => { setIdsSelecionados([]); setComparando([]); atualizarUrl([]) }}
              className="text-xs text-slate-400 hover:text-red-500 transition"
            >
              Limpar tudo
            </button>
          )}
        </div>

        {/* Chips dos selecionados */}
        {idsSelecionados.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-5">
            {idsSelecionados.map((id) => {
              const c = todosOsConcursos.find((x) => x.id === id)
              return (
                <div key={id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 text-xs px-3 py-1.5 rounded-full">
                  <span className="max-w-[200px] truncate">{c?.orgao ?? id}</span>
                  <button
                    onClick={() => remover(id)}
                    className="text-blue-400 hover:text-blue-700 transition flex-shrink-0"
                    aria-label="Remover"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 2l8 8M10 2L2 10"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 mb-5">Nenhum concurso selecionado ainda.</p>
        )}

        {/* Busca e lista */}
        {idsSelecionados.length < 4 && (
          <>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por órgão ou cargo..."
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 mb-3 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
            />

            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
              {concursosFiltrados.slice(0, 50).map((c) => (
                <button
                  key={c.id}
                  onClick={() => adicionar(c.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-blue-50 transition group"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate group-hover:text-blue-700">{c.orgao}</p>
                    <p className="text-xs text-slate-400 truncate">{c.titulo}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-xs text-slate-400">{c.total_vagas} vagas</span>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M8 3v10M3 8h10"/>
                    </svg>
                  </div>
                </button>
              ))}
              {concursosFiltrados.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Nenhum concurso encontrado.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Estado de carregamento */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Carregando dados...</p>
        </div>
      )}

      {erro && (
        <p className="text-center text-sm text-red-600 py-4">{erro}</p>
      )}

      {/* Prompt para selecionar */}
      {!loading && !podeComparar && (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-slate-600 font-medium mb-1">Selecione pelo menos 2 concursos</p>
          <p className="text-slate-400 text-sm">Use a busca acima para encontrar e adicionar concursos.</p>
        </div>
      )}

      {/* Tabela comparativa */}
      {!loading && podeComparar && comparando.length >= 2 && (
        <TabelaComparativa concursos={comparando} />
      )}
    </div>
  )
}

function TabelaComparativa({ concursos }: { concursos: ConcursoCompleto[] }) {
  // Salário máximo entre todos — para barra de progresso
  const salarioMaximo = Math.max(
    ...concursos.flatMap((c) =>
      (c.cargos ?? []).map((cargo) => cargo.salario_final ?? cargo.salario_inicial ?? 0)
    ),
    1
  )

  const rows: { label: string; render: (c: ConcursoCompleto) => React.ReactNode }[] = [
    {
      label: 'Órgão',
      render: (c) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{c.orgao}</p>
          {c.bancas && <p className="text-xs text-slate-400 mt-0.5">Banca: {c.bancas.sigla}</p>}
        </div>
      ),
    },
    {
      label: 'Esfera',
      render: (c) => (
        <span className="text-sm text-slate-700">
          {ESFERA_LABEL[c.esfera ?? ''] ?? '—'}
          {c.estado ? ` · ${c.estado}` : ''}
        </span>
      ),
    },
    {
      label: 'Área',
      render: (c) => (
        <span className="text-sm text-slate-700">{areaLabel(c.area_conhecimento)}</span>
      ),
    },
    {
      label: 'Total de vagas',
      render: (c) => (
        <span className="text-lg font-bold text-slate-900">
          {c.total_vagas.toLocaleString('pt-BR')}
        </span>
      ),
    },
    {
      label: 'Inscrições até',
      render: (c) => {
        const dias = c.data_encerramento
          ? Math.ceil((new Date(c.data_encerramento).getTime() - Date.now()) / 86_400_000)
          : null
        return (
          <div>
            <p className={`text-sm font-medium ${dias !== null && dias <= 7 ? 'text-red-600' : 'text-slate-800'}`}>
              {formatDate(c.data_encerramento) ?? '—'}
            </p>
            {dias !== null && dias >= 0 && (
              <p className={`text-xs mt-0.5 ${dias <= 7 ? 'text-red-500' : 'text-slate-400'}`}>
                {dias === 0 ? 'Hoje!' : `${dias} dia${dias !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        )
      },
    },
    {
      label: 'Data da prova',
      render: (c) => (
        <span className="text-sm text-slate-700">{formatDate(c.data_prova) ?? '—'}</span>
      ),
    },
    {
      label: 'Cargos',
      render: (c) => {
        const cargos = c.cargos ?? []
        if (cargos.length === 0) return <span className="text-sm text-slate-400">Não informado</span>
        return (
          <div className="space-y-2">
            {cargos.slice(0, 5).map((cargo, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-slate-800 leading-snug">{cargo.titulo}</p>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className="text-xs text-slate-400">
                    {cargo.vagas} vaga{cargo.vagas !== 1 ? 's' : ''}
                    {cargo.escolaridade ? ` · ${cargo.escolaridade}` : ''}
                  </span>
                  {(cargo.salario_inicial || cargo.salario_final) && (
                    <span className="text-xs font-medium text-green-700 whitespace-nowrap">
                      {formatSalario(cargo.salario_inicial)}
                      {cargo.salario_final && cargo.salario_final !== cargo.salario_inicial
                        ? ` – ${formatSalario(cargo.salario_final)}`
                        : ''}
                    </span>
                  )}
                </div>
                {/* Barra de salário relativo */}
                {(cargo.salario_final ?? cargo.salario_inicial) && (
                  <div className="h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-green-400 rounded-full"
                      style={{
                        width: `${Math.round(((cargo.salario_final ?? cargo.salario_inicial ?? 0) / salarioMaximo) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
            {cargos.length > 5 && (
              <p className="text-xs text-slate-400 text-center">+{cargos.length - 5} cargos</p>
            )}
          </div>
        )
      },
    },
    {
      label: 'Edital',
      render: (c) => (
        <div className="flex flex-col gap-1.5">
          {c.edital_url && (
            <a
              href={c.edital_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Edital oficial
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2.5 9.5l7-7M4 2.5h5.5v5.5"/>
              </svg>
            </a>
          )}
          <Link
            href={`/concursos/${c.slug}`}
            className="text-xs text-slate-500 hover:text-blue-600 hover:underline"
          >
            Ver página completa →
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      {/* Cabeçalho com os concursos */}
      <div
        className="grid border-b border-slate-100 bg-slate-50"
        style={{ gridTemplateColumns: `180px repeat(${concursos.length}, 1fr)` }}
      >
        <div className="px-5 py-4" />
        {concursos.map((c, i) => (
          <div key={c.id} className={`px-4 py-4 ${i > 0 ? 'border-l border-slate-100' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  Concurso {i + 1}
                </p>
                <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                  {c.orgao}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Linhas */}
      {rows.map((row, ri) => (
        <div
          key={row.label}
          className={`grid border-b border-slate-50 last:border-0 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
          style={{ gridTemplateColumns: `180px repeat(${concursos.length}, 1fr)` }}
        >
          {/* Label */}
          <div className="px-5 py-4 flex items-start">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-relaxed">
              {row.label}
            </span>
          </div>

          {/* Valores */}
          {concursos.map((c, i) => (
            <div
              key={c.id}
              className={`px-4 py-4 ${i > 0 ? 'border-l border-slate-100' : ''}`}
            >
              {row.render(c)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

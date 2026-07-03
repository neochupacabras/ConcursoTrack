'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Props {
  paginaAtual: number
  total: number
  porPagina: number
}

export function Paginacao({ paginaAtual, total, porPagina }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const totalPaginas = Math.ceil(total / porPagina)

  if (totalPaginas <= 1) return null

  function navegar(pagina: number) {
    const params = new URLSearchParams(sp.toString())
    params.set('pagina', String(pagina))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => navegar(paginaAtual - 1)}
        disabled={paginaAtual <= 1}
        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
      >
        Anterior
      </button>

      <span className="px-4 py-1.5 text-sm text-slate-600">
        {paginaAtual} de {totalPaginas}
      </span>

      <button
        onClick={() => navegar(paginaAtual + 1)}
        disabled={paginaAtual >= totalPaginas}
        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
      >
        Próxima
      </button>
    </div>
  )
}

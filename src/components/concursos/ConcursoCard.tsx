import Link from 'next/link'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate, diasRestantes } from '@/lib/utils'
import type { Concurso } from '@/types'

interface Props {
  concurso: Pick<
    Concurso,
    'slug' | 'titulo' | 'orgao' | 'total_vagas' | 'status' |
    'data_encerramento' | 'area_conhecimento' | 'esfera' | 'estado'
  > & { bancas?: { sigla: string } | null }
}

export function ConcursoCard({ concurso }: Props) {
  const dias = diasRestantes(concurso.data_encerramento)
  const urgente = dias !== null && dias >= 0 && dias <= 7

  return (
    <Link
      href={`/concursos/${concurso.slug}`}
      className="group block rounded-xl border border-slate-100 bg-white p-5 hover:border-blue-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <StatusBadge status={concurso.status} />
        {concurso.bancas && (
          <span className="text-xs text-slate-400">{concurso.bancas.sigla}</span>
        )}
      </div>

      <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 group-hover:text-blue-700 transition-colors line-clamp-2">
        {concurso.titulo}
      </h3>

      <p className="text-xs text-slate-500 mb-4 truncate">{concurso.orgao}</p>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-400">Vagas</p>
          <p className="text-sm font-semibold text-slate-800">
            {concurso.total_vagas.toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-400">Inscrições até</p>
          <p className={`text-sm font-semibold ${urgente ? 'text-red-600' : 'text-slate-800'}`}>
            {formatDate(concurso.data_encerramento) ?? '—'}
          </p>
          {urgente && (
            <p className="text-xs text-red-500">
              {dias === 0 ? 'Último dia!' : `${dias} dia${dias !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

import { formatSalario } from '@/lib/utils'
import type { Cargo } from '@/types'

interface Props {
  cargos: Cargo[]
}

const ESCOLARIDADE_ORDER: Record<string, number> = {
  'superior': 1, 'nível superior': 1,
  'médio':    2, 'nível médio':    2,
  'técnico':  3,
  'fundamental': 4, 'nível fundamental': 4,
}

function ordenarCargos(cargos: Cargo[]): Cargo[] {
  return [...cargos].sort((a, b) => {
    const ea = ESCOLARIDADE_ORDER[a.escolaridade?.toLowerCase() ?? ''] ?? 99
    const eb = ESCOLARIDADE_ORDER[b.escolaridade?.toLowerCase() ?? ''] ?? 99
    if (ea !== eb) return ea - eb
    return (b.vagas ?? 0) - (a.vagas ?? 0)
  })
}

export function CargosTable({ cargos }: Props) {
  const ordenados = ordenarCargos(cargos)
  const totalVagas = cargos.reduce((acc, c) => acc + (c.vagas ?? 0), 0)

  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cargo
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Escolaridade
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Vagas
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                Salário inicial
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Localidade
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((cargo, i) => (
              <tr
                key={cargo.id}
                className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  {cargo.titulo}
                </td>
                <td className="px-4 py-3">
                  <EscolaridadeBadge nivel={cargo.escolaridade} />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                  {(cargo.vagas ?? 0).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                  {cargo.salario_inicial
                    ? formatSalario(cargo.salario_inicial)
                    : <span className="text-slate-400">—</span>
                  }
                  {cargo.salario_final && cargo.salario_final !== cargo.salario_inicial && (
                    <span className="text-slate-400 text-xs ml-1">
                      – {formatSalario(cargo.salario_final)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {cargo.localidade ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-500">
                Total
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">
                {totalVagas.toLocaleString('pt-BR')}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {cargos.length > 10 && (
        <p className="text-xs text-slate-400 text-center py-3 border-t border-slate-100">
          Mostrando {cargos.length} cargos
        </p>
      )}
    </div>
  )
}

function EscolaridadeBadge({ nivel }: { nivel: string | null }) {
  const n = nivel?.toLowerCase() ?? ''
  const config =
    n.includes('superior')    ? { label: 'Superior',    cls: 'bg-blue-50 text-blue-700'   } :
    n.includes('médio')       ? { label: 'Médio',       cls: 'bg-green-50 text-green-700' } :
    n.includes('técnico')     ? { label: 'Técnico',     cls: 'bg-amber-50 text-amber-700' } :
    n.includes('fundamental') ? { label: 'Fundamental', cls: 'bg-slate-100 text-slate-600' } :
    { label: nivel ?? '—', cls: 'bg-slate-100 text-slate-500' }

  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${config.cls}`}>
      {config.label}
    </span>
  )
}

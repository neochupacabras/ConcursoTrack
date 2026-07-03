import type { Status } from '@/types'

const config: Record<Status, { label: string; class: string }> = {
  aberto:    { label: 'Aberto',    class: 'bg-green-50 text-green-700 border-green-200' },
  encerrado: { label: 'Encerrado', class: 'bg-slate-100 text-slate-500 border-slate-200' },
  suspenso:  { label: 'Suspenso',  class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  previsto:  { label: 'Previsto',  class: 'bg-blue-50 text-blue-700 border-blue-200' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { label, class: cls } = config[status] ?? config.encerrado
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  )
}

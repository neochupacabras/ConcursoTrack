import type { ProvaAnterior } from '@/types'

interface Props {
  provas: ProvaAnterior[]
}

const TIPO_CONFIG: Record<string, { label: string; icone: string; cls: string }> = {
  prova:      { label: 'Prova',     icone: '📄', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  gabarito:   { label: 'Gabarito',  icone: '✅', cls: 'bg-green-50 text-green-700 border-green-200' },
  resultado:  { label: 'Resultado', icone: '🏆', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export function ProvasAnteriores({ provas }: Props) {
  // Agrupa por ano para exibição
  const porAno = provas.reduce<Record<number, ProvaAnterior[]>>((acc, p) => {
    const ano = p.ano ?? 0
    if (!acc[ano]) acc[ano] = []
    acc[ano].push(p)
    return acc
  }, {})

  const anos = Object.keys(porAno)
    .map(Number)
    .sort((a, b) => b - a) // mais recente primeiro

  return (
    <div className="space-y-4">
      {anos.map((ano) => (
        <div key={ano}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {ano || 'Sem data'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {porAno[ano].map((prova) => {
              const cfg = TIPO_CONFIG[prova.tipo ?? 'prova'] ?? TIPO_CONFIG.prova
              return (
                <div key={prova.id} className="flex items-center gap-3">
                  <a
                    href={prova.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium hover:shadow-sm transition-all ${cfg.cls}`}
                  >
                    <span>{cfg.icone}</span>
                    <span>{cfg.label}</span>
                    <svg className="w-3.5 h-3.5 ml-auto opacity-50" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2.5 11.5l9-9M6.5 2.5h5v5"/>
                    </svg>
                  </a>

                  {prova.gabarito_url && (
                    <a
                      href={prova.gabarito_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Gabarito"
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm font-medium hover:shadow-sm transition-all whitespace-nowrap"
                    >
                      <span>✅</span>
                      <span className="hidden sm:inline text-xs">Gabarito</span>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-400 pt-1">
        Arquivos fornecidos pelas bancas organizadoras. O ConcursoTrack não é responsável pelo conteúdo.
      </p>
    </div>
  )
}

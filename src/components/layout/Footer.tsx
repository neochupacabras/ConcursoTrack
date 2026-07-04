import Link from 'next/link'

const COLUNAS = [
  {
    titulo: 'Concursos',
    links: [
      { href: '/busca',                     label: 'Busca de editais' },
      { href: '/busca?status=previsto',     label: 'Previstos' },
      { href: '/busca?esfera=federal',      label: 'Federais' },
      { href: '/busca?esfera=estadual',     label: 'Estaduais' },
      { href: '/busca?esfera=municipal',    label: 'Municipais' },
    ],
  },
  {
    titulo: 'Ferramentas',
    links: [
      { href: '/simulados',   label: 'Simulados' },
      { href: '/comparador',  label: 'Comparador de editais' },
      { href: '/alertas',     label: 'Alertas de editais' },
      { href: '/calendario',  label: 'Calendário de provas' },
    ],
  },
  {
    titulo: 'Conteúdo',
    links: [
      { href: '/dicas',                        label: 'Dicas de estudo' },
      { href: '/dicas/como-estudar-concurso',  label: 'Como estudar' },
      { href: '/dicas/bancas',                 label: 'Guia de bancas' },
      { href: '/dicas/areas',                  label: 'Áreas do conhecimento' },
    ],
  },
  {
    titulo: 'ConcursoTrack',
    links: [
      { href: '/sobre',        label: 'Sobre' },
      { href: '/contato',      label: 'Contato' },
      { href: '/privacidade',  label: 'Privacidade' },
      { href: '/termos',       label: 'Termos de uso' },
    ],
  },
]

export function Footer() {
  const ano = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-100 bg-slate-50 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Logo + descrição */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-10">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
                  <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity=".7"/>
                  <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity=".7"/>
                  <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity=".5"/>
                </svg>
              </span>
              <span className="font-semibold text-slate-900 text-sm">ConcursoTrack</span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed">
              Editais, simulados e alertas para concursos públicos no Brasil.
            </p>
          </div>

          {/* Links */}
          {COLUNAS.map((col) => (
            <div key={col.titulo}>
              <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                {col.titulo}
              </p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Rodapé inferior */}
        <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            © {ano} ConcursoTrack. Dados de editais atualizados automaticamente.
          </p>
          <p className="text-xs text-slate-400">
            Não somos responsáveis por informações de órgãos externos. Sempre confira o edital oficial.
          </p>
        </div>
      </div>
    </footer>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Página não encontrada — ConcursoTrack',
}

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">

        {/* Número 404 estilizado */}
        <div className="relative mb-8">
          <p className="text-8xl font-bold text-slate-100 select-none leading-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
                <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity=".7"/>
                <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity=".7"/>
                <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity=".5"/>
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          Página não encontrada
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          O endereço que você acessou não existe ou foi movido.
          Mas há muitos concursos abertos esperando por você.
        </p>

        {/* Atalhos úteis */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            href="/"
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Ir para a home
          </Link>
          <Link
            href="/busca"
            className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
          >
            Buscar concursos
          </Link>
        </div>

        {/* Links secundários */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-400">
          <Link href="/busca?esfera=federal" className="hover:text-blue-600 transition">Concursos federais</Link>
          <Link href="/busca?esfera=estadual" className="hover:text-blue-600 transition">Concursos estaduais</Link>
          <Link href="/plano" className="hover:text-blue-600 transition">Planos</Link>
          <Link href="/contato" className="hover:text-blue-600 transition">Contato</Link>
        </div>
      </div>
    </div>
  )
}

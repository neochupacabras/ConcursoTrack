'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import type { User } from '@supabase/supabase-js'

const NAV_LINKS = [
  { href: '/busca',      label: 'Concursos' },
  { href: '/calendario', label: 'Calendário' },
  { href: '/dicas',      label: 'Dicas' },
]

export function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = getSupabaseBrowser()

  const [user, setUser]         = useState<User | null>(null)
  const [menuAberto, setMenu]   = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const userMenuRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenu(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // Iniciais do avatar
  const nomeOuEmail = user?.user_metadata?.nome || user?.email || ''
  const iniciais = nomeOuEmail
    ? nomeOuEmail.split(' ').slice(0, 2).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity=".7"/>
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity=".7"/>
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity=".5"/>
            </svg>
          </span>
          <span className="font-semibold text-slate-900 text-sm tracking-tight">ConcursoTrack</span>
        </Link>

        {/* Links desktop */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === l.href || pathname.startsWith(l.href + '/')
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Ações desktop */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-slate-50 transition"
                aria-label="Menu do usuário"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {iniciais}
                </div>
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenu ? 'rotate-180' : ''}`} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 5l4 4 4-4"/>
                </svg>
              </button>

              {/* Dropdown */}
              {userMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-slate-100 shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-50">
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {user.user_metadata?.nome || 'Minha conta'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                  <Link href="/dashboard" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition" onClick={() => setUserMenu(false)}>
                    Painel
                  </Link>
                  <Link href="/alertas" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition" onClick={() => setUserMenu(false)}>
                    Alertas
                  </Link>
                  <Link href="/simulados" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition" onClick={() => setUserMenu(false)}>
                    Simulados
                  </Link>
                  <Link href="/plano" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition" onClick={() => setUserMenu(false)}>
                    Plano
                  </Link>
                  <div className="border-t border-slate-50 mt-1 pt-1">
                    <button onClick={sair} className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition">
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition">
                Entrar
              </Link>
              <Link href="/cadastro" className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium">
                Criar conta
              </Link>
            </>
          )}
        </div>

        {/* Botão mobile */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-50 text-slate-600"
          onClick={() => setMenu(!menuAberto)}
          aria-label="Abrir menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {menuAberto
              ? <><path d="M4 4l12 12M16 4L4 16"/></>
              : <><path d="M3 6h14M3 10h14M3 14h14"/></>
            }
          </svg>
        </button>
      </nav>

      {/* Menu mobile */}
      {menuAberto && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenu(false)}>
              {l.label}
            </Link>
          ))}
          <div className="border-t border-slate-100 pt-2 mt-2 space-y-1">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                    {iniciais}
                  </div>
                  <span className="text-xs text-slate-500 truncate">{user.email}</span>
                </div>
                <Link href="/dashboard"  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenu(false)}>Painel</Link>
                <Link href="/alertas"    className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenu(false)}>Alertas</Link>
                <Link href="/simulados"  className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenu(false)}>Simulados</Link>
                <Link href="/plano"      className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenu(false)}>Plano</Link>
                <button onClick={sair}  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50">Sair</button>
              </>
            ) : (
              <>
                <Link href="/login"    className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenu(false)}>Entrar</Link>
                <Link href="/cadastro" className="block px-3 py-2 rounded-lg text-sm text-blue-600 font-medium hover:bg-blue-50" onClick={() => setMenu(false)}>Criar conta grátis</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

'use client'
import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

interface Props {
  next?: string
}

export function CadastroForm({ next }: Props) {
  const supabase = getSupabaseBrowser()

  const [nome,   setNome  ] = useState('')
  const [email,  setEmail ] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro,    setErro   ] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next ?? '/dashboard')}`,
        data: { nome: nome.trim() || undefined },
      },
    })

    setLoading(false)
    if (error) {
      setErro('Não foi possível criar a conta. Tente novamente.')
    } else {
      setEnviado(true)
    }
  }

  async function entrarComGoogle() {
    setLoadingGoogle(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next ?? '/dashboard')}`,
      },
    })
  }

  if (enviado) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
        <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="font-semibold text-slate-900 mb-2">Confirme seu e-mail</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-1">
          Enviamos um link de confirmação para
        </p>
        <p className="font-medium text-slate-800 text-sm mb-4">{email}</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          Clique no link para ativar sua conta. O link expira em 1 hora.
          Verifique também a caixa de spam.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">

      {/* O que você ganha */}
      <div className="bg-blue-50 rounded-xl px-4 py-3 mb-5">
        <p className="text-xs font-semibold text-blue-800 mb-1.5">Conta gratuita inclui:</p>
        <ul className="space-y-1">
          {[
            'Alertas de novos editais por e-mail',
            'Simulados com até 10 questões',
            'Acesso a todos os editais abertos',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-blue-700">
              <svg className="w-3 h-3 flex-shrink-0 text-blue-500" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 6.5l2.5 2.5 5.5-5"/>
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Google OAuth */}
      <button
        onClick={entrarComGoogle}
        disabled={loadingGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60 mb-5"
      >
        {loadingGoogle ? (
          <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Cadastrar com Google
      </button>

      {/* Divisor */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400">ou use seu e-mail</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      {/* Formulário */}
      <form onSubmit={criar} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Nome <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como quer ser chamado"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoFocus
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
          />
        </div>

        {erro && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1L.5 12.5h13L7 1zM7 5v3.5M7 10v.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs text-red-700">{erro}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Criando conta...</>
          ) : (
            'Criar conta grátis'
          )}
        </button>
      </form>

      <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
        Ao criar a conta, você concorda com os{' '}
        <a href="/termos" className="hover:underline">Termos de uso</a>
        {' '}e a{' '}
        <a href="/privacidade" className="hover:underline">Política de privacidade</a>.
      </p>
    </div>
  )
}

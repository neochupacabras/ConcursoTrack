'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

export function AlertasBanner() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [logado, setLogado]     = useState(false)
  const [enviado, setEnviado]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user))
  }, [supabase])

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setErro('')

    // Cadastra o usuário com magic link (sem senha)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: { origem: 'banner_alertas' },
      },
    })

    setLoading(false)
    if (error) {
      setErro('Não foi possível cadastrar. Tente novamente.')
    } else {
      setEnviado(true)
    }
  }

  // Usuário já logado — redireciona para configurar alertas
  if (logado) {
    return (
      <section className="bg-blue-600 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-blue-100 text-sm mb-2">Você está logado</p>
          <h2 className="text-white text-xl font-semibold mb-4">
            Configure seus alertas de concurso
          </h2>
          <button
            onClick={() => router.push('/alertas')}
            className="bg-white text-blue-700 font-medium text-sm px-6 py-2.5 rounded-xl hover:bg-blue-50 transition"
          >
            Gerenciar alertas
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-blue-600 py-14 px-4">
      <div className="max-w-xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500 text-blue-100 text-xs font-medium px-3 py-1 rounded-full mb-5">
          <span>🔔</span>
          Grátis, sem spam
        </div>

        <h2 className="text-white text-2xl font-bold mb-3">
          Receba alertas de novos editais
        </h2>
        <p className="text-blue-200 text-sm mb-8 leading-relaxed">
          Avise-me quando sair um concurso na minha área. Você escolhe a área, o estado e o órgão.
        </p>

        {enviado ? (
          <div className="bg-blue-500 rounded-2xl p-6">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-white font-semibold mb-1">Verifique seu e-mail!</p>
            <p className="text-blue-200 text-sm">
              Enviamos um link para <strong className="text-white">{email}</strong>.
              Clique nele para ativar sua conta e configurar os alertas.
            </p>
          </div>
        ) : (
          <form onSubmit={cadastrar} className="flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="flex-1 max-w-xs bg-white text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-white text-blue-700 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-blue-50 transition disabled:opacity-70 flex-shrink-0"
            >
              {loading ? 'Enviando...' : 'Quero receber alertas'}
            </button>
          </form>
        )}

        {erro && (
          <p className="text-red-300 text-xs mt-3">{erro}</p>
        )}

        {!enviado && (
          <p className="text-blue-300 text-xs mt-4">
            Ao continuar, você cria uma conta gratuita no ConcursoTrack.
          </p>
        )}
      </div>
    </section>
  )
}

'use client'
import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/browser'
import Link from 'next/link'

const FEATURES_PREVISTAS = [
  { icone: '📝', titulo: 'Simulados ilimitados', desc: 'Até 40 questões com gabarito comentado por especialistas' },
  { icone: '📊', titulo: 'Desempenho avançado', desc: 'Análise por matéria, evolução ao longo do tempo e pontos fracos' },
  { icone: '📅', titulo: 'Plano de estudos', desc: 'Cronograma personalizado gerado a partir do edital e da data da prova' },
  { icone: '⚖️', titulo: 'Comparador de editais', desc: 'Compare remuneração, vagas e requisitos de vários concursos lado a lado' },
  { icone: '⚡', titulo: 'Alertas instantâneos', desc: 'Notificação push assim que um edital na sua área é publicado' },
  { icone: '🎯', titulo: 'Suporte prioritário', desc: 'Atendimento com prioridade por e-mail e chat' },
]

export function PlanoEmBreve() {
  const supabase = getSupabaseBrowser()
  const [email,   setEmail  ] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro,    setErro   ] = useState('')

  async function notificar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setErro('')
    setLoading(true)

    // Usa o magic link do Supabase para capturar o e-mail
    // (cria conta se não existir, envia link se já existir)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/plano`,
        data: { origem: 'lista_espera_pro' },
      },
    })

    setLoading(false)
    if (error) {
      setErro('Não foi possível cadastrar. Tente novamente.')
    } else {
      setEnviado(true)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">

      {/* Badge */}
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Em desenvolvimento
      </span>

      <h1 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
        O ConcursoTrack Pro está chegando
      </h1>
      <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
        Estamos construindo ferramentas avançadas para quem leva a preparação a sério.
        Enquanto isso, tudo na plataforma é <strong className="text-slate-700">100% gratuito</strong>.
      </p>

      {/* Features previstas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12 text-left">
        {FEATURES_PREVISTAS.map((f) => (
          <div key={f.titulo} className="flex items-start gap-3 bg-white rounded-xl border border-slate-100 p-4">
            <span className="text-2xl flex-shrink-0">{f.icone}</span>
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">{f.titulo}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Captação */}
      <div className="bg-slate-900 rounded-2xl p-8">
        <h2 className="text-white text-lg font-semibold mb-2">
          Seja o primeiro a saber quando lançar
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          Deixe seu e-mail e avisamos assim que o Pro estiver disponível — com desconto exclusivo para a lista de espera.
        </p>

        {enviado ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">Você está na lista!</p>
            <p className="text-slate-400 text-sm">
              Verifique seu e-mail para confirmar. Avisaremos assim que o Pro abrir.
            </p>
          </div>
        ) : (
          <form onSubmit={notificar} className="flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="flex-1 max-w-xs bg-white/10 border border-white/20 text-white placeholder-slate-400 text-sm px-4 py-3 rounded-xl outline-none focus:border-white/40 focus:bg-white/15 transition"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm px-6 py-3 rounded-xl transition"
            >
              {loading ? 'Cadastrando...' : 'Quero ser avisado'}
            </button>
          </form>
        )}

        {erro && <p className="text-red-400 text-xs mt-3">{erro}</p>}
      </div>

      {/* Link para voltar */}
      <p className="mt-8 text-sm text-slate-400">
        Enquanto isso,{' '}
        <Link href="/busca" className="text-blue-600 hover:underline">
          explore os concursos abertos
        </Link>{' '}
        e{' '}
        <Link href="/alertas" className="text-blue-600 hover:underline">
          configure seus alertas gratuitos
        </Link>.
      </p>
    </div>
  )
}

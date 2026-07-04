'use client'
import { useState } from 'react'
import type { Metadata } from 'next'

export default function ContatoPage() {
  const [nome,     setNome    ] = useState('')
  const [email,    setEmail   ] = useState('')
  const [assunto,  setAssunto ] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviado,  setEnviado ] = useState(false)
  const [loading,  setLoading ] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch(process.env.NEXT_PUBLIC_FORMSPREE_URL!, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ nome, email, assunto, mensagem }),
    })

    setLoading(false)
    if (res.ok) {
      setEnviado(true)
    } else {
      alert('Não foi possível enviar. Tente novamente ou escreva para contato@concursotrack.com.br')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Fale conosco</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Dúvidas, sugestões ou problemas? Respondemos em até 2 dias úteis.
        </p>
      </div>

      {/* Canais rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
        {[
          { icon: '📋', titulo: 'Edital incorreto', desc: 'Encontrou dados errados em um concurso?' },
          { icon: '💡', titulo: 'Sugestão', desc: 'Tem uma ideia para melhorar a plataforma?' },
          { icon: '💳', titulo: 'Cobrança ou assinatura', desc: 'Problemas com pagamento ou plano?' },
          { icon: '🔒', titulo: 'Privacidade', desc: 'Solicitações sobre seus dados (LGPD)' },
        ].map((c) => (
          <div key={c.titulo} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
            <span className="text-xl flex-shrink-0">{c.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-800 mb-0.5">{c.titulo}</p>
              <p className="text-xs text-slate-500">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {enviado ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="font-semibold text-slate-900 mb-1">Mensagem enviada!</p>
          <p className="text-slate-500 text-sm">Recebemos sua mensagem e responderemos em até 2 dias úteis no e-mail informado.</p>
          <button
            onClick={() => { setEnviado(false); setNome(''); setEmail(''); setAssunto(''); setMensagem('') }}
            className="mt-4 text-xs text-blue-600 hover:underline"
          >
            Enviar outra mensagem
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Assunto</label>
            <select
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              required
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
            >
              <option value="">Selecione um assunto</option>
              <option value="Edital incorreto ou desatualizado">Edital incorreto ou desatualizado</option>
              <option value="Problema com pagamento ou assinatura">Problema com pagamento ou assinatura</option>
              <option value="Problema técnico">Problema técnico</option>
              <option value="Sugestão de melhoria">Sugestão de melhoria</option>
              <option value="Solicitação LGPD (dados pessoais)">Solicitação LGPD (dados pessoais)</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Mensagem</label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva sua dúvida ou sugestão com o máximo de detalhes..."
              required
              rows={5}
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Preparando...</>
            ) : 'Enviar mensagem'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Ou escreva diretamente para{' '}
            <a href="mailto:contato@concursotrack.com.br" className="text-blue-600 hover:underline">
              contato@concursotrack.com.br
            </a>
          </p>
        </form>
      )}
    </div>
  )
}

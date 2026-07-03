'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Questao, RespostaSimulado } from '@/types'

interface QuestaoComResposta {
  questao:  Questao
  resposta: RespostaSimulado
}

interface Props {
  simuladoId: string
  itens:      QuestaoComResposta[]
  jaConcluido: boolean
}

type EstadoResposta = 'pendente' | 'respondida' | 'confirmada'

export function PlayerSimulado({ simuladoId, itens, jaConcluido }: Props) {
  const router  = useRouter()
  const [cursor, setCursor]           = useState(0)
  const [respostas, setRespostas]     = useState<Record<string, string>>(() => {
    // Pré-carrega respostas já salvas (simulado retomado)
    return Object.fromEntries(
      itens
        .filter((i) => i.resposta.resposta_usuario)
        .map((i) => [i.questao.id, i.resposta.resposta_usuario!])
    )
  })
  const [feedback, setFeedback]       = useState<Record<string, boolean>>({})
  const [estado, setEstado]           = useState<EstadoResposta>('pendente')
  const [finalizando, setFinalizando] = useState(false)
  const [erroFinal, setErroFinal]     = useState('')

  // Cronômetro
  const [segundos, setSegundos]  = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (jaConcluido) return
    timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [jaConcluido])

  const item    = itens[cursor]
  const questao = item.questao
  const alternativas = Object.entries(questao.alternativas) as [string, string][]
  const respostaAtual = respostas[questao.id]
  const feedbackAtual = feedback[questao.id]
  const respondidas   = Object.keys(respostas).length
  const progresso     = Math.round((respondidas / itens.length) * 100)

  function formatarTempo(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const ss = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  const confirmarResposta = useCallback(async (alternativa: string) => {
    if (respostas[questao.id] || jaConcluido) return

    // Feedback imediato antes da API
    setRespostas((prev) => ({ ...prev, [questao.id]: alternativa }))
    setEstado('respondida')

    const res = await fetch(`/api/simulados/${simuladoId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        questao_id: questao.id,
        resposta:   alternativa,
        gabarito:   questao.gabarito,
      }),
    })

    const json = await res.json()
    setFeedback((prev) => ({ ...prev, [questao.id]: json.correta }))
    setEstado('confirmada')
  }, [questao.id, questao.gabarito, respostas, simuladoId, jaConcluido])

  // Atalho de teclado: A-E para responder, → e ← para navegar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      const letra = e.key.toUpperCase()
      if (['A','B','C','D','E'].includes(letra) && !respostas[questao.id] && !jaConcluido) {
        if (questao.alternativas[letra as keyof typeof questao.alternativas]) {
          confirmarResposta(letra)
        }
      }
      if (e.key === 'ArrowRight') setCursor((c) => Math.min(c + 1, itens.length - 1))
      if (e.key === 'ArrowLeft')  setCursor((c) => Math.max(c - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [questao, respostas, itens.length, confirmarResposta, jaConcluido])

  async function finalizar() {
    if (finalizando) return
    setFinalizando(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const res = await fetch(`/api/simulados/${simuladoId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tempo_segundos: segundos }),
    })

    if (res.ok) {
      router.push(`/simulados/${simuladoId}/resultado`)
    } else {
      setErroFinal('Não foi possível finalizar. Tente novamente.')
      setFinalizando(false)
      if (timerRef.current) timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    }
  }

  // Cor de cada alternativa
  function corAlternativa(letra: string) {
    if (!respostas[questao.id] && !jaConcluido) {
      return 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 cursor-pointer'
    }
    const isGabarito = letra === questao.gabarito
    const isSelecionada = letra === (respostas[questao.id] ?? item.resposta.resposta_usuario)
    if (isGabarito)
      return 'border-green-400 bg-green-50 text-green-900 font-medium'
    if (isSelecionada && !isGabarito)
      return 'border-red-300 bg-red-50 text-red-800'
    return 'border-slate-100 bg-slate-50 text-slate-400'
  }

  const todasRespondidas = respondidas === itens.length

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Barra de topo */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>{respondidas}/{itens.length} respondidas</span>
            <span>{progresso}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        {!jaConcluido && (
          <div className="flex items-center gap-1.5 text-sm font-mono text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5"/>
              <path d="M7 4v3l2 1.5" strokeLinecap="round"/>
            </svg>
            {formatarTempo(segundos)}
          </div>
        )}
      </div>

      {/* Navegação por número */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {itens.map((it, i) => {
          const resp = respostas[it.questao.id] ?? it.resposta.resposta_usuario
          const correta = feedback[it.questao.id] ?? it.resposta.correta
          const ativa = i === cursor

          return (
            <button
              key={it.questao.id}
              onClick={() => setCursor(i)}
              title={`Questão ${i + 1}`}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                ativa
                  ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-600 text-white'
                  : resp !== undefined && resp !== null
                    ? correta === true  ? 'bg-green-100 text-green-700'
                    : correta === false ? 'bg-red-100 text-red-600'
                    : 'bg-slate-200 text-slate-600'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {/* Card da questão */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Questão {cursor + 1} de {itens.length}
          </span>
          {questao.materia && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {questao.materia}
            </span>
          )}
          {questao.banca_sigla && (
            <span className="text-xs text-slate-400">{questao.banca_sigla}</span>
          )}
          {questao.ano && (
            <span className="text-xs text-slate-400">{questao.ano}</span>
          )}
        </div>

        <p className="text-slate-800 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
          {questao.enunciado}
        </p>

        <div className="space-y-2.5">
          {alternativas.map(([letra, texto]) => (
            <button
              key={letra}
              onClick={() => confirmarResposta(letra)}
              disabled={!!respostas[questao.id] || jaConcluido}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${corAlternativa(letra)}`}
            >
              <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold mt-0.5 ${
                letra === questao.gabarito && (respostas[questao.id] || jaConcluido)
                  ? 'border-green-500 bg-green-500 text-white'
                  : letra === (respostas[questao.id] ?? item.resposta.resposta_usuario) && letra !== questao.gabarito
                  ? 'border-red-400 bg-red-400 text-white'
                  : 'border-current bg-transparent'
              }`}>
                {letra}
              </span>
              <span className="text-sm leading-relaxed">{texto}</span>

              {/* Ícone de feedback */}
              {(respostas[questao.id] || jaConcluido) && (
                <>
                  {letra === questao.gabarito && (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M3 8.5l3.5 3.5 6.5-7"/>
                    </svg>
                  )}
                  {letra === (respostas[questao.id] ?? item.resposta.resposta_usuario) && letra !== questao.gabarito && (
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0 ml-auto mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8"/>
                    </svg>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Feedback imediato após responder */}
        {respostas[questao.id] && !jaConcluido && (
          <div className={`mt-4 flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-xl ${
            feedbackAtual === true
              ? 'bg-green-50 text-green-800 border border-green-200'
              : feedbackAtual === false
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-slate-50 text-slate-500'
          }`}>
            {feedbackAtual === true && (
              <><svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg> Correto!</>
            )}
            {feedbackAtual === false && (
              <><svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg> Incorreto. A resposta correta é <strong>{questao.gabarito}</strong>.</>
            )}
            {feedbackAtual === undefined && estado === 'respondida' && (
              <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Verificando...</>
            )}
          </div>
        )}
      </div>

      {/* Navegação inferior */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCursor((c) => Math.max(c - 1, 0))}
          disabled={cursor === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3L6 8l4 5"/></svg>
          Anterior
        </button>

        {cursor < itens.length - 1 ? (
          <button
            onClick={() => setCursor((c) => c + 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition"
          >
            Próxima
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3l4 5-4 5"/></svg>
          </button>
        ) : (
          !jaConcluido && (
            <button
              onClick={finalizar}
              disabled={finalizando || !todasRespondidas}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
              title={!todasRespondidas ? 'Responda todas as questões antes de finalizar' : ''}
            >
              {finalizando ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Finalizando...</>
              ) : (
                <>Ver resultado<svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 3l4 5-4 5"/></svg></>
              )}
            </button>
          )
        )}
      </div>

      {!todasRespondidas && cursor === itens.length - 1 && !jaConcluido && (
        <p className="text-center text-xs text-amber-600 mt-3">
          Ainda há {itens.length - respondidas} questão(ões) sem resposta. Volte e responda antes de finalizar.
        </p>
      )}

      {erroFinal && (
        <p className="text-center text-sm text-red-600 mt-3">{erroFinal}</p>
      )}

      <p className="text-center text-xs text-slate-400 mt-4">
        Dica: use as teclas <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500">A</kbd>–<kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500">E</kbd> para responder e{' '}
        <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500">←</kbd>
        <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500">→</kbd> para navegar.
      </p>
    </div>
  )
}

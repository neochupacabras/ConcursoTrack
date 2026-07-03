'use client'
import { useState } from 'react'
import type { Questao } from '@/types'

interface RespostaComQuestao {
  correta: boolean | null
  resposta_usuario: string | null
  questoes: Questao
}

interface Props {
  respostas: RespostaComQuestao[]
}

type Filtro = 'todas' | 'acertos' | 'erros'

export function GabaritoRevision({ respostas }: Props) {
  const [filtro, setFiltro]     = useState<Filtro>('todas')
  const [expandida, setExpandida] = useState<string | null>(null)

  const filtradas = respostas.filter((r) => {
    if (filtro === 'acertos') return r.correta === true
    if (filtro === 'erros')   return r.correta === false
    return true
  })

  return (
    <div>
      {/* Filtros de revisão */}
      <div className="flex gap-2 mb-4">
        {(['todas', 'acertos', 'erros'] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              filtro === f
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'todas'   ? `Todas (${respostas.length})`
            : f === 'acertos' ? `Acertos (${respostas.filter(r => r.correta).length})`
            :                   `Erros (${respostas.filter(r => !r.correta).length})`}
          </button>
        ))}
      </div>

      {/* Lista de questões */}
      <div className="space-y-2">
        {filtradas.map((r, i) => {
          const q         = r.questoes
          const aberta    = expandida === q.id
          const acertou   = r.correta === true
          const alternativas = Object.entries(q.alternativas ?? {}) as [string, string][]

          return (
            <div
              key={q.id}
              className={`rounded-xl border overflow-hidden transition-all ${
                acertou ? 'border-green-200' : 'border-red-200'
              }`}
            >
              {/* Cabeçalho colapsável */}
              <button
                onClick={() => setExpandida(aberta ? null : q.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                  acertou ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'
                }`}
              >
                {/* Número */}
                <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                  acertou ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'
                }`}>
                  {respostas.indexOf(r) + 1}
                </span>

                {/* Ícone correto/errado */}
                {acertou ? (
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 8.5l3.5 3.5 6.5-7"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8"/>
                  </svg>
                )}

                {/* Enunciado truncado */}
                <span className="flex-1 text-sm text-slate-700 line-clamp-1 text-left">
                  {q.enunciado}
                </span>

                {/* Resposta do usuário vs gabarito */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    acertou ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-700'
                  }`}>
                    {r.resposta_usuario ?? '—'}
                  </span>
                  {!acertou && (
                    <>
                      <svg className="w-3 h-3 text-slate-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 6h8M6 2l4 4-4 4"/>
                      </svg>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-200 text-green-800">
                        {q.gabarito}
                      </span>
                    </>
                  )}
                </div>

                {/* Chevron */}
                <svg
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`}
                  viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                >
                  <path d="M4 6l4 4 4-4"/>
                </svg>
              </button>

              {/* Expansão com enunciado completo e alternativas */}
              {aberta && (
                <div className="px-4 pb-4 pt-3 bg-white border-t border-slate-100">
                  {/* Metadados */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {q.materia && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{q.materia}</span>
                    )}
                    {q.banca_sigla && (
                      <span className="text-xs text-slate-400">{q.banca_sigla}</span>
                    )}
                    {q.ano && (
                      <span className="text-xs text-slate-400">{q.ano}</span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">
                    {q.enunciado}
                  </p>

                  <div className="space-y-2">
                    {alternativas.map(([letra, texto]) => {
                      const isGabarito   = letra === q.gabarito
                      const isUsuario    = letra === r.resposta_usuario
                      const isErrada     = isUsuario && !isGabarito

                      return (
                        <div
                          key={letra}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm ${
                            isGabarito ? 'bg-green-50 border border-green-200'
                            : isErrada  ? 'bg-red-50 border border-red-200'
                            :             'bg-slate-50 border border-slate-100'
                          }`}
                        >
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5 ${
                            isGabarito ? 'bg-green-500 text-white'
                            : isErrada  ? 'bg-red-400 text-white'
                            :             'bg-slate-200 text-slate-500'
                          }`}>
                            {letra}
                          </span>
                          <span className={`leading-relaxed ${
                            isGabarito ? 'text-green-900 font-medium'
                            : isErrada  ? 'text-red-800'
                            :             'text-slate-500'
                          }`}>
                            {texto}
                          </span>
                          {isGabarito && (
                            <span className="ml-auto flex-shrink-0 text-xs text-green-600 font-semibold">Gabarito</span>
                          )}
                          {isErrada && (
                            <span className="ml-auto flex-shrink-0 text-xs text-red-500 font-semibold">Sua resposta</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtradas.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-8">
          {filtro === 'erros' ? 'Nenhum erro! Ótimo desempenho.' : 'Nenhuma questão encontrada.'}
        </p>
      )}
    </div>
  )
}

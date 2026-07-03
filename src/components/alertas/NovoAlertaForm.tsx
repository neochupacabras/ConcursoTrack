'use client'
import { useState } from 'react'
import type { Alerta, Esfera } from '@/types'

const AREAS = [
  { value: 'administrativa',    label: 'Administrativa' },
  { value: 'fiscal_tributaria', label: 'Fiscal / Tributária' },
  { value: 'seguranca_publica', label: 'Segurança Pública' },
  { value: 'saude',             label: 'Saúde' },
  { value: 'educacao',          label: 'Educação' },
  { value: 'tecnologia',        label: 'Tecnologia' },
  { value: 'engenharia',        label: 'Engenharia' },
  { value: 'juridica',          label: 'Jurídica' },
]

const ESFERAS: { value: Esfera; label: string }[] = [
  { value: 'federal',   label: 'Federal' },
  { value: 'estadual',  label: 'Estadual' },
  { value: 'municipal', label: 'Municipal' },
]

const ESTADOS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

interface Props {
  onCriado:   (alerta: Alerta) => void
  onCancelar: () => void
}

export function NovoAlertaForm({ onCriado, onCancelar }: Props) {
  const [area,   setArea  ] = useState('')
  const [esfera, setEsfera] = useState('')
  const [estado, setEstado] = useState('')
  const [orgao,  setOrgao ] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro,    setErro   ] = useState('')

  const temCriterio = !!(area || esfera || estado || orgao.trim())

  // Resumo legível do alerta que será criado
  const preview: string[] = []
  if (area)         preview.push(AREAS.find((a) => a.value === area)?.label ?? area)
  if (esfera)       preview.push(ESFERAS.find((e) => e.value === esfera)?.label ?? esfera)
  if (estado)       preview.push(estado)
  if (orgao.trim()) preview.push(orgao.trim())

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!temCriterio) return
    setErro('')
    setLoading(true)

    const res = await fetch('/api/alertas', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        area_conhecimento: area   || null,
        esfera:            esfera || null,
        estado:            estado || null,
        orgao:             orgao.trim() || null,
        canal:             'email',
      }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setErro(json.error ?? 'Não foi possível criar o alerta.')
      return
    }

    onCriado(json as Alerta)
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 text-sm">Novo alerta</h3>
        <button
          onClick={onCancelar}
          className="text-slate-400 hover:text-slate-600 transition"
          aria-label="Fechar"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Você receberá um e-mail quando sair um concurso que combine com os critérios abaixo.
        Informe ao menos um.
      </p>

      <form onSubmit={criar} className="space-y-3">

        {/* Área de conhecimento */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Área de conhecimento
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Qualquer área</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Linha esfera + estado */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Esfera</label>
            <select
              value={esfera}
              onChange={(e) => setEsfera(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Qualquer esfera</option>
              {ESFERAS.map((ef) => (
                <option key={ef.value} value={ef.value}>{ef.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Qualquer estado</option>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Órgão específico */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Órgão específico
            <span className="text-slate-400 font-normal ml-1">(opcional)</span>
          </label>
          <input
            type="text"
            value={orgao}
            onChange={(e) => setOrgao(e.target.value)}
            placeholder="Ex: INSS, Prefeitura de SP, Receita Federal..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Preview do alerta */}
        {temCriterio && (
          <div className="bg-white rounded-lg border border-blue-200 px-3 py-2.5 flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5"/>
              <path d="M7 5v3M7 9.5v.5" strokeLinecap="round"/>
            </svg>
            <p className="text-xs text-blue-800 leading-relaxed">
              Você receberá alertas de:{' '}
              <strong>{preview.join(' · ')}</strong>
            </p>
          </div>
        )}

        {erro && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1L.5 12.5h13L7 1zM7 5v3.5M7 10v.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs text-red-700">{erro}</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!temCriterio || loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Criando...</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M7 1.5v11M1.5 7h11"/>
                </svg>
                Criar alerta
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2.5 border border-slate-200 bg-white text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

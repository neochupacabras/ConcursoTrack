import { notFound } from 'next/navigation'
import { getConcursoBySlug } from '@/lib/queries'
import { CargosTable } from '@/components/concursos/CargosTable'
import { ProvasAnteriores } from '@/components/concursos/ProvasAnteriores'
import { BotaoAlerta } from '@/components/concursos/BotaoAlerta'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const concurso = await getConcursoBySlug(slug)
  if (!concurso) return {}
  return {
    title: `${concurso.titulo} — ${concurso.orgao}`,
    description: concurso.descricao
      ? concurso.descricao.slice(0, 160)
      : `Concurso público para ${concurso.orgao}. ${concurso.total_vagas} vagas. Inscrições até ${formatDate(concurso.data_encerramento)}.`,
  }
}

export default async function ConcursoPage({ params }: Props) {
  const { slug } = await params
  const concurso = await getConcursoBySlug(slug)
  if (!concurso) notFound()

  const diasRestantes = concurso.data_encerramento
    ? Math.ceil((new Date(concurso.data_encerramento).getTime() - Date.now()) / 86_400_000)
    : null

  // Parse dos links de PDF (armazenados como JSON string)
  let linksPdf: { titulo: string; url: string }[] = []
  if (concurso.links_pdf) {
    try {
      linksPdf = JSON.parse(concurso.links_pdf as string)
    } catch { /* ignora JSON inválido */ }
  }

  // Formata a descrição preservando parágrafos e listas
  const paragrafos = concurso.descricao
    ? concurso.descricao
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0)
    : []

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      {/* Cabeçalho */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <a href="/busca" className="hover:text-blue-600">Concursos</a>
          <span>/</span>
          <span>{concurso.orgao}</span>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 mb-3">
          {concurso.titulo}
        </h1>

        <div className="flex flex-wrap gap-2 items-center">
          <StatusBadge status={concurso.status} />
          {concurso.bancas && (
            <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {concurso.bancas.sigla}
            </span>
          )}
          {concurso.esfera && concurso.esfera !== 'nao_identificada' && (
            <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded capitalize">
              {concurso.esfera}
            </span>
          )}
          {concurso.estado && (
            <span className="text-sm bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {concurso.estado}
            </span>
          )}
        </div>
      </div>

      {/* Datas-chave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <InfoBox label="Total de vagas" valor={concurso.total_vagas.toLocaleString('pt-BR')} />
        <InfoBox label="Abertura" valor={formatDate(concurso.data_abertura)} />
        <InfoBox
          label="Encerramento"
          valor={formatDate(concurso.data_encerramento)}
          destaque={diasRestantes !== null && diasRestantes <= 7}
          subvalor={diasRestantes !== null && diasRestantes > 0
            ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`
            : undefined}
        />
        <InfoBox label="Prova" valor={formatDate(concurso.data_prova)} />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3 mb-10">
        {concurso.edital_url && (
          <a
            href={concurso.edital_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Acessar edital oficial
          </a>
        )}
        <BotaoAlerta concursoId={concurso.id} area={concurso.area_conhecimento} />
        <a
          href={`/simulados?concurso=${concurso.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
        >
          Fazer simulado
        </a>
        <a
          href={`/comparador?ids=${concurso.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
        >
          Comparar edital
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-10">

          {/* Descrição */}
          {paragrafos.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Sobre este concurso</h2>
              <div className="text-sm text-slate-600 leading-relaxed space-y-3">
                {paragrafos.map((p: string, i: number) => {
                  if (p.startsWith('###')) {
                    return (
                      <h3 key={i} className="text-sm font-semibold text-slate-800 mt-4">
                        {p.replace(/^###\s*/, '')}
                      </h3>
                    )
                  }
                  if (p.startsWith('*') || p.startsWith('•')) {
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
                        <span>{p.replace(/^[\*•]\s*/, '')}</span>
                      </div>
                    )
                  }
                  return <p key={i}>{p}</p>
                })}
              </div>
              <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                Fonte:{' '}
                <a href={concurso.fonte_url} target="_blank" rel="noopener noreferrer"
                   className="hover:text-blue-600 underline">
                  PCI Concursos
                </a>
                {' '}— Sempre confira o edital oficial antes de se inscrever.
              </p>
            </section>
          )}

          {/* Cargos */}
          {concurso.cargos && concurso.cargos.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Cargos e vagas</h2>
              <CargosTable cargos={concurso.cargos} />
            </section>
          )}

          {/* Provas anteriores */}
          {concurso.provas_anteriores && concurso.provas_anteriores.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Provas anteriores</h2>
              <ProvasAnteriores provas={concurso.provas_anteriores} />
            </section>
          )}
        </div>

        {/* Sidebar com PDFs */}
        <div className="space-y-6">
          {linksPdf.length > 0 && (
            <div className="bg-slate-50 rounded-xl border border-slate-100 p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="1" width="12" height="14" rx="2"/>
                  <path d="M5 6h6M5 9h6M5 12h4" strokeLinecap="round"/>
                </svg>
                Documentos
              </h2>
              <ul className="space-y-2">
                {linksPdf.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-xs text-blue-700 hover:text-blue-900 hover:underline leading-snug"
                    >
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M2 0h7l3 3v10a1 1 0 01-1 1H2a1 1 0 01-1-1V1a1 1 0 011-1zm6 0v3h3"/>
                      </svg>
                      {link.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Box de alerta */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
            <p className="text-sm font-semibold text-slate-800 mb-2">
              Receba atualizações
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Ative alertas para ser notificado quando novos concursos dessa área forem publicados.
            </p>
            <BotaoAlerta concursoId={concurso.id} area={concurso.area_conhecimento} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBox({
  label, valor, destaque = false, subvalor,
}: {
  label: string
  valor: string | null
  destaque?: boolean
  subvalor?: string
}) {
  return (
    <div className={`rounded-xl p-4 border ${destaque ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`font-semibold text-sm ${destaque ? 'text-red-700' : 'text-slate-900'}`}>
        {valor ?? '—'}
      </p>
      {subvalor && <p className="text-xs text-red-500 mt-0.5">{subvalor}</p>}
    </div>
  )
}

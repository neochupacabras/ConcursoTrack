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
    description: `Concurso público para ${concurso.orgao}. ${concurso.total_vagas} vagas. Inscrições até ${formatDate(concurso.data_encerramento)}.`,
  }
}

export default async function ConcursoPage({ params }: Props) {
  const { slug } = await params
  const concurso = await getConcursoBySlug(slug)
  if (!concurso) notFound()

  const diasRestantes = concurso.data_encerramento
    ? Math.ceil(
        (new Date(concurso.data_encerramento).getTime() - Date.now()) / 86_400_000
      )
    : null

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
          {concurso.esfera && (
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
            : undefined
          }
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
      </div>

      {/* Cargos */}
      {concurso.cargos && concurso.cargos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Cargos e vagas</h2>
          <CargosTable cargos={concurso.cargos} />
        </section>
      )}

      {/* Provas anteriores */}
      {concurso.provas_anteriores && concurso.provas_anteriores.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Provas anteriores</h2>
          <ProvasAnteriores provas={concurso.provas_anteriores} />
        </section>
      )}
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
      {subvalor && (
        <p className="text-xs text-red-500 mt-0.5">{subvalor}</p>
      )}
    </div>
  )
}

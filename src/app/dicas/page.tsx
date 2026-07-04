import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dicas para concursos públicos — ConcursoTrack',
  description: 'Guias, estratégias de estudo e análise de bancas para quem quer passar em concursos públicos.',
}

// Artigos estáticos — adicione mais conforme o conteúdo crescer
const ARTIGOS = [
  {
    slug: 'como-estudar-para-concursos',
    categoria: 'Estudo',
    titulo: 'Como estudar para concursos públicos: guia completo para iniciantes',
    resumo: 'Do zero ao edital: como montar um plano de estudos eficiente, escolher materiais e manter a consistência ao longo dos meses.',
    tempo: '8 min',
  },
  {
    slug: 'guia-bancas-organizadoras',
    categoria: 'Bancas',
    titulo: 'Guia completo das principais bancas organizadoras do Brasil',
    resumo: 'CEBRASPE, FGV, VUNESP, IBFC e outras — entenda o estilo de cada banca, o que cobram e como se preparar especificamente.',
    tempo: '12 min',
  },
  {
    slug: 'como-ler-edital',
    categoria: 'Estratégia',
    titulo: 'Como ler um edital de concurso público sem se perder',
    resumo: 'Os editais têm dezenas de páginas. Saiba o que realmente importa, o que ignorar e quais datas nunca podem passar em branco.',
    tempo: '6 min',
  },
  {
    slug: 'areas-concursos-mais-vagas',
    categoria: 'Mercado',
    titulo: 'Áreas com mais vagas em concursos públicos em 2026',
    resumo: 'Análise dos concursos com maior número de vagas por área de conhecimento e tendências para os próximos meses.',
    tempo: '5 min',
  },
  {
    slug: 'tecnicas-memorizar-conteudo',
    categoria: 'Estudo',
    titulo: 'Técnicas de memorização para candidatos a concursos',
    resumo: 'Flashcards, repetição espaçada, mapas mentais — quais técnicas realmente funcionam para o volume de conteúdo dos concursos.',
    tempo: '7 min',
  },
  {
    slug: 'gestao-tempo-prova',
    categoria: 'Estratégia',
    titulo: 'Gestão de tempo na prova: como não deixar questões em branco',
    resumo: 'Estratégias práticas para administrar o tempo durante a prova, lidar com questões difíceis e revisar sem entrar em pânico.',
    tempo: '5 min',
  },
]

const CATEGORIAS = ['Todos', ...Array.from(new Set(ARTIGOS.map((a) => a.categoria)))]

const COR_CATEGORIA: Record<string, string> = {
  'Estudo':     'bg-blue-50 text-blue-700',
  'Bancas':     'bg-purple-50 text-purple-700',
  'Estratégia': 'bg-amber-50 text-amber-700',
  'Mercado':    'bg-green-50 text-green-700',
}

export default function DicasPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Dicas para concursos</h1>
        <p className="text-slate-500 text-sm">
          Guias práticos sobre estudo, bancas e estratégias para aprovação.
        </p>
      </div>

      {/* Destaque — primeiro artigo */}
      <Link
        href={`/dicas/${ARTIGOS[0].slug}`}
        className="group block bg-blue-600 rounded-2xl p-8 mb-8 hover:bg-blue-700 transition"
      >
        <span className="inline-block text-xs font-semibold text-blue-200 bg-blue-500 px-2.5 py-1 rounded-full mb-4">
          {ARTIGOS[0].categoria}
        </span>
        <h2 className="text-xl font-semibold text-white mb-3 leading-snug group-hover:underline">
          {ARTIGOS[0].titulo}
        </h2>
        <p className="text-blue-200 text-sm leading-relaxed mb-4">
          {ARTIGOS[0].resumo}
        </p>
        <p className="text-blue-300 text-xs">{ARTIGOS[0].tempo} de leitura</p>
      </Link>

      {/* Grid de artigos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ARTIGOS.slice(1).map((artigo) => (
          <Link
            key={artigo.slug}
            href={`/dicas/${artigo.slug}`}
            className="group block bg-white rounded-xl border border-slate-100 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
          >
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 ${COR_CATEGORIA[artigo.categoria] ?? 'bg-slate-100 text-slate-600'}`}>
              {artigo.categoria}
            </span>
            <h2 className="text-sm font-semibold text-slate-900 mb-2 leading-snug group-hover:text-blue-700 transition-colors">
              {artigo.titulo}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
              {artigo.resumo}
            </p>
            <p className="text-xs text-slate-400">{artigo.tempo} de leitura</p>
          </Link>
        ))}
      </div>

      {/* Banner de alerta */}
      <div className="mt-10 bg-slate-50 rounded-xl border border-slate-100 p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900 mb-1">Não perca novos editais</p>
          <p className="text-xs text-slate-500">
            Configure alertas gratuitos e receba um e-mail quando sair um concurso na sua área.
          </p>
        </div>
        <Link
          href="/cadastro"
          className="flex-shrink-0 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition whitespace-nowrap"
        >
          Criar conta grátis
        </Link>
      </div>
    </div>
  )
}

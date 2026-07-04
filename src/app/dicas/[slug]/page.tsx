import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

// Conteúdo dos artigos — em produção substituir por CMS ou arquivos MDX
const ARTIGOS: Record<string, {
  categoria: string
  titulo: string
  resumo: string
  tempo: string
  conteudo: React.ReactNode
}> = {
  'como-estudar-para-concursos': {
    categoria: 'Estudo',
    titulo: 'Como estudar para concursos públicos: guia completo para iniciantes',
    resumo: 'Do zero ao edital: como montar um plano de estudos eficiente, escolher materiais e manter a consistência ao longo dos meses.',
    tempo: '8 min',
    conteudo: (
      <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
        <p>Estudar para concursos públicos é uma maratona, não uma corrida. O candidato que entende isso desde o início tem uma vantagem enorme sobre quem tenta memorizar tudo em pouco tempo.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">1. Leia o edital antes de qualquer coisa</h2>
        <p>O edital é o contrato do concurso. Nele você encontra o conteúdo programático exato, o número de questões por matéria e o peso de cada uma. Estudar sem ler o edital é como viajar sem mapa.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">2. Monte um cronograma realista</h2>
        <p>Distribua as matérias ao longo das semanas considerando o peso de cada uma no edital e sua familiaridade com o conteúdo. Reserve ao menos 30% do tempo total para revisão e simulados.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">3. Resolva provas anteriores</h2>
        <p>Provas antigas são o melhor guia do que cai. A maioria das bancas tem padrões repetitivos de tema e estilo de questão. Resolva no mínimo as últimas 3 provas do mesmo órgão ou banca.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">4. Consistência acima de intensidade</h2>
        <p>3 horas por dia todos os dias superam 10 horas num fim de semana. O aprendizado de longo prazo depende de repetição espaçada — seu cérebro precisa de tempo para consolidar o que aprendeu.</p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mt-8">
          <p className="text-sm font-semibold text-blue-900 mb-2">Dica do ConcursoTrack</p>
          <p className="text-sm text-blue-700">Use os simulados gratuitos da plataforma para treinar com questões reais das bancas e acompanhar sua evolução por matéria.</p>
        </div>
      </div>
    ),
  },
  'guia-bancas-organizadoras': {
    categoria: 'Bancas',
    titulo: 'Guia completo das principais bancas organizadoras do Brasil',
    resumo: 'CEBRASPE, FGV, VUNESP, IBFC e outras — entenda o estilo de cada banca, o que cobram e como se preparar especificamente.',
    tempo: '12 min',
    conteudo: (
      <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
        <p>Cada banca tem um estilo próprio. Conhecer as características de cada uma é tão importante quanto estudar o conteúdo.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">CEBRASPE / CESPE</h2>
        <p>Questões de certo/errado com penalização por erro (cada errada anula uma certa). Cobram interpretação de texto e legislação atualizada. Exige atenção redobrada a palavras como "sempre", "nunca", "apenas" — são armadilhas frequentes.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">FGV</h2>
        <p>Questões de múltipla escolha mais elaboradas, com enunciados longos. Cobra raciocínio lógico e atualidades com mais frequência que outras bancas. Nível geralmente mais alto para cargos de nível superior.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">VUNESP</h2>
        <p>Forte em língua portuguesa e interpretação de texto. Questões bem estruturadas, menor número de pegadinhas. Cobram legislação específica do órgão com mais detalhe.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">IBFC</h2>
        <p>Questões objetivas e diretas. Boa opção para quem está começando — o nível médio é mais acessível. Cobra bastante conhecimentos gerais e atualidades.</p>
      </div>
    ),
  },
  'como-ler-edital': {
    categoria: 'Estratégia',
    titulo: 'Como ler um edital de concurso público sem se perder',
    resumo: 'Os editais têm dezenas de páginas. Saiba o que realmente importa, o que ignorar e quais datas nunca podem passar em branco.',
    tempo: '6 min',
    conteudo: (
      <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
        <p>Um edital pode ter 60 páginas e parecer intimidador, mas a maioria do conteúdo é boilerplate jurídico que se repete em todos os concursos. Saber o que ler com atenção poupa horas.</p>
        <h2 className="text-base font-semibold text-slate-900 mt-8">O que ler com atenção máxima</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="font-medium">Datas:</strong> inscrição, prova, resultado. Anote no calendário imediatamente.</li>
          <li><strong className="font-medium">Requisitos:</strong> escolaridade, idade, experiência. Confirme que você se enquadra antes de estudar.</li>
          <li><strong className="font-medium">Conteúdo programático:</strong> é o que vai cair na prova. Guarde e use como base do cronograma.</li>
          <li><strong className="font-medium">Critérios de desempate:</strong> útil para decidir se vale a pena quando a concorrência é alta.</li>
        </ul>
        <h2 className="text-base font-semibold text-slate-900 mt-8">O que pode ler por alto</h2>
        <p>Regras de isenção de taxa (se não for pedir), procedimentos de recurso, detalhes de documentação para posse. Importante, mas só depois de passar.</p>
      </div>
    ),
  },
}

// Para slugs sem conteúdo ainda, mostra página placeholder
function ArtigoEmBreve({ titulo, resumo }: { titulo: string; resumo: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Artigo em breve</h2>
      <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">{resumo}</p>
    </div>
  )
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const artigo = ARTIGOS[slug]
  if (!artigo) return { title: 'Artigo não encontrado' }
  return {
    title: `${artigo.titulo} — ConcursoTrack`,
    description: artigo.resumo,
  }
}

export default async function ArtigoPage({ params }: Props) {
  const { slug } = await params
  const artigo = ARTIGOS[slug]

  // Slug totalmente desconhecido → 404
  const slugsConhecidos = [
    'como-estudar-para-concursos',
    'guia-bancas-organizadoras',
    'como-ler-edital',
    'areas-concursos-mais-vagas',
    'tecnicas-memorizar-conteudo',
    'gestao-tempo-prova',
  ]
  if (!slugsConhecidos.includes(slug)) notFound()

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-400 mb-8">
        <Link href="/" className="hover:text-blue-600 transition">Home</Link>
        <span>/</span>
        <Link href="/dicas" className="hover:text-blue-600 transition">Dicas</Link>
        <span>/</span>
        <span className="text-slate-600">{artigo?.categoria ?? 'Artigo'}</span>
      </nav>

      {artigo ? (
        <>
          {/* Cabeçalho */}
          <header className="mb-10">
            <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full mb-4">
              {artigo.categoria}
            </span>
            <h1 className="text-2xl font-semibold text-slate-900 mb-4 leading-snug">
              {artigo.titulo}
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">{artigo.resumo}</p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{artigo.tempo} de leitura</span>
              <span>·</span>
              <span>ConcursoTrack</span>
            </div>
          </header>

          {/* Conteúdo */}
          <article>{artigo.conteudo}</article>

          {/* CTA final */}
          <div className="mt-12 bg-slate-50 rounded-xl border border-slate-100 p-6">
            <p className="text-sm font-semibold text-slate-900 mb-1">
              Pratique com simulados gratuitos
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Treine com questões reais das bancas e acompanhe sua evolução por matéria.
            </p>
            <div className="flex gap-3">
              <Link href="/busca" className="text-xs px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                Ver concursos
              </Link>
              <Link href="/dicas" className="text-xs px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-white transition">
                Mais dicas
              </Link>
            </div>
          </div>
        </>
      ) : (
        <ArtigoEmBreve titulo={slug} resumo="Este artigo está sendo preparado e estará disponível em breve." />
      )}
    </div>
  )
}

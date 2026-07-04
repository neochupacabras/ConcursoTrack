import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Sobre o ConcursoTrack',
  description: 'Conheça o ConcursoTrack — a plataforma de concursos públicos feita para candidatos brasileiros.',
}

export default function SobrePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">

      {/* Hero */}
      <div className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity=".7"/>
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity=".7"/>
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity=".5"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Sobre o ConcursoTrack</h1>
        </div>
        <p className="text-slate-600 text-lg leading-relaxed">
          O ConcursoTrack nasceu de uma frustração simples: encontrar informações confiáveis
          sobre concursos públicos no Brasil é mais difícil do que deveria ser.
        </p>
      </div>

      {/* Missão */}
      <section className="mb-12">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Nossa missão</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          Centralizar editais, provas anteriores e simulados em um único lugar — com dados
          atualizados diariamente e ferramentas que ajudam candidatos a se preparar melhor
          e não perder prazos.
        </p>
        <p className="text-slate-600 text-sm leading-relaxed">
          Acreditamos que informação de qualidade sobre concursos públicos deve ser acessível
          a todos, independente de poder pagar por cursinhos ou materiais caros.
          Por isso, o núcleo da plataforma é e sempre será gratuito.
        </p>
      </section>

      {/* Números */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
        {[
          { numero: '460+',  label: 'Editais monitorados' },
          { numero: '2×',    label: 'Atualizações por dia' },
          { numero: '100%',  label: 'Gratuito no essencial' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
            <p className="text-2xl font-bold text-blue-600 mb-1">{s.numero}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Como funciona */}
      <section className="mb-12">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Como funciona</h2>
        <div className="space-y-4">
          {[
            {
              n: '01',
              titulo: 'Coleta automática',
              desc: 'Um scraper roda duas vezes por dia coletando editais de fontes públicas e sites especializados em concursos, normalizando os dados em um banco estruturado.',
            },
            {
              n: '02',
              titulo: 'Alertas inteligentes',
              desc: 'Você configura uma vez — área, estado, esfera — e recebe um e-mail assim que um edital correspondente é publicado. Sem precisar monitorar vários sites.',
            },
            {
              n: '03',
              titulo: 'Simulados com provas reais',
              desc: 'O banco de questões é formado por provas anteriores dos próprios concursos, organizadas por banca e matéria para um treino direcionado.',
            },
          ].map((item) => (
            <div key={item.n} className="flex gap-4 p-5 rounded-xl border border-slate-100 bg-white">
              <span className="text-2xl font-bold text-slate-200 flex-shrink-0 leading-none">{item.n}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">{item.titulo}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stack / transparência */}
      <section className="mb-12">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Tecnologia</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          O ConcursoTrack é construído com Next.js, Supabase e Vercel — stack moderna,
          escalável e de baixo custo operacional, o que nos permite manter o plano gratuito
          sustentável a longo prazo.
        </p>
        <p className="text-slate-600 text-sm leading-relaxed">
          Os pagamentos são processados pelo Stripe com segurança bancária.
          Nunca armazenamos dados de cartão.
        </p>
      </section>

      {/* CTA */}
      <div className="bg-blue-50 rounded-2xl p-8 text-center border border-blue-100">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Pronto para começar?
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          Crie uma conta gratuita e configure seus primeiros alertas em menos de 2 minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/cadastro"
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/busca"
            className="px-6 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
          >
            Ver concursos abertos
          </Link>
        </div>
      </div>

      {/* Links úteis */}
      <div className="mt-8 flex flex-wrap gap-4 text-xs text-slate-400 justify-center">
        <Link href="/termos" className="hover:text-blue-600 transition">Termos de uso</Link>
        <Link href="/privacidade" className="hover:text-blue-600 transition">Privacidade</Link>
        <Link href="/contato" className="hover:text-blue-600 transition">Contato</Link>
        <Link href="/plano" className="hover:text-blue-600 transition">Planos</Link>
      </div>
    </div>
  )
}

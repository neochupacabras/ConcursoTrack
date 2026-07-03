import { createClient } from '@/lib/supabase/server'
import { PLANOS } from '@/lib/stripe'
import { PlanoToggle } from '@/components/plano/PlanoToggle'
import { GerenciarAssinatura } from '@/components/plano/GerenciarAssinatura'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planos — ConcursoTrack Pro',
  description:
    'Assine o ConcursoTrack Pro e acesse simulados ilimitados, questões comentadas e plano de estudos personalizado.',
}

export default async function PlanoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  let assinatura = null

  if (user) {
    const [p, a] = await Promise.all([
      supabase
        .from('profiles')
        .select('plano, plano_expira_em, stripe_customer_id')
        .eq('id', user.id)
        .single(),
      supabase
        .from('assinaturas')
        .select('status, plano, periodo_fim, stripe_subscription_id')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    profile    = p.data
    assinatura = a.data
  }

  const isPro = profile?.plano === 'pro' &&
    (!profile?.plano_expira_em || new Date(profile.plano_expira_em) > new Date())

  return (
    <div className="max-w-5xl mx-auto px-4 py-14">

      {/* Hero */}
      <div className="text-center mb-12">
        <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full mb-4">
          7 dias grátis — cancele quando quiser
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
          Escolha seu plano
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          O plano gratuito cobre o básico. O Pro dá acesso a tudo que você precisa
          para se preparar de verdade.
        </p>
      </div>

      {/* Se já é Pro: painel de gerenciamento */}
      {isPro && assinatura ? (
        <GerenciarAssinatura
          assinatura={assinatura}
          planoExpiraEm={profile?.plano_expira_em ?? null}
        />
      ) : (
        <PlanoToggle estaLogado={!!user} />
      )}

      {/* Comparativo detalhado */}
      <section className="mt-20">
        <h2 className="text-xl font-semibold text-slate-900 text-center mb-8">
          Comparativo completo
        </h2>
        <ComparativoTabela />
      </section>

      {/* FAQ */}
      <section className="mt-16 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold text-slate-900 text-center mb-8">
          Perguntas frequentes
        </h2>
        <FAQList />
      </section>
    </div>
  )
}

function ComparativoTabela() {
  const linhas = [
    { feature: 'Editais e busca de concursos',      free: true,  pro: true  },
    { feature: 'Alertas de novos editais por e-mail', free: true, pro: true },
    { feature: 'Banco de provas anteriores (PDFs)',  free: true,  pro: true  },
    { feature: 'Calendário de provas',              free: true,  pro: true  },
    { feature: 'Simulados',                         free: '10 questões', pro: 'até 40 questões' },
    { feature: 'Questões premium',                  free: false, pro: true  },
    { feature: 'Gabarito comentado',                free: false, pro: true  },
    { feature: 'Plano de estudos personalizado',    free: false, pro: true  },
    { feature: 'Comparador de editais',             free: false, pro: true  },
    { feature: 'Desempenho por matéria',            free: false, pro: true  },
    { feature: 'Alertas instantâneos (push)',       free: false, pro: true  },
    { feature: 'Suporte prioritário',               free: false, pro: true  },
  ]

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      {/* Cabeçalho */}
      <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100">
        <div className="px-5 py-4 text-sm font-semibold text-slate-600">Funcionalidade</div>
        <div className="px-5 py-4 text-sm font-semibold text-slate-600 text-center">Gratuito</div>
        <div className="px-5 py-4 text-sm font-semibold text-blue-700 text-center bg-blue-50">Pro</div>
      </div>

      {linhas.map((l, i) => (
        <div
          key={l.feature}
          className={`grid grid-cols-3 border-b border-slate-50 last:border-0 ${
            i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
          }`}
        >
          <div className="px-5 py-3.5 text-sm text-slate-700">{l.feature}</div>
          <div className="px-5 py-3.5 text-center">
            <CelulaValor valor={l.free} />
          </div>
          <div className="px-5 py-3.5 text-center bg-blue-50/30">
            <CelulaValor valor={l.pro} pro />
          </div>
        </div>
      ))}
    </div>
  )
}

function CelulaValor({ valor, pro = false }: { valor: boolean | string; pro?: boolean }) {
  if (typeof valor === 'string') {
    return (
      <span className={`text-xs font-medium ${pro ? 'text-blue-700' : 'text-slate-600'}`}>
        {valor}
      </span>
    )
  }
  if (valor) {
    return (
      <svg
        className={`w-4 h-4 mx-auto ${pro ? 'text-blue-600' : 'text-green-500'}`}
        viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round"
      >
        <path d="M3 8.5l3.5 3.5 6.5-7"/>
      </svg>
    )
  }
  return <span className="text-slate-300 text-sm">—</span>
}

const FAQ_ITEMS = [
  {
    q: 'Posso cancelar a qualquer momento?',
    r: 'Sim. Você cancela pelo portal de assinatura, sem burocracia. O acesso Pro continua até o fim do período já pago.',
  },
  {
    q: 'O período de trial é cobrado?',
    r: 'Não. Os 7 dias de trial são completamente gratuitos. Só cobramos se você não cancelar antes do fim do trial.',
  },
  {
    q: 'Como funciona o plano anual?',
    r: 'O valor de R$ 239 é cobrado uma única vez por ano, equivalente a R$ 19,90/mês — uma economia de 33% frente ao mensal.',
  },
  {
    q: 'Posso trocar de plano mensal para anual?',
    r: 'Sim, a qualquer momento. O valor pago no mensal é abatido proporcionalmente no anual.',
  },
  {
    q: 'Os dados do cartão ficam armazenados no ConcursoTrack?',
    r: 'Não. O processamento de pagamentos é feito inteiramente pelo Stripe, líder mundial em segurança de pagamentos. Não temos acesso ao seu número de cartão.',
  },
  {
    q: 'Como funciona o gabarito comentado?',
    r: 'Cada questão premium tem uma explicação detalhada escrita por especialistas, mostrando por que cada alternativa está certa ou errada.',
  },
]

function FAQList() {
  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item) => (
        <details
          key={item.q}
          className="group rounded-xl border border-slate-100 bg-white overflow-hidden"
        >
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
            <span className="text-sm font-medium text-slate-800">{item.q}</span>
            <svg
              className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180"
              viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round"
            >
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </summary>
          <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-3">
            {item.r}
          </div>
        </details>
      ))}
    </div>
  )
}

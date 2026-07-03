import Stripe from 'stripe'

// Instância singleton do Stripe — reutilizada em todas as API routes
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})

// IDs dos preços — lidos das env vars em runtime
export const PRICES = {
  mensal: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MENSAL!,
  anual:  process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANUAL!,
} as const

export type BillingInterval = keyof typeof PRICES

// Valores exibidos na UI (sincronizados com o que está no Stripe Dashboard)
export const PLANOS = {
  free: {
    nome:      'Gratuito',
    preco:     0,
    intervalo: null as null,
    features: [
      'Todos os editais abertos',
      'Alertas de novos concursos por e-mail',
      'Simulados com até 10 questões',
      'Banco de provas anteriores (PDFs)',
      'Calendário de provas',
    ],
    limitacoes: [
      'Questões premium bloqueadas',
      'Sem gabarito comentado',
      'Plano de estudos indisponível',
    ],
  },
  pro: {
    nome:      'Pro',
    mensal:    29.90,
    anual:     239.00,           // equivale a R$ 19,90/mês
    por_mes_anual: 19.90,
    features: [
      'Tudo do plano Gratuito',
      'Simulados com até 40 questões',
      'Questões premium com gabarito comentado',
      'Plano de estudos gerado pelo edital',
      'Comparador de editais lado a lado',
      'Alertas instantâneos (push + e-mail)',
      'Desempenho por matéria e histórico completo',
      'Suporte prioritário',
    ],
    limitacoes: [],
  },
} as const

/**
 * Cria ou recupera o customer Stripe para o usuário.
 * Persiste o stripe_customer_id no perfil para reutilização.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  nome: string | null,
  supabase: ReturnType<typeof import('./supabase/server').createServiceClient>
): Promise<string> {
  // Verifica se já tem customer_id salvo
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id
  }

  // Cria novo customer no Stripe
  const customer = await stripe.customers.create({
    email,
    name:     nome ?? undefined,
    metadata: { supabase_user_id: userId },
  })

  // Salva no perfil
  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  return customer.id
}

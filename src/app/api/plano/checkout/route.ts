import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe, PRICES, getOrCreateStripeCustomer } from '@/lib/stripe'
import type { BillingInterval } from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { intervalo } = await request.json() as { intervalo: BillingInterval }

  if (!PRICES[intervalo]) {
    return NextResponse.json({ error: 'Intervalo inválido' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('nome, email, stripe_customer_id, plano')
    .eq('id', user.id)
    .single()

  // Já é Pro — não deve chegar aqui, mas defende
  if (profile?.plano === 'pro') {
    return NextResponse.json({ error: 'Já é assinante Pro' }, { status: 400 })
  }

  const customerId = await getOrCreateStripeCustomer(
    user.id,
    profile?.email ?? user.email!,
    profile?.nome ?? null,
    serviceClient
  )

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'subscription',
    line_items: [{ price: PRICES[intervalo], quantity: 1 }],
    success_url: `${appUrl}/plano/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/plano`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
      trial_period_days: 7,           // trial de 7 dias grátis
    },
    metadata: { supabase_user_id: user.id, intervalo },
    locale: 'pt-BR',
  })

  return NextResponse.json({ url: session.url })
}

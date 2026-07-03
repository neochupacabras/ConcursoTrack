import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

// Necessário para ler o body como raw buffer (validação de assinatura)
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] Assinatura inválida:', err)
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {

      // ── Assinatura criada ou atualizada ─────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const isAtivo    = sub.status === 'active' || sub.status === 'trialing'

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!profile) {
          console.warn('[webhook] Profile não encontrado para customer:', customerId)
          break
        }

        await supabase.from('profiles').update({
          plano:           isAtivo ? 'pro' : 'free',
          plano_expira_em: isAtivo
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        }).eq('id', profile.id)

        await supabase.from('assinaturas').upsert({
          user_id:                profile.id,
          stripe_subscription_id: sub.id,
          status:                 sub.status,
          plano:                  'pro',
          periodo_inicio: new Date(sub.current_period_start * 1000).toISOString(),
          periodo_fim:    new Date(sub.current_period_end   * 1000).toISOString(),
        }, { onConflict: 'stripe_subscription_id' })

        console.log(`[webhook] ${event.type} → user ${profile.id}, status: ${sub.status}`)
        break
      }

      // ── Assinatura cancelada ─────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        await supabase
          .from('profiles')
          .update({ plano: 'free', plano_expira_em: null })
          .eq('stripe_customer_id', customerId)

        await supabase
          .from('assinaturas')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id)

        console.log('[webhook] subscription.deleted → customer:', customerId)
        break
      }

      // ── Pagamento falhou ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Marca como past_due mas não remove o plano ainda
        // O Stripe tentará novamente; se o limite de retries passar,
        // dispara subscription.deleted ou subscription.updated com status past_due
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase.from('assinaturas').update({ status: 'past_due' })
            .eq('user_id', profile.id)
            .eq('status', 'active')

          // Enfileira notificação de cobrança falhou
          const { data: subData } = await supabase
            .from('assinaturas')
            .select('id')
            .eq('user_id', profile.id)
            .single()

          if (subData) {
            await supabase.from('notificacoes_fila').insert({
              user_id:     profile.id,
              concurso_id: null, // notificação de sistema, não de concurso
              canal:       'email',
              enviado:     false,
              // tipo poderia ser adicionado ao schema futuramente
            }).catch(() => null) // falha silenciosa se concurso_id for NOT NULL
          }
        }

        console.log('[webhook] invoice.payment_failed → customer:', customerId)
        break
      }

      // ── Checkout concluído ───────────────────────────────────────────
      case 'checkout.session.completed': {
        // A subscription já foi criada; o evento subscription.created
        // cuidou de ativar o plano. Aqui apenas logamos.
        const session = event.data.object as Stripe.Checkout.Session
        console.log('[webhook] checkout.session.completed → session:', session.id)
        break
      }

      default:
        console.log('[webhook] Evento não tratado:', event.type)
    }
  } catch (err) {
    console.error('[webhook] Erro ao processar evento:', event.type, err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

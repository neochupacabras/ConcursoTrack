import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// E-mail pessoal para onde os e-mails serão encaminhados
const SEU_EMAIL = process.env.EMAIL_PESSOAL!

// Mapeamento de aliases → destinatário e assunto prefixado
const ALIASES: Record<string, { label: string; para: string }> = {
  'contato':     { label: '[Contato]',     para: SEU_EMAIL },
  'privacidade': { label: '[Privacidade]', para: SEU_EMAIL },
  'noreply':     { label: '[NoReply]',     para: SEU_EMAIL },
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    /*
      Payload do Resend Inbound:
      {
        from: "fulano@gmail.com",
        to: ["contato@concursotrack.com.br"],
        subject: "Dúvida sobre edital",
        text: "...",
        html: "...",
        headers: {...}
      }
    */

    const { from, to, subject, text, html } = payload

    if (!from || !to || !subject) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    // Descobre qual alias recebeu (contato, privacidade, noreply)
    const toAddress: string = Array.isArray(to) ? to[0] : to
    const alias = toAddress.split('@')[0].toLowerCase()
    const config = ALIASES[alias] ?? { label: `[${alias}]`, para: SEU_EMAIL }

    // Encaminha para o e-mail pessoal preservando o remetente original
    await resend.emails.send({
      from:     'ConcursoTrack <noreply@concursotrack.com.br>',
      to:       config.para,
      subject:  `${config.label} ${subject}`,
      replyTo:  from,
      html: html ?? undefined,
      text: text
        ? `--- Encaminhado de ${from} para ${toAddress} ---\n\n${text}`
        : undefined,
    })

    console.log(`[inbound] ${from} → ${toAddress} | "${subject}" → encaminhado para ${config.para}`)
    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[inbound] Erro ao processar e-mail:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

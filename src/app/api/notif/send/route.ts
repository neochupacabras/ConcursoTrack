import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getNotificacoesPendentes, marcarNotificacoesEnviadas } from '@/lib/queries'
import { NovoEditalEmail } from '@/components/emails/NovoEditalEmail'

const resend = new Resend(process.env.RESEND_API_KEY)
const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function POST(request: Request) {
  const auth = request.headers.get('x-cron-secret')
  if (CRON_SECRET && auth !== CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const pendentes = await getNotificacoesPendentes(50)

  if (pendentes.length === 0) {
    return NextResponse.json({ enviados: 0, mensagem: 'Nenhuma notificação pendente.' })
  }

  const enviados: string[] = []
  const falhas:   string[] = []

  for (const notif of pendentes) {
    const profile  = notif.profiles  as { email: string; nome: string | null } | null
    const concurso = notif.concursos as {
      titulo: string; orgao: string; slug: string
      data_encerramento: string | null; total_vagas: number; area_conhecimento: string | null
    } | null

    if (!profile?.email || !concurso) {
      enviados.push(notif.id)
      continue
    }

    try {
      await resend.emails.send({
        from:    process.env.RESEND_FROM ?? 'ConcursoTrack <noreply@concursotrack.com.br>',
        to:      profile.email,
        subject: `Novo edital: ${concurso.orgao} — ${concurso.total_vagas} vagas`,
        react:   NovoEditalEmail({
          nomeUsuario:      profile.nome,
          orgao:            concurso.orgao,
          titulo:           concurso.titulo,
          totalVagas:       concurso.total_vagas,
          dataEncerramento: concurso.data_encerramento,
          area:             concurso.area_conhecimento,
          urlEdital:  `${process.env.NEXT_PUBLIC_APP_URL}/concursos/${concurso.slug}`,
          urlAlertas: `${process.env.NEXT_PUBLIC_APP_URL}/alertas`,
        }),
      })
      enviados.push(notif.id)
    } catch (err) {
      console.error(`[notif] Falha ao enviar para ${profile.email}:`, err)
      falhas.push(notif.id)
    }
  }

  if (enviados.length > 0) await marcarNotificacoesEnviadas(enviados)

  return NextResponse.json({ enviados: enviados.length, falhas: falhas.length, total: pendentes.length })
}

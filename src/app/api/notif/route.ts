// Rota raiz de notif — redireciona para /api/notif/send
import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/notif/send' })
}

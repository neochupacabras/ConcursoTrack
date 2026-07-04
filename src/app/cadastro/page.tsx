import type { Metadata } from 'next'
import { CadastroForm } from '@/components/auth/CadastroForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Criar conta — ConcursoTrack',
  description: 'Crie sua conta gratuita e receba alertas de novos editais.',
}

interface Props {
  searchParams: Promise<{ next?: string }>
}

export default async function CadastroPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { next } = await searchParams

  if (user) redirect(next ?? '/dashboard')

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white"/>
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity=".7"/>
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity=".7"/>
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity=".5"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Criar conta grátis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Alertas de editais, simulados e muito mais
          </p>
        </div>

        <CadastroForm next={next} />

        <p className="text-center text-xs text-slate-400 mt-6">
          Já tem conta?{' '}
          <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
             className="text-blue-600 hover:underline font-medium">
            Entrar
          </a>
        </p>
      </div>
    </div>
  )
}

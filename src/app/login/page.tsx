import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Entrar — ConcursoTrack',
  description: 'Acesse sua conta para gerenciar alertas e simulados.',
}

interface Props {
  searchParams: Promise<{ next?: string; erro?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { next, erro } = await searchParams

  // Já está logado — redireciona
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
          <h1 className="text-xl font-semibold text-slate-900">Entrar no ConcursoTrack</h1>
          <p className="text-slate-500 text-sm mt-1">
            Sem senha — enviaremos um link para seu e-mail
          </p>
        </div>

        <LoginForm next={next} erroInicial={erro} />

        <p className="text-center text-xs text-slate-400 mt-6">
          Não tem conta?{' '}
          <a href={`/cadastro${next ? `?next=${encodeURIComponent(next)}` : ''}`}
             className="text-blue-600 hover:underline font-medium">
            Criar conta grátis
          </a>
        </p>
      </div>
    </div>
  )
}

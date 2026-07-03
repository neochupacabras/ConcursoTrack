'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/browser'

interface Props {
  concursoId: string
  area: string | null
}

type Estado = 'idle' | 'loading' | 'ativo' | 'removido' | 'sem_login'

export function BotaoAlerta({ concursoId, area }: Props) {
  const router   = useRouter()
  const supabase = getSupabaseBrowser()

  const [estado, setEstado]     = useState<Estado>('loading')
  const [alertaId, setAlertaId] = useState<string | null>(null)

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setEstado('sem_login')
        return
      }

      // Verifica se já existe alerta para esta área
      const { data } = await supabase
        .from('alertas')
        .select('id')
        .eq('user_id', user.id)
        .eq('area_conhecimento', area)
        .eq('ativo', true)
        .maybeSingle()

      if (data) {
        setAlertaId(data.id)
        setEstado('ativo')
      } else {
        setEstado('idle')
      }
    }

    verificar()
  }, [supabase, area])

  async function ativar() {
    setEstado('loading')
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setEstado('sem_login')
      return
    }

    const { data, error } = await supabase
      .from('alertas')
      .insert({
        user_id:           user.id,
        area_conhecimento: area,
        canal:             'email',
        ativo:             true,
      })
      .select('id')
      .single()

    if (!error && data) {
      setAlertaId(data.id)
      setEstado('ativo')
    } else {
      setEstado('idle')
    }
  }

  async function desativar() {
    if (!alertaId) return
    setEstado('loading')

    await supabase
      .from('alertas')
      .update({ ativo: false })
      .eq('id', alertaId)

    setAlertaId(null)
    setEstado('removido')

    // Volta ao idle após 2s para dar feedback visual
    setTimeout(() => setEstado('idle'), 2000)
  }

  if (estado === 'loading') {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-400 text-sm font-medium rounded-lg opacity-70"
      >
        <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
        Verificando...
      </button>
    )
  }

  if (estado === 'sem_login') {
    return (
      <button
        onClick={() => router.push(`/login?next=/concursos/${concursoId}`)}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5a3 3 0 100 6 3 3 0 000-6zM3 11.5a5 5 0 0110 0" strokeLinecap="round"/>
        </svg>
        Entrar para ativar alerta
      </button>
    )
  }

  if (estado === 'ativo') {
    return (
      <button
        onClick={desativar}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition group"
        title="Clique para remover o alerta"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6v1L2 9.5h12L12.5 7V6c0-2.5-2-4.5-4.5-4.5zM6 11.5a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="group-hover:hidden">Alerta ativo</span>
        <span className="hidden group-hover:inline">Remover alerta</span>
      </button>
    )
  }

  if (estado === 'removido') {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-500 text-sm font-medium rounded-lg"
      >
        <svg className="w-4 h-4 text-green-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 8.5l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Alerta removido
      </button>
    )
  }

  // idle
  return (
    <button
      onClick={ativar}
      className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition"
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6v1L2 9.5h12L12.5 7V6c0-2.5-2-4.5-4.5-4.5zM6 11.5a2 2 0 004 0" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Ativar alerta para esta área
    </button>
  )
}

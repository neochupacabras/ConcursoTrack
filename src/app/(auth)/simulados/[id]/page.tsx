import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlayerSimulado } from '@/components/simulados/PlayerSimulado'
import type { Metadata } from 'next'
import type { Questao, RespostaSimulado } from '@/types'

export const metadata: Metadata = { title: 'Simulado em andamento' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function SimuladoPlayerPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id: simuladoId } = await params

  // Busca o simulado
  const { data: simulado } = await supabase
    .from('simulados')
    .select('*, concursos(titulo, orgao)')
    .eq('id', simuladoId)
    .eq('user_id', user.id)
    .single()

  if (!simulado) notFound()

  // Se já concluído, redireciona para resultado
  if (simulado.concluido) {
    redirect(`/simulados/${simuladoId}/resultado`)
  }

  // Carrega respostas com questões na ordem de inserção
  const { data: respostas } = await supabase
    .from('respostas_simulado')
    .select('*, questoes(*)')
    .eq('simulado_id', simuladoId)
    .order('criado_em', { referencedTable: 'questoes', ascending: true })

  if (!respostas || respostas.length === 0) notFound()

  const itens = respostas.map((r) => ({
    questao:  r.questoes as Questao,
    resposta: {
      id:               r.id,
      simulado_id:      r.simulado_id,
      questao_id:       r.questao_id,
      resposta_usuario: r.resposta_usuario,
      correta:          r.correta,
    } as RespostaSimulado,
  }))

  const concurso = simulado.concursos as { titulo: string; orgao: string } | null

  return (
    <div>
      {/* Header contextual */}
      <div className="border-b border-slate-100 bg-white sticky top-14 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-0.5">Simulado</p>
            <p className="text-sm font-medium text-slate-800 truncate">
              {concurso?.orgao ?? ''} {concurso?.titulo ? `— ${concurso.titulo}` : ''}
            </p>
          </div>
          <a
            href="/simulados"
            className="flex-shrink-0 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
          >
            Sair do simulado
          </a>
        </div>
      </div>

      <PlayerSimulado
        simuladoId={simuladoId}
        itens={itens}
        jaConcluido={false}
      />
    </div>
  )
}

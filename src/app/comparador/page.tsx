import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { ComparadorClient } from '@/components/comparador/ComparadorClient'

export const metadata: Metadata = {
  title: 'Comparador de editais — ConcursoTrack',
  description: 'Compare remuneração, vagas, requisitos e datas de até 4 concursos públicos lado a lado.',
}

export default async function ComparadorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const sp = await searchParams
  const idsParam = sp.ids?.split(',').filter(Boolean) ?? []

  // Lista de concursos abertos para o seletor
  const { data: concursos } = await supabase
    .from('concursos')
    .select('id, titulo, orgao, esfera, estado, total_vagas, data_encerramento')
    .eq('status', 'aberto')
    .order('data_encerramento', { ascending: true })
    .limit(300)

  // Se veio com IDs na URL, busca os concursos completos
  let selecionados: Record<string, unknown>[] = []
  if (idsParam.length >= 2) {
    const { data } = await supabase
      .from('concursos')
      .select(`
        id, slug, titulo, orgao, esfera, estado,
        area_conhecimento, status, total_vagas,
        data_abertura, data_encerramento, data_prova,
        edital_url, fonte_url,
        bancas ( nome, sigla ),
        cargos ( titulo, escolaridade, vagas, salario_inicial, salario_final, localidade )
      `)
      .in('id', idsParam.slice(0, 4))
    selecionados = (data ?? []) as Record<string, unknown>[]
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Comparador de editais</h1>
        <p className="text-slate-500 text-sm">
          Selecione de 2 a 4 concursos para comparar vagas, remuneração e requisitos lado a lado.
        </p>
      </div>

      <ComparadorClient
        todosOsConcursos={concursos ?? []}
        selecionadosIniciais={selecionados}
        idsIniciais={idsParam}
      />
    </div>
  )
}

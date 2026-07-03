import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    return format(parseISO(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function diasRestantes(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

export function formatSalario(valor: number | null): string {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function areaLabel(area: string | null): string {
  const labels: Record<string, string> = {
    fiscal_tributaria:  'Fiscal / Tributária',
    seguranca_publica:  'Segurança Pública',
    saude:              'Saúde',
    educacao:           'Educação',
    administrativa:     'Administrativa',
    tecnologia:         'Tecnologia',
    engenharia:         'Engenharia',
    juridica:           'Jurídica',
  }
  return area ? (labels[area] ?? area) : 'Geral'
}

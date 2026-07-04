import type { Metadata } from 'next'
import { PlanoEmBreve } from '@/components/plano/PlanoEmBreve'

export const metadata: Metadata = {
  title: 'Planos — ConcursoTrack',
  description: 'O plano Pro do ConcursoTrack está chegando. Deixe seu e-mail para ser o primeiro a saber.',
}

export default function PlanoPage() {
  return <PlanoEmBreve />
}

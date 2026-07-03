import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'ConcursoTrack — Concursos Públicos do Brasil',
    template: '%s | ConcursoTrack',
  },
  description:
    'Encontre editais abertos, simule provas e receba alertas de novos concursos públicos em todo o Brasil.',
  keywords: ['concurso público', 'editais', 'simulado', 'CEBRASPE', 'FGV', 'IBGE', 'INSS'],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://concursotrack.com.br',
    siteName: 'ConcursoTrack',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}

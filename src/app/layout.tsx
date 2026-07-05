import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default:  'ConcursoTrack — Concursos Públicos do Brasil',
    template: '%s | ConcursoTrack',
  },
  description:
    'Encontre editais abertos, simule provas e receba alertas de novos concursos públicos em todo o Brasil. Gratuito.',
  keywords: [
    'concurso público', 'editais abertos', 'simulado concurso', 'CEBRASPE',
    'FGV', 'VUNESP', 'IBGE', 'INSS', 'concursos 2026', 'alertas concurso',
  ],
  authors: [{ name: 'ConcursoTrack' }],
  creator: 'ConcursoTrack',
  metadataBase: new URL('https://concursotrack.com.br'),
  openGraph: {
    type:      'website',
    locale:    'pt_BR',
    url:       'https://concursotrack.com.br',
    siteName:  'ConcursoTrack',
    title:     'ConcursoTrack — Concursos Públicos do Brasil',
    description: 'Editais abertos, simulados gratuitos e alertas de novos concursos públicos.',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'ConcursoTrack — Concursos Públicos do Brasil',
    description: 'Editais abertos, simulados gratuitos e alertas de novos concursos públicos.',
  },
  robots: {
    index:  true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  verification: {
    // Adicione aqui o código do Google Search Console após verificar
    // google: 'SEU_CODIGO_AQUI',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  )
}

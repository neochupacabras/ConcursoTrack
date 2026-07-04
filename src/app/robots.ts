import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/simulados',
          '/alertas',
          '/plano/sucesso',
          '/admin',
          '/api/',
        ],
      },
    ],
    sitemap: 'https://concursotrack.com.br/sitemap.xml',
  }
}

import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const BASE = 'https://concursotrack.com.br'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE,               lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/busca`,    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/plano`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/dicas`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/sobre`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/contato`,  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/termos`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
    { url: `${BASE}/privacidade`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.2 },
  ]

  // Páginas dinâmicas de concursos
  try {
    const supabase = await createClient()
    const { data: concursos } = await supabase
      .from('concursos')
      .select('slug, scraped_em')
      .eq('status', 'aberto')
      .order('scraped_em', { ascending: false })
      .limit(500)

    const dinamicas: MetadataRoute.Sitemap = (concursos ?? []).map((c) => ({
      url:             `${BASE}/concursos/${c.slug}`,
      lastModified:    c.scraped_em ? new Date(c.scraped_em) : new Date(),
      changeFrequency: 'daily' as const,
      priority:        0.8,
    }))

    return [...estaticas, ...dinamicas]
  } catch {
    return estaticas
  }
}

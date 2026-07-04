import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'ConcursoTrack — Concursos Públicos do Brasil'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#f1f5f9',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Card central */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: '56px 72px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 900,
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div
              style={{
                width: 56,
                height: 56,
                background: '#2563eb',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', width: 28, height: 28, gap: 3 }}>
                {[1,1,0.7,0.5].map((op, i) => (
                  <div key={i} style={{ width: 11, height: 11, background: `rgba(255,255,255,${op})`, borderRadius: 2 }} />
                ))}
              </div>
            </div>
            <span style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', letterSpacing: -1 }}>
              ConcursoTrack
            </span>
          </div>

          {/* Headline */}
          <div style={{ fontSize: 52, fontWeight: 700, color: '#0f172a', textAlign: 'center', lineHeight: 1.15, marginBottom: 20, letterSpacing: -1.5 }}>
            Concursos Públicos do Brasil
          </div>

          {/* Subline */}
          <div style={{ fontSize: 24, color: '#64748b', textAlign: 'center', lineHeight: 1.5, marginBottom: 40 }}>
            Editais abertos, simulados gratuitos e alertas de novos concursos
          </div>

          {/* Pills */}
          <div style={{ display: 'flex', gap: 12 }}>
            {['461+ editais abertos', 'Alertas por e-mail', 'Simulados gratuitos'].map((t) => (
              <div key={t} style={{ background: '#eff6ff', borderRadius: 99, padding: '8px 20px', fontSize: 18, color: '#1d4ed8', fontWeight: 500 }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* URL */}
        <div style={{ marginTop: 28, fontSize: 20, color: '#94a3b8' }}>
          concursotrack.com.br
        </div>
      </div>
    ),
    { ...size }
  )
}

import * as React from 'react'

interface Props {
  nomeUsuario:      string | null
  orgao:            string
  titulo:           string
  totalVagas:       number
  dataEncerramento: string | null
  area:             string | null
  urlEdital:        string
  urlAlertas:       string
}

const AREA_LABELS: Record<string, string> = {
  fiscal_tributaria:  'Fiscal / Tributária',
  seguranca_publica:  'Segurança Pública',
  saude:              'Saúde',
  educacao:           'Educação',
  administrativa:     'Administrativa',
  tecnologia:         'Tecnologia',
  engenharia:         'Engenharia',
  juridica:           'Jurídica',
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function NovoEditalEmail({
  nomeUsuario,
  orgao,
  titulo,
  totalVagas,
  dataEncerramento,
  area,
  urlEdital,
  urlAlertas,
}: Props) {
  const areaLabel  = area ? (AREA_LABELS[area] ?? area) : null
  const prazo      = formatData(dataEncerramento)
  const saudacao   = nomeUsuario ? nomeUsuario.split(' ')[0] : 'candidato'

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Novo edital — {orgao}</title>
      </head>
      <body style={styles.body}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={styles.outer}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '32px 16px' }}>
                <table width="560" cellPadding={0} cellSpacing={0} style={styles.card}>
                  <tbody>

                    {/* Header */}
                    <tr>
                      <td style={styles.header}>
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td>
                                <span style={styles.logo}>ConcursoTrack</span>
                              </td>
                              <td align="right">
                                <span style={styles.headerBadge}>Novo edital</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* Conteúdo */}
                    <tr>
                      <td style={styles.body2}>

                        <p style={styles.saudacao}>
                          Olá, <strong>{saudacao}</strong>!
                        </p>
                        <p style={styles.intro}>
                          Saiu um novo edital que corresponde aos seus alertas
                          {areaLabel ? ` na área de <strong>${areaLabel}</strong>` : ''}.
                        </p>

                        {/* Card do concurso */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={styles.concursoCard}>
                          <tbody>
                            <tr>
                              <td style={{ padding: '20px 24px' }}>
                                {areaLabel && (
                                  <p style={styles.areaBadge}>{areaLabel}</p>
                                )}
                                <p style={styles.concursoOrgao}>{orgao}</p>
                                <p style={styles.concursoTitulo}>{titulo}</p>

                                <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: 16 }}>
                                  <tbody>
                                    <tr>
                                      <td style={styles.statBox}>
                                        <p style={styles.statLabel}>Vagas</p>
                                        <p style={styles.statValue}>{totalVagas.toLocaleString('pt-BR')}</p>
                                      </td>
                                      <td width="12" />
                                      <td style={styles.statBox}>
                                        <p style={styles.statLabel}>Inscrições até</p>
                                        <p style={{
                                          ...styles.statValue,
                                          color: dataEncerramento &&
                                            new Date(dataEncerramento).getTime() - Date.now() < 7 * 86400000
                                            ? '#dc2626' : '#0f172a',
                                        }}>
                                          {prazo}
                                        </p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* CTA principal */}
                        <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginTop: 24 }}>
                          <tbody>
                            <tr>
                              <td align="center">
                                <a href={urlEdital} style={styles.ctaPrimary}>
                                  Ver edital completo
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={styles.dicaTexto}>
                          Acesse o edital para conferir os cargos, requisitos e documentos necessários
                          antes de se inscrever.
                        </p>
                      </td>
                    </tr>

                    {/* Divider */}
                    <tr>
                      <td style={{ padding: '0 24px' }}>
                        <hr style={styles.divider} />
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={styles.footer}>
                        <p style={styles.footerText}>
                          Você recebe este e-mail porque configurou um alerta no ConcursoTrack.
                        </p>
                        <p style={styles.footerText}>
                          <a href={urlAlertas} style={styles.footerLink}>
                            Gerenciar meus alertas
                          </a>
                          {' · '}
                          <a href={`${urlAlertas}?cancelar=1`} style={styles.footerLink}>
                            Cancelar todos os alertas
                          </a>
                        </p>
                        <p style={{ ...styles.footerText, marginTop: 12, color: '#94a3b8' }}>
                          © {new Date().getFullYear()} ConcursoTrack. Dados de editais coletados automaticamente.
                          Sempre confira o edital oficial antes de se inscrever.
                        </p>
                      </td>
                    </tr>

                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: 0, padding: 0,
  },
  outer: { width: '100%', backgroundColor: '#f1f5f9' },
  card:  {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    maxWidth: 560,
    width: '100%',
  },
  header: {
    backgroundColor: '#1e40af',
    padding: '20px 24px',
  },
  logo: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '-0.3px',
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#bfdbfe',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 99,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  body2:       { padding: '28px 24px 0' },
  saudacao:    { fontSize: 16, color: '#0f172a', margin: '0 0 8px', lineHeight: 1.5 },
  intro:       { fontSize: 14, color: '#475569', margin: '0 0 20px', lineHeight: 1.6 },
  concursoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    width: '100%',
  },
  areaBadge: {
    display: 'inline-block',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 10px',
    borderRadius: 99,
    margin: '0 0 10px',
  },
  concursoOrgao:  { fontSize: 13, color: '#64748b', margin: '0 0 4px', fontWeight: 500 },
  concursoTitulo: { fontSize: 17, color: '#0f172a', margin: 0, fontWeight: 700, lineHeight: 1.3 },
  statBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    padding: '10px 14px',
    width: '48%',
  },
  statLabel: { fontSize: 11, color: '#94a3b8', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { fontSize: 15, color: '#0f172a', margin: 0, fontWeight: 700 },
  ctaPrimary: {
    display: 'inline-block',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 700,
    padding: '12px 32px',
    borderRadius: 10,
    textDecoration: 'none',
    letterSpacing: '-0.1px',
  },
  dicaTexto: { fontSize: 13, color: '#94a3b8', textAlign: 'center', margin: '16px 0 24px', lineHeight: 1.6 },
  divider:   { border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 },
  footer:    { padding: '20px 24px 24px', backgroundColor: '#f8fafc' },
  footerText: { fontSize: 12, color: '#64748b', margin: '0 0 6px', textAlign: 'center', lineHeight: 1.6 },
  footerLink: { color: '#3b82f6', textDecoration: 'none' },
}

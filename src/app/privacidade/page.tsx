import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de privacidade — ConcursoTrack',
  description: 'Saiba como o ConcursoTrack coleta, usa e protege seus dados pessoais.',
}

const ULTIMA_ATUALIZACAO = '4 de julho de 2026'

export default function PrivacidadePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Política de privacidade</h1>
        <p className="text-sm text-slate-400">Última atualização: {ULTIMA_ATUALIZACAO}</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-10 text-sm text-blue-800 leading-relaxed">
        Esta política descreve como o ConcursoTrack coleta, usa e protege seus dados pessoais,
        em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
      </div>

      <div>

        <Section titulo="1. Quem somos">
          <p>
            O ConcursoTrack é uma plataforma de informação sobre concursos públicos, operada
            por pessoa jurídica com sede no Brasil. Para dúvidas sobre privacidade, entre em
            contato pelo e-mail{' '}
            <a href="mailto:privacidade@concursotrack.com.br" className="text-blue-600 hover:underline">
              privacidade@concursotrack.com.br
            </a>.
          </p>
        </Section>

        <Section titulo="2. Dados que coletamos">
          <p>Coletamos os seguintes dados pessoais:</p>
          <Tabela linhas={[
            ['E-mail', 'Fornecido por você ao criar conta ou configurar alertas', 'Necessário para o serviço'],
            ['Nome', 'Fornecido opcionalmente no cadastro', 'Personalização'],
            ['Dados de uso', 'Páginas visitadas, buscas realizadas, simulados feitos', 'Melhoria do serviço'],
            ['Dados de pagamento', 'Processados diretamente pelo Stripe — não armazenamos número de cartão', 'Cobrança'],
            ['Endereço IP', 'Coletado automaticamente pelo servidor', 'Segurança e análise'],
          ]} />
        </Section>

        <Section titulo="3. Como usamos seus dados">
          <p>Seus dados são usados para:</p>
          <ul>
            <li>Autenticar seu acesso à plataforma</li>
            <li>Enviar alertas de novos editais que correspondam às suas preferências</li>
            <li>Processar pagamentos e gerenciar sua assinatura</li>
            <li>Melhorar a plataforma com base em padrões de uso agregados</li>
            <li>Cumprir obrigações legais e prevenir fraudes</li>
          </ul>
          <p>
            Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para
            fins de marketing.
          </p>
        </Section>

        <Section titulo="4. Base legal (LGPD)">
          <p>O tratamento dos seus dados se baseia nas seguintes hipóteses legais:</p>
          <ul>
            <li><strong className="font-medium">Execução de contrato</strong> — dados necessários para prestação do serviço (art. 7º, V)</li>
            <li><strong className="font-medium">Legítimo interesse</strong> — análise de uso para melhoria da plataforma (art. 7º, IX)</li>
            <li><strong className="font-medium">Cumprimento de obrigação legal</strong> — dados fiscais e de cobrança (art. 7º, II)</li>
            <li><strong className="font-medium">Consentimento</strong> — e-mails de marketing opcionais (art. 7º, I)</li>
          </ul>
        </Section>

        <Section titulo="5. Compartilhamento de dados">
          <p>Compartilhamos dados apenas com os seguintes parceiros, estritamente necessários ao serviço:</p>
          <ul>
            <li><strong className="font-medium">Supabase</strong> — banco de dados e autenticação (EUA, coberto por DPA)</li>
            <li><strong className="font-medium">Stripe</strong> — processamento de pagamentos (EUA, certificado PCI-DSS)</li>
            <li><strong className="font-medium">Resend</strong> — envio de e-mails transacionais (EUA, coberto por DPA)</li>
            <li><strong className="font-medium">Vercel</strong> — hospedagem da plataforma (EUA, coberto por DPA)</li>
          </ul>
        </Section>

        <Section titulo="6. Retenção de dados">
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta,
            os dados são anonimizados ou excluídos em até 90 dias, salvo obrigação legal de
            retenção por período maior (ex.: dados fiscais por 5 anos).
          </p>
        </Section>

        <Section titulo="7. Seus direitos (LGPD)">
          <p>Você tem direito a:</p>
          <ul>
            <li>Confirmar a existência de tratamento dos seus dados</li>
            <li>Acessar os dados que mantemos sobre você</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
            <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>Portabilidade dos seus dados para outro serviço</li>
          </ul>
          <p>
            Para exercer seus direitos, envie um e-mail para{' '}
            <a href="mailto:privacidade@concursotrack.com.br" className="text-blue-600 hover:underline">
              privacidade@concursotrack.com.br
            </a>{' '}
            ou use o{' '}
            <a href="/contato" className="text-blue-600 hover:underline">formulário de contato</a>.
            Respondemos em até 15 dias úteis.
          </p>
        </Section>

        <Section titulo="8. Cookies">
          <p>
            Usamos cookies essenciais para manter sua sessão autenticada. Não usamos cookies
            de rastreamento de terceiros para publicidade. Os cookies de sessão expiram quando
            você fecha o navegador ou ao fim da sessão autenticada.
          </p>
        </Section>

        <Section titulo="9. Segurança">
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
            criptografia em trânsito (HTTPS/TLS), controle de acesso por Row Level Security
            no banco de dados, e autenticação sem armazenamento de senhas (magic link).
            Nenhum sistema é 100% seguro — em caso de incidente, notificaremos os afetados
            conforme exigido pela LGPD.
          </p>
        </Section>

        <Section titulo="10. Alterações nesta política">
          <p>
            Esta política pode ser atualizada periodicamente. Alterações relevantes serão
            comunicadas por e-mail com antecedência. O uso continuado após as alterações
            constitui aceitação da nova política.
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-slate-900 mb-3">{titulo}</h2>
      <div className="text-sm text-slate-600 leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

function Tabela({ linhas }: { linhas: string[][] }) {
  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Dado</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Origem</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Finalidade</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 font-medium text-slate-700">{l[0]}</td>
              <td className="px-4 py-2.5 text-slate-500">{l[1]}</td>
              <td className="px-4 py-2.5 text-slate-500">{l[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

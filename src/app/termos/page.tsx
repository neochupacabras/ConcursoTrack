import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de uso — ConcursoTrack',
  description: 'Leia os termos de uso da plataforma ConcursoTrack.',
}

const ULTIMA_ATUALIZACAO = '4 de julho de 2026'

export default function TermosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Termos de uso</h1>
        <p className="text-sm text-slate-400">Última atualização: {ULTIMA_ATUALIZACAO}</p>
      </div>

      <div className="prose-ct">

        <Section titulo="1. Aceitação dos termos">
          <p>
            Ao acessar ou usar o ConcursoTrack ("plataforma", "serviço"), você concorda com
            estes Termos de Uso. Se não concordar com algum item, não utilize o serviço.
            Estes termos aplicam-se a todos os visitantes, usuários e demais pessoas que
            acessem ou usem a plataforma.
          </p>
        </Section>

        <Section titulo="2. Descrição do serviço">
          <p>
            O ConcursoTrack é uma plataforma de informação sobre concursos públicos no Brasil.
            Oferecemos:
          </p>
          <ul>
            <li>Listagem e busca de editais de concursos públicos abertos</li>
            <li>Alertas por e-mail sobre novos editais de acordo com critérios configurados pelo usuário</li>
            <li>Simulados baseados em provas anteriores de concursos públicos</li>
            <li>Conteúdo editorial sobre preparação para concursos</li>
          </ul>
          <p>
            Os dados de editais são coletados de fontes públicas e sites de divulgação de concursos.
            O ConcursoTrack não é responsável pela exatidão ou completude das informações divulgadas
            pelos órgãos organizadores. Recomendamos sempre consultar o edital oficial antes de
            tomar qualquer decisão.
          </p>
        </Section>

        <Section titulo="3. Conta de usuário">
          <p>
            Para acessar recursos autenticados, você deve criar uma conta informando um endereço
            de e-mail válido. Você é responsável por:
          </p>
          <ul>
            <li>Manter a confidencialidade do acesso à sua conta</li>
            <li>Todas as atividades realizadas sob sua conta</li>
            <li>Notificar o ConcursoTrack imediatamente em caso de uso não autorizado</li>
          </ul>
          <p>
            Você deve ter pelo menos 16 anos para criar uma conta. Ao criar uma conta,
            você confirma que as informações fornecidas são verdadeiras e precisas.
          </p>
        </Section>

        <Section titulo="4. Planos e pagamentos">
          <p>
            O ConcursoTrack oferece um plano gratuito e um plano pago ("Pro"). O plano Pro
            é cobrado mediante assinatura mensal ou anual, processada pela Stripe Inc.
          </p>
          <ul>
            <li>O período de trial gratuito de 7 dias não exige cartão de crédito antecipado</li>
            <li>A assinatura é renovada automaticamente ao fim de cada período</li>
            <li>O cancelamento pode ser feito a qualquer momento pelo portal de gerenciamento</li>
            <li>Reembolsos são avaliados caso a caso em até 7 dias após a cobrança</li>
            <li>Os preços podem ser alterados com aviso prévio de 30 dias</li>
          </ul>
        </Section>

        <Section titulo="5. Uso aceitável">
          <p>Você concorda em não:</p>
          <ul>
            <li>Usar o serviço para qualquer finalidade ilegal ou não autorizada</li>
            <li>Tentar acessar dados de outros usuários sem autorização</li>
            <li>Realizar scraping automatizado do conteúdo da plataforma</li>
            <li>Reproduzir ou redistribuir o conteúdo editorial sem autorização prévia</li>
            <li>Interferir ou tentar interromper a integridade ou o desempenho do serviço</li>
            <li>Criar contas falsas ou múltiplas contas para contornar restrições</li>
          </ul>
        </Section>

        <Section titulo="6. Propriedade intelectual">
          <p>
            O conteúdo editorial, o design, o código e as marcas do ConcursoTrack são de
            propriedade da plataforma e protegidos por leis de direito autoral. As provas
            anteriores de concursos são documentos públicos e de responsabilidade dos
            respectivos órgãos organizadores.
          </p>
        </Section>

        <Section titulo="7. Limitação de responsabilidade">
          <p>
            O ConcursoTrack não garante a precisão, completude ou atualidade das informações
            sobre editais. A plataforma não se responsabiliza por:
          </p>
          <ul>
            <li>Decisões tomadas com base nas informações da plataforma</li>
            <li>Erros ou omissões nos dados de editais coletados de fontes externas</li>
            <li>Interrupções temporárias do serviço por manutenção ou problemas técnicos</li>
            <li>Danos indiretos, incidentais ou consequentes decorrentes do uso do serviço</li>
          </ul>
          <p>
            Em nenhuma hipótese a responsabilidade total do ConcursoTrack excederá o valor
            pago pelo usuário nos últimos 12 meses.
          </p>
        </Section>

        <Section titulo="8. Privacidade">
          <p>
            O tratamento dos seus dados pessoais é descrito em nossa{' '}
            <a href="/privacidade" className="text-blue-600 hover:underline">
              Política de Privacidade
            </a>
            , que integra estes Termos de Uso.
          </p>
        </Section>

        <Section titulo="9. Rescisão">
          <p>
            O ConcursoTrack pode suspender ou encerrar sua conta a qualquer momento, com ou
            sem aviso, caso você viole estes termos. Você pode encerrar sua conta a qualquer
            momento acessando as configurações ou entrando em contato pelo{' '}
            <a href="/contato" className="text-blue-600 hover:underline">formulário de contato</a>.
          </p>
        </Section>

        <Section titulo="10. Alterações nos termos">
          <p>
            Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações
            relevantes serão comunicadas por e-mail com pelo menos 15 dias de antecedência.
            O uso continuado da plataforma após as alterações constitui aceitação dos novos termos.
          </p>
        </Section>

        <Section titulo="11. Lei aplicável">
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil. Quaisquer
            disputas serão submetidas ao foro da comarca de São Paulo, SP.
          </p>
        </Section>

        <Section titulo="12. Contato">
          <p>
            Dúvidas sobre estes termos podem ser enviadas pelo{' '}
            <a href="/contato" className="text-blue-600 hover:underline">formulário de contato</a>{' '}
            ou diretamente para{' '}
            <a href="mailto:contato@concursotrack.com.br" className="text-blue-600 hover:underline">
              contato@concursotrack.com.br
            </a>.
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

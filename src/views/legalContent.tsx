import type { ReactNode } from 'react'

const UPDATED = '7 de maio de 2026'
const SUPPORT_EMAIL = 'suporte@levesaude.com.br'

export const PRIVACY_SUBTITLE = `Última atualização: ${UPDATED}`
export const TERMS_SUBTITLE = `Última atualização: ${UPDATED}`

export function PrivacyContent(): ReactNode {
  return (
    <>
      <p>
        Esta política descreve quais dados o <strong>Leve Control</strong> coleta, como são
        usados, com quem são compartilhados e como você pode acessá-los, corrigi-los ou
        excluí-los, em conformidade com a LGPD (Lei 13.709/2018).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastrais:</strong> nome, e-mail, telefone, data de nascimento.</li>
        <li><strong>Clínicos:</strong> medições de pressão arterial, glicemia, frequência cardíaca, medicações em uso, observações que você inserir.</li>
        <li><strong>Técnicos:</strong> tipo de dispositivo, modelo do aparelho Bluetooth pareado, identificadores anônimos.</li>
        <li><strong>Imagens/PDFs enviados:</strong> fotos de aparelhos e receitas processadas por IA — usadas só para extrair os números e descartadas em seguida (não armazenamos a imagem após a leitura).</li>
      </ul>

      <h2>2. Finalidade do uso</h2>
      <ul>
        <li>Registrar suas medições e exibir histórico e alertas.</li>
        <li>Enviar lembretes diários, se você ativar.</li>
        <li>Permitir que sua operadora/médico vinculado acompanhe sua adesão e gere insights agregados.</li>
        <li>Melhorar o produto, sempre com dados anonimizados.</li>
      </ul>

      <h2>3. Compartilhamento</h2>
      <p>
        Seus dados clínicos são compartilhados apenas com a operadora à qual você está
        vinculado e seu médico responsável. Não vendemos dados a terceiros nem usamos
        para fins publicitários. A IA de leitura (Google Gemini) processa as imagens
        em tempo real e <strong>não retém</strong> os arquivos.
      </p>

      <h2>4. Armazenamento e segurança</h2>
      <p>
        Os dados são armazenados localmente no seu dispositivo (IndexedDB) e replicados
        em servidores criptografados (Supabase + Railway, sediados na União Europeia ou
        nos EUA, com cláusulas-padrão de transferência internacional). Senhas são
        sempre armazenadas com hash + sal.
      </p>

      <h2>5. Seus direitos (LGPD)</h2>
      <p>
        Você tem direito a: acessar seus dados, corrigi-los, exportá-los, anonimizá-los ou
        excluí-los a qualquer momento. Para exercer, vá em <strong>Ajustes →
        Excluir minha conta</strong> ou escreva para <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>6. Cookies e armazenamento local</h2>
      <p>
        Usamos <strong>localStorage</strong> e <strong>IndexedDB</strong> só para guardar suas
        preferências (lembretes, idioma) e suas medições offline. Não usamos cookies de
        rastreamento de terceiros.
      </p>

      <h2>7. Crianças</h2>
      <p>
        O Leve Control não é direcionado a menores de 16 anos sem consentimento dos
        responsáveis. Se identificarmos cadastro de menor sem consentimento, removeremos
        os dados.
      </p>

      <h2>8. Alterações desta política</h2>
      <p>
        Mudanças relevantes serão comunicadas no app antes de entrarem em vigor. A versão
        em vigor é sempre a publicada nesta tela.
      </p>

      <h2>9. Contato — Encarregado de Dados (DPO)</h2>
      <p>
        Dúvidas, denúncias ou solicitações: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </>
  )
}

export function TermsContent(): ReactNode {
  return (
    <>
      <p>
        Ao usar o <strong>Leve Control</strong> você concorda com estes Termos. Leia com
        atenção — eles definem o que o app faz e o que <strong>não</strong> faz.
      </p>

      <h2>1. Sobre o serviço</h2>
      <p>
        O Leve Control é uma ferramenta digital de <strong>monitoramento e registro</strong>
        de medições de pressão arterial e glicemia. Permite registro manual, leitura por
        Bluetooth (Web BLE), leitura por foto/PDF com auxílio de IA e envio dos dados à
        sua operadora/médico.
      </p>

      <h2>2. O que o app NÃO é</h2>
      <div className="note">
        O Leve Control <strong>não substitui</strong> consulta, diagnóstico ou tratamento
        médico. Classificações exibidas (Normal, Pré-hipertensão, Hipertensão I/II, Crise)
        seguem a Diretriz Brasileira de Hipertensão Arterial (SBC, 2025) e são apenas
        <strong> informativas</strong>. Em emergência, ligue <strong>192 (SAMU)</strong>.
      </div>

      <h2>3. Sua conta</h2>
      <ul>
        <li>Você é responsável por manter sua senha em segredo.</li>
        <li>Os dados que você insere devem ser verdadeiros e seus.</li>
        <li>Não compartilhe sua conta com terceiros — cada paciente deve ter a sua.</li>
      </ul>

      <h2>4. Uso da IA</h2>
      <p>
        A leitura por foto/PDF usa um modelo de linguagem (Google Gemini). A IA pode
        errar, especialmente em fotos borradas, com reflexo ou em receitas manuscritas.
        Por isso o app sempre <strong>pede sua confirmação</strong> dos dados extraídos
        antes de salvar. Revise nome, dose e horário do remédio com cuidado.
      </p>

      <h2>5. Alertas automáticos</h2>
      <p>
        Os alertas (PA ≥ 180/110, leituras consecutivas alteradas etc.) são gatilhos
        configuráveis, não diagnósticos. Sempre fale com seu médico antes de ajustar
        medicações.
      </p>

      <h2>6. Operadora & médico</h2>
      <p>
        Se você for vinculado a uma operadora, ela e seu médico responsável podem ver suas
        medições, alertas e adesão. Não enviamos esses dados a outras partes.
      </p>

      <h2>7. Disponibilidade e suporte</h2>
      <p>
        Trabalhamos para manter o app sempre no ar, mas eventuais interrupções podem
        ocorrer (manutenção, falha de rede). Não nos responsabilizamos por danos
        decorrentes da indisponibilidade temporária do serviço.
      </p>

      <h2>8. Encerramento</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento em <strong>Ajustes → Excluir
        minha conta</strong>. Em caso de violação destes Termos, podemos suspender o
        acesso após aviso.
      </p>

      <h2>9. Foro</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira. Foro: comarca do domicílio
        do usuário (CDC art. 101).
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre estes Termos: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </>
  )
}

export function SupportContent(): ReactNode {
  return (
    <>
      <p>
        Precisa de ajuda? Estamos aqui pra resolver. Antes de escrever, dá uma olhada nas
        dúvidas mais comuns abaixo — boa parte se resolve em segundos.
      </p>

      <h2>Falar com a gente</h2>
      <ul>
        <li>E-mail: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
        <li>WhatsApp: <a href="https://wa.me/5511999990000" target="_blank" rel="noreferrer">(11) 99999-0000</a></li>
        <li>Horário: seg–sex, 9h–18h (Brasília)</li>
      </ul>
      <p>
        Em <strong>emergência clínica</strong> (dor no peito, falta de ar, PA ≥ 180/110
        com sintomas), ligue <strong>192 (SAMU)</strong>. O suporte do app não é canal de
        atendimento médico.
      </p>

      <h2>Perguntas frequentes</h2>

      <p><strong>O aparelho Bluetooth não conecta.</strong></p>
      <ul>
        <li>No iPhone, o Bluetooth do navegador (Web BLE) ainda não é suportado pelo Safari. Use o registro manual ou faça pelo app no Android/Chrome.</li>
        <li>No Android, confira se o Bluetooth está ligado e se o aparelho está em modo de pareamento (geralmente botão SET por alguns segundos).</li>
        <li>Esqueça o aparelho nas Configurações do sistema e pareie de novo pelo Leve Control.</li>
      </ul>

      <p><strong>A foto/PDF da receita não foi lida certo.</strong></p>
      <ul>
        <li>Tire a foto com boa luz, sem reflexo, e mostrando o medicamento todo.</li>
        <li>Se a receita for manuscrita, tente um PDF digitalizado em vez de foto.</li>
        <li>Você sempre pode corrigir os campos antes de salvar — a IA pré-preenche, não decide por você.</li>
      </ul>

      <p><strong>Não recebi a notificação de lembrete.</strong></p>
      <ul>
        <li>Confira se a permissão de notificação está liberada nas configurações do navegador.</li>
        <li>Os lembretes só disparam com o app aberto (em aba ou como PWA instalado). Para notificações com app fechado, instale como PWA na tela inicial.</li>
        <li>Cheque o horário em Ajustes → Lembretes.</li>
      </ul>

      <p><strong>Quero exportar ou apagar meus dados.</strong></p>
      <ul>
        <li>Exportar: escreva para o e-mail acima — devolvemos em até 7 dias úteis.</li>
        <li>Apagar: Ajustes → Excluir minha conta. A operação é definitiva.</li>
      </ul>

      <p><strong>Minha pressão está alta o que faço?</strong></p>
      <p>
        O app classifica e alerta, mas não trata. Procure seu médico assistente. Em
        crise (≥ 180/110 com sintomas), ligue o SAMU (192).
      </p>
    </>
  )
}

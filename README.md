# KPS Cardio PWA

Aplicação PWA de acompanhamento de pressão e glicose. O nome visível do produto
é **KPS Cardio**.

## Arquitetura

- Frontend React + Vite; funciona como PWA no navegador, sem aplicativo iOS
  nativo.
- PostgreSQL no Railway é a fonte central para perfis, medições, alertas,
  medicamentos e chat.
- A autenticação também é própria no PostgreSQL: senha derivada com `scrypt` e
  sessão em cookie `HttpOnly`, `Secure` e `SameSite=Strict`.
- Não há dependência de Supabase nem de Storage da Supabase. O IndexedDB/Dexie
  do navegador serve apenas como cache e fila offline isolada por conta.

### Papéis

Os nomes internos históricos são mantidos na API, mas a interface deve usar:

| Código | Papel exibido | Escopo |
| --- | --- | --- |
| `patient` | Paciente | Próprio prontuário e conversa com o médico responsável |
| `operator` | Médico | Carteira de pacientes atribuída e acompanhamento clínico |
| `controller` | Operadora | Gestão operacional, acessos e indicadores agregados |

## Desenvolvimento local

```bash
npm install
npm run dev:server   # API em http://localhost:3000
npm run dev         # Vite em outra janela
```

Configure `DATABASE_URL` e, para leitura por foto/insights, `GEMINI_API_KEY`.
As variáveis completas estão em `.env.example`; não comite valores secretos.

Comandos de verificação:

```bash
npm test             # regras, autenticação, permissões e arquitetura
npm run typecheck    # validação TypeScript
npm run build        # typecheck + bundle Vite/PWA
```

## Autenticação

O KPS Cardio não depende do Supabase. Perfis, hashes de senha e sessões ficam no
PostgreSQL do Railway. O navegador recebe somente um cookie de sessão `HttpOnly`,
`Secure` e `SameSite=Strict`.

- A primeira operadora é criada com `BOOTSTRAP_ADMIN_EMAIL` e
  `BOOTSTRAP_ADMIN_PASSWORD`.
- A senha de bootstrap deve ser removida do ambiente depois do primeiro deploy.
- Senhas provisórias exigem troca no primeiro acesso.
- A operadora redefine senhas de médicos e pacientes; médicos só podem redefinir
  senhas dos próprios pacientes.
- Qualquer usuário autenticado pode trocar a própria senha em **Ajustes**, com
  confirmação da senha atual.
- Uma redefinição revoga todas as sessões anteriores do usuário e entra na auditoria.

## Pacientes menores de 18 anos

O cadastro de paciente exige data de nascimento. Para menores de 18 anos, a API
também exige autorização verificada do responsável legal, independentemente da
interface usada. São registrados nome, vínculo, contato, método, referência da
evidência e data da autorização, versão do termo, operador que conferiu e
horário do registro.

A prova fica em `guardian_consents`, com histórico de substituição/revogação, e
o evento entra em `audit_logs` sem copiar os dados pessoais para o log. Menores
sem autorização ativa não recebem sessão clínica. Cadastros legados aparecem
como **Autorização pendente** em **Gerenciar perfis**, onde podem ser
regularizados pelo médico responsável ou pela operadora.

## Sincronização e recuperação

Alterações feitas sem rede são gravadas junto com uma operação na fila local.
Cada operação carrega o identificador da conta, tem tentativas com espera
crescente e pode ser reaberta em **Ajustes** quando um erro definitivo exigir
intervenção. O logout preserva a fila da conta para que ela possa ser retomada
quando o mesmo usuário voltar; a exclusão explícita da conta apaga essa fila.

O serviço de sincronização usa um cursor por conta, uma pequena janela de
sobreposição e promessas compartilhadas para impedir pulls concorrentes. O
servidor continua sendo a fonte de verdade; o cache local é apresentado antes
da rede para evitar tela vazia em conexões lentas.

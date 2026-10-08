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
## Compatibilidade Gemini (revisão local de 08/10/2026)

O modelo padrão continua `gemini-3.5-flash-lite`. O servidor omite `temperature`
nesse modelo, em Gemini 3.6+, nos aliases móveis Flash/Flash-Lite e em nomes
não classificados. Overrides explícitos legados, incluindo Gemini 2.5,
preservam `temperature: 0` para OCR e `0.2` para resumo. Um override de nome
desconhecido conserva endpoint/modelo e usa a amostragem padrão do provedor;
antes de publicar com esse override, confirmar suas capacidades e qualidade.
Nenhum modelo é substituído e nenhuma tentativa usa outro modelo.

OCR mantém MIME JSON e 256 tokens; resumo mantém 640 tokens. Conteúdo, imagens,
timeout, auditoria e contratos de erro permanecem iguais. `npm test` verifica
payload REST e handler com fetch simulado, sem dados reais ou chamadas pagas.
Esses testes não medem precisão clínica nem qualidade das respostas da IA.

Fonte: https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.6
Gemini 2.5 continua usando `thinkingBudget`; esta revisão não migra modelos
nem configurações de thinking. Não houve publicação de produção.

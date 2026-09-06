# KPS Cardio — análise e sugestões de melhorias

Data: 05/09/2026 · Código analisado: `main`, commit `4f86aaa`.

Documento de análise e planejamento. A versão inicial foi criada sem alterar o app. A primeira rodada de implementação descrita abaixo foi iniciada depois, em alterações locais; não foram executados migrações, alterações de dados ou deploys nesta revisão.

## Estado da implementação iniciada em 05/09/2026

O código começou a receber a primeira rodada desta lista. O estado abaixo é parte do plano e será atualizado a cada rodada.

| Item | Estado | Entregue nesta rodada |
| --- | --- | --- |
| 1. Fila offline | **Parcial** | Operações agora têm `ownerId`, são agrupadas por entidade, ficam atômicas com a gravação local, preservam pendências durante o bootstrap e podem ser reabertas após falha definitiva. A geração da sessão impede uma resposta antiga de repopular o cache. Ainda falta teste de armazenamento cheio e conflito entre aparelhos. |
| 2. Isolamento do cache | **Parcial** | Cursor é separado por conta, a fila não é processada por outra conta e a troca de sessão invalida o cache clínico; gravações em voo são descartadas do cache quando a conta muda. O bootstrap agora informa a carteira autorizada e remove dados locais de pacientes revogados; ainda falta teste de sessão expirada e dois aparelhos. |
| 3. Cursor de sincronização | **Parcial** | Há promessa compartilhada para evitar pulls concorrentes, janela de sobreposição de 5 segundos e abortamento de snapshots de sessões antigas. Ainda falta protocolo baseado em sequência de mudanças no servidor. |
| 4. Chat | **Parcial** | Autoria usa a sessão do usuário, leitura é enviada ao Railway, polling pausa em aba oculta e “Online” fixo foi removido. Ainda falta caixa de entrada completa, presença real e teste em dois aparelhos. |
| 5. Atualização das telas | **Parcial** | Cache é exibido antes da rede, telas reagem ao fim da sincronização e consultas por paciente foram agrupadas. Ainda falta adotar consulta reativa do Dexie em toda a navegação. |
| 6. Timeout e recuperação | **Parcial** | Clientes HTTP têm timeout, erros de rede diferenciados e existe Error Boundary para chunks incompatíveis. Ainda falta padronizar o tratamento visual em todas as telas. |
| 7–8. Histórico, consultas e índices | **Parcial** | Índices compostos no Dexie, consultas agregadas locais e índices PostgreSQL para sincronização reduzem N+1. Paginação do bootstrap e planos com dados sintéticos ainda aguardam medição. |
| 9. OCR | **Parcial** | Imagens são redimensionadas/comprimidas antes do Gemini e logs brutos foram removidos do build de produção. Ainda falta conjunto de avaliação e tratamento de estados `LO`/`HI`. |
| 10–11. PWA e rascunhos | **Parcial** | Arquivos versionados recebem cache longo, HTML/service worker não ficam em cache, há tela de recuperação, rascunhos curtos por conta e a aba aberta é preservada na URL/sessão. Atualização agora fica bloqueada enquanto login, OCR, salvamento, edição de cadastro, mensagem ou criação/redefinição de acesso estiverem ativos; a aba também recebe o aviso nativo `beforeunload` durante a operação. Ainda falta teste em navegador com atualização real do service worker. |
| 12–13. Regras e indicadores | **Planejado** | Não alterado sem validação clínica. A diferença de regras e o significado de “aderência” continuam documentados como risco. |
| 14. Lembretes | **Parcial** | Preferências e marcações passaram a ser separadas por conta e o loop não dispara antes do login. Push com app fechado continua planejado. |
| 15–16. Formulários e acessibilidade | **Parcial** | Dias locais, modais de documentos/glicose, drawers de médico e operadora, envio de mensagens, aviso médico e exclusão de conta agora têm foco inicial, retorno do foco, ciclo de Tab, Escape, bloqueio de rolagem e rótulos semânticos. Formulários ativos também sinalizam a proteção contra atualização da PWA. Falta auditoria completa com leitor de tela, contraste e todos os fusos. |
| 17–19. Segurança, IA e recuperação | **Parcial** | Respostas autenticadas têm `no-store`, autorização de chat usa conexão disponível e o custo de imagens diminui. Minimização de campos, backup e cotas por conta ainda aguardam revisão. |
| 20–21. Testes e métricas | **Pendente** | A suíte existente continua passando; ainda faltam testes de navegador, carga, RUM e métricas de produção. |
| 22. Produto e navegação | **Parcial** | A aba e o prontuário médico podem ser retomados por URL e pelo botão Voltar, com autorização ainda aplicada pelo servidor. Fila clínica com responsável, relatórios exportáveis e links de notificações continuam planejados. |
| 23. Gestão de acessos | **Parcial** | Administração já cria perfis/redefine senhas, e Ajustes agora permite troca da própria senha com confirmação. Desativação reversível, encerramento de sessões e segundo fator continuam planejados. |
| 24. Manutenção e documentação | **Parcial** | README, nomes exibidos dos papéis e critérios de verificação foram atualizados; separação modular do servidor e migrações versionadas continuam planejadas. |

Arquivos alterados na rodada: `src/services/syncEngine.ts`, `src/services/database.ts`, `src/models/types.ts`, `src/contexts/AuthContext.tsx`, `src/services/apiClient.ts`, `src/services/authService.ts`, `src/services/railwayRepository.ts`, `src/services/imageProcessing.ts`, `src/services/activityState.ts`, `src/services/draftStorage.ts`, `src/services/reminderService.ts`, `src/services/glucoseOcr.ts`, `src/services/bpOcr.ts`, `src/hooks/usePatientData.ts`, `src/hooks/useModalAccessibility.ts`, `src/navigation/navigationState.ts`, telas de chat, painéis, histórico, formulários, `src/AppErrorBoundary.tsx`, `README.md`, `server/schema.sql` e `server/index.mjs`. A lista completa fica no diff do repositório.

Rodada adicional: drawers e modais de `PatientListView`, `PatientManagementSection`, `DisclaimerView` e `SettingsView` foram padronizados com `useModalAccessibility`, sem alterar regras clínicas nem o contrato do backend. O componente mantém o foco dentro do overlay, restaura o elemento que abriu a janela e impede que a página subjacente role enquanto o usuário decide. A nova `activityState` registra operações ativas, impede aplicar uma atualização da PWA no meio de OCR, salvamento ou preenchimento de formulário e instala um aviso de saída/recarga enquanto a operação ainda está ativa.

Verificação executada após a rodada: `npm test` passou com 26 testes e `npm run typecheck` passou no volume do projeto. `npm run typecheck` e `npm run build` também passaram em uma cópia local no SSD interno; a execução do build diretamente no volume externo ficou limitada por I/O. O build foi validado quanto à compilação e ao precache da PWA, mas não houve teste de navegador, carga ou publicação. Nenhum deploy ou migração PostgreSQL foi executado.

## Avaliação geral

Minha recomendação é priorizar **confiabilidade da sincronização, comunicação paciente–médico e coerência dos indicadores**, antes de ampliar as funcionalidades. O ganho de performance mais provável está em reduzir consultas repetidas e volumes carregados, além de mostrar o cache rapidamente enquanto a atualização acontece.

A base existente já inclui autenticação própria com PostgreSQL, hashes de senha com scrypt, cookies de sessão protegidos, controle de acesso no servidor, auditoria de alterações, geração de alertas no backend, fila offline, sincronização incremental, carregamento sob demanda de várias telas, cabeçalho compartilhado e aviso de atualização da PWA. Esses recursos devem ser preservados e aperfeiçoados.

As sugestões mantêm a arquitetura definida: **PWA, autenticação e persistência no PostgreSQL do Railway, sem Supabase e sem aplicativo nativo**. O IndexedDB/Dexie existente é cache e fila temporária no aparelho; o PostgreSQL continua sendo a fonte central dos dados.

### Limites desta análise

Foram inspecionados frontend, API Express, esquema PostgreSQL, sincronização, autenticação, OCR, lembretes e arquivos de testes. Não houve navegação autenticada, acesso a prontuários, teste de carga, Lighthouse ou inspeção das configurações atuais do Railway. Portanto:

- **Constatado no código** significa uma implementação verificável nesta versão, sem necessariamente comprovar um incidente em produção.
- **Risco identificado** significa um cenário possível que exige reprodução controlada.
- **Proposta de produto** significa uma evolução, e não um defeito comprovado.
- Ganhos de tempo, custo e escala precisam ser medidos. Não há percentuais de melhoria já demonstrados.

Os blocos de evidência abaixo preservam a fotografia do commit analisado; a tabela
de estado acima é a referência para o que já foi alterado na rodada iniciada em
05/09/2026.

## Prioridades

P0 = tratar primeiro, pela possibilidade de perda de dados ou falha de isolamento. P1 = próximo ciclo, para corrigir fluxos centrais e melhorar operação. P2 = evolução após estabilização. Esforço relativo: pequeno, médio ou grande; não representa um prazo fechado.

| Ordem | Melhoria | Prioridade | Esforço |
| --- | --- | --- | --- |
| 1 | Preservar registros pendentes e tornar a fila offline recuperável | P0 | Grande |
| 2 | Invalidar cache por troca de conta e mudança de acesso | P0 | Grande |
| 3 | Tornar o cursor de sincronização seguro sob concorrência | P0 | Grande |
| 4 | Completar chat bidirecional e estados reais de entrega/leitura | P1 | Médio |
| 5 | Atualizar telas automaticamente e reduzir carregamentos repetidos | P1 | Médio |
| 6 | Definir limites de espera e recuperação de erros | P1 | Médio |
| 7 | Paginar históricos e carregar o painel com resumos | P1 | Grande |
| 8 | Otimizar índices, consultas e uso de conexões | P1 | Médio |
| 9 | Reduzir peso das fotos e tornar o OCR mais previsível | P1 | Médio |
| 10 | Revisar cache de arquivos e tamanho dos pacotes | P2 | Pequeno/médio |
| 11 | Proteger formulários durante atualização da PWA | P1 | Médio |
| 12 | Unificar regras, classificações e ciclo dos alertas | P1 | Grande |
| 13 | Corrigir significado dos indicadores de adesão e metas | P1 | Médio |
| 14 | Oferecer lembretes e notificações com funcionamento explícito | P1 | Grande |
| 15 | Padronizar datas, unidades e validação dos formulários | P1 | Médio |
| 16 | Completar acessibilidade e padronização de modais | P1 | Médio |
| 17 | Reduzir dados distribuídos a cada perfil | P1 | Médio/grande |
| 18 | Controlar IA por finalidade, orçamento e rastreabilidade | P1 | Médio |
| 19 | Verificar recuperação do banco e organizar migrações | P1 | Médio |
| 20 | Testar jornadas reais dos três perfis antes de publicar | P1 | Grande |
| 21 | Medir performance e erros de ponta a ponta | P1 | Médio |
| 22 | Evoluir tarefas clínicas, relatórios e navegação | P2 | Grande |
| 23 | Melhorar gestão de acessos e recuperação de conta | P2 | Médio |
| 24 | Simplificar manutenção e documentação do projeto | P2 | Médio |

## Confiabilidade e comunicação

### 1. Preservar registros pendentes e tornar a fila offline recuperável

**Constatado:** `saveSyncOperation()` retorna silenciosamente quando já existem 500 operações. A gravação clínica local e a inclusão na fila são etapas separadas. `clearClinicalCache()` também apaga a fila e é chamada no logout e na troca de usuário. Após 20 tentativas, uma operação deixa de participar das novas tentativas automáticas.

**Risco:** uma medição pode aparecer como salva no aparelho sem ter uma operação de envio; sair da conta pode remover registros ainda não recebidos pelo servidor. Além disso, `bulkPut()` da sincronização pode substituir uma edição local pendente por uma versão remota antiga.

**Sugestão:** gravar entidade e operação em uma mesma transação local; explicitar fila cheia; preservar pendências isoladas por conta; diferenciar erros definitivos e transitórios; aplicar espera crescente entre tentativas e oferecer recuperação manual. Introduzir versão por registro e tratamento de conflito, inclusive para impedir que uma atualização atrasada recrie um item já excluído.

**Aceite:** testar fila com 501 operações, falha de armazenamento, edição offline, exclusão em outro aparelho, expiração e saída da conta. Nenhuma operação pode desaparecer sem confirmação explícita do usuário.

Evidência: [database.ts](src/services/database.ts), funções `saveSyncOperation`, `fetchPendingSyncOperations` e `clearClinicalCache`; [syncEngine.ts](src/services/syncEngine.ts), `persistEntity` e `pullFromServer`; [AuthContext.tsx](src/contexts/AuthContext.tsx), `logout`.

### 2. Invalidar cache por troca de conta e mudança de acesso

**Constatado:** existe limpeza por proprietário da conta, mas a sincronização incremental não informa remoções de pacientes da carteira. Quando um paciente muda de médico, o médico antigo deixa de recebê-lo do servidor, porém o cache anterior não é removido por esse evento. A exclusão da conta de um paciente também não publica uma remoção completa de seu escopo no fluxo atual. Requisições em andamento não têm cancelamento vinculado à conta.

**Sugestão:** sincronizar a relação autorizada de pacientes e suas revogações; remover todos os dados locais fora desse escopo ao reconectar; vincular cada leitura/escrita à geração da sessão; cancelar e descartar resultados de sessões anteriores. Preservar a fila do item 1 sem torná-la visível a outra conta. A revogação não pode alcançar instantaneamente um aparelho totalmente offline; definir a validade de acesso offline explicitamente.

**Aceite:** trocar paciente de médico, excluir conta e alternar duas contas no mesmo navegador durante uma resposta lenta. Nenhum dado da conta anterior deve reaparecer na sessão nova.

Evidência: [server/index.mjs](server/index.mjs), `accessiblePatientIds`, `/api/bootstrap` e `/api/account`; [syncEngine.ts](src/services/syncEngine.ts), `pullFromServer`; [AuthContext.tsx](src/contexts/AuthContext.tsx).

### 3. Tornar o cursor de sincronização seguro sob concorrência

**Constatado:** o cursor usa o relógio do processo Node; as alterações usam timestamps PostgreSQL; a leitura de várias tabelas ocorre em consultas independentes com filtro `> cursor`.

**Risco identificado:** uma transação iniciada antes da leitura e confirmada depois pode ficar invisível nessa leitura, mas já ter timestamp anterior ao cursor devolvido. Ela pode ser omitida nas próximas sincronizações. Esse cenário não foi reproduzido nesta revisão.

**Sugestão:** projetar um protocolo consistente de mudanças confirmadas, com paginação e deduplicação. Se houver janela de sobreposição, documentar seu limite e ter reconciliação completa; uma simples sequência crescente também precisa considerar ordem de confirmação das transações. Manter tombstones por uma janela compatível com o tempo offline suportado.

**Aceite:** transações longas, gravação durante bootstrap, exclusões, timestamps iguais e reconexão após vários dias convergem para o mesmo conjunto de dados.

Evidência: [server/index.mjs](server/index.mjs), `/api/bootstrap`; [server/schema.sql](server/schema.sql), timestamps e `sync_tombstones`.

### 4. Completar chat bidirecional e estados reais de entrega/leitura

**Constatado:** `ChatView` deriva quem escreve de `currentPatient.role`. Ao abrir o prontuário como médico, esse objeto representa o paciente. O servidor corrige a autoria no envio, mas o frontend pode exibir temporariamente autoria e marcações incorretas. A marcação de leitura atualiza somente o Dexie. O texto “Online” é fixo. O modal de envio médico não bloqueia envios simultâneos e pode anunciar entrega mesmo quando houve apenas enfileiramento offline.

**Sugestão:** usar `currentUserRole` para identificar o autor, oferecer caixa de entrada ao médico e conversa compartilhada pelos dois perfis; persistir leitura em endpoint próprio com verificação do destinatário; distinguir “pendente”, “enviada ao servidor” e “lida”. Remover o status de presença até existir sinal real. Preservar a posição de quem lê mensagens antigas. Revisar separadamente os registros técnicos de teste, sem apagar conversas legítimas.

**Aceite:** paciente e médico conversam em aparelhos diferentes, recebem atualizações e confirmam leitura; envio offline não aparece como entregue; clique duplo não duplica mensagem.

Evidência: [ChatView.tsx](src/views/ChatView.tsx), linhas 19, 33 e 92; [database.ts](src/services/database.ts), `markMessagesRead`; [PatientListView.tsx](src/views/PatientListView.tsx), `PushNotificationModal`.

### 5. Atualizar telas automaticamente e reduzir carregamentos repetidos

**Constatado:** a sincronização altera o Dexie, mas várias telas mantêm cópias em `useState` carregadas apenas na montagem ou após ações locais. `GlucoseView` consulta somente o cache ao abrir. `usePatientData()` espera a rede antes de mostrar os dados e lê o histórico de pressão repetidamente para obter total, dia e sequência. Uma gravação pode provocar várias sincronizações consecutivas. Uma chamada concorrente a `pullFromServer()` retorna imediatamente, sem aguardar a leitura já em andamento.

**Sugestão:** adotar consultas reativas ao cache, reaproveitando as dependências Dexie já instaladas; exibir dados locais da conta validada imediatamente, com indicação de atualização; compartilhar a promessa de sincronização em andamento; buscar apenas os dados necessários a cada tela. Pausar consultas periódicas desnecessárias quando a aba não estiver visível.

**Aceite:** uma medição feita em outro aparelho aparece na tela aberta sem sair e entrar; trocar de página não dispara sucessivas leituras equivalentes.

Evidência: [usePatientData.ts](src/hooks/usePatientData.ts), `loadData` e `addMeasurement`; [GlucoseView.tsx](src/views/GlucoseView.tsx), `loadHistory`; [syncEngine.ts](src/services/syncEngine.ts).

### 6. Definir limites de espera e recuperação de erros

**Constatado:** os clientes HTTP de autenticação e dados não definem timeout. O backend limita a chamada Gemini a 30 segundos, mas não há configuração equivalente explícita de espera por conexão/consulta PostgreSQL. Algumas telas registram erro apenas no console; `ControllerDashboardView.loadAll()` não tem tratamento abrangente para encerrar o carregamento após falha.

**Sugestão:** criar uma política comum de timeout e cancelamento, mensagens úteis e botão de tentar novamente; preservar formulários em caso de erro; criar uma tela de recuperação para erros de renderização e falhas ao carregar pacotes após deploy. Repetir gravações somente com identificação estável da operação.

**Aceite:** rede sem resposta, sessão expirada, banco indisponível e pacote de uma versão antiga apresentam uma saída clara, sem spinner indefinido nem duplicação de registros.

Evidência: [apiClient.ts](src/services/apiClient.ts), [authService.ts](src/services/authService.ts), [ControllerDashboardView.tsx](src/views/ControllerDashboardView.tsx), [server/index.mjs](server/index.mjs).

## Performance

### 7. Paginar históricos e carregar o painel com resumos

**Constatado:** o primeiro bootstrap entrega todos os históricos de todos os pacientes acessíveis, incluindo chat, medicamentos e dispositivos. A operadora tem escopo global de pacientes. No aparelho, helpers carregam todo o histórico para depois selecionar os registros recentes; os painéis repetem consultas por paciente.

**Sugestão:** separar sessão, resumo do painel, lista paginada de pacientes e histórico por paciente/período. Carregar registros antigos sob demanda e definir a janela de cache offline. Calcular agregados no PostgreSQL para evitar baixar prontuários completos apenas para contar pacientes. Para listas longas, avaliar renderização somente dos itens visíveis após medir o custo real.

**Aceite:** comparar cargas sintéticas de 100, 1.000 e 10.000 pacientes em ambiente isolado; registrar bytes recebidos, tempo de abertura e memória. O painel inicial não deve crescer proporcionalmente a todo o histórico clínico.

Evidência: [server/index.mjs](server/index.mjs), `/api/bootstrap`; [database.ts](src/services/database.ts), `fetchRecentMeasurements` e `fetchOperatorPatientStats`; [PatientListView.tsx](src/views/PatientListView.tsx).

### 8. Otimizar índices, consultas e uso de conexões

**Constatado:** já existem índices por paciente/data de medição, mas as consultas incrementais filtram também por `synced_at` ou `updated_at`. No Dexie faltam índices compostos para várias buscas por paciente/data e conversa. Toda requisição autenticada atualiza `last_seen_at`. Algumas rotas reservam uma conexão e depois fazem a autorização por outra consulta ao pool.

**Sugestão:** analisar planos de consulta antes de criar índices; avaliar `(patient_id, synced_at)` ou equivalente conforme cada acesso e índices compostos no Dexie. Atualizar `last_seen_at` em intervalos, não em todas as chamadas. Reutilizar a conexão da operação na autorização para evitar espera circular quando o pool estiver cheio. Definir limites de consulta e aquisição de conexão.

**Aceite:** comparar planos e latência antes/depois; testar concorrência de gravações sem esgotamento permanente do pool. Índices extras só entram com benefício medido, pois também aumentam custo de escrita. Referência: [índices multicoluna do PostgreSQL](https://www.postgresql.org/docs/current/indexes-multicolumn.html).

Evidência: [server/schema.sql](server/schema.sql), [server/index.mjs](server/index.mjs), `authenticate`, `canAccessPatient` e rotas de entidades; [database.ts](src/services/database.ts).

### 9. Reduzir peso das fotos e tornar o OCR mais previsível

**Constatado:** as fotos são convertidas integralmente em base64 antes do envio. A API aceita JSON de até 12 MB e limita o conteúdo de IA separadamente. Não há etapa comum de recorte, redução de resolução ou compressão nos fluxos analisados.

**Sugestão:** conferir tamanho e formato antes da leitura; permitir recortar o visor; reduzir a imagem preservando dígitos legíveis; oferecer progresso, cancelamento e preenchimento manual. Validar a resposta da IA com esquema estruturado e mostrar claramente a unidade original. Tratar “LO”, “HI” e unidade ilegível como estados próprios, sem inventar número. Manter confirmação humana antes de registrar.

**Aceite:** conjunto controlado de fotos nítidas, desfocadas, inclinadas, grandes e com unidades distintas; medir acerto, tamanho transmitido, tempo e taxa de correção manual. Não persistir fotos por padrão; se houver necessidade futura de retenção, definir limites e persistência no PostgreSQL conforme a arquitetura escolhida.

Evidência: [GlucoseView.tsx](src/views/GlucoseView.tsx), `handlePhotoCapture`; [glucoseOcr.ts](src/services/glucoseOcr.ts), [bpOcr.ts](src/services/bpOcr.ts), [MedicationsView.tsx](src/views/MedicationsView.tsx), `/api/ai/generate`.

### 10. Revisar cache de arquivos e tamanho dos pacotes

**Constatado:** há divisão de código por várias telas e precache da PWA, mas o servidor usa `maxAge: '1h'` genericamente para os arquivos estáticos. O precache inclui os pacotes encontrados no build, mesmo os carregados sob demanda na navegação. Não foi medido o peso atual nem verificada compressão no proxy de produção.

**Sugestão:** usar políticas distintas para HTML/service worker e arquivos com hash; medir a transferência do primeiro acesso e da instalação da PWA; avaliar carregamento tardio de gráficos, mapa e áreas administrativas. Verificar compressão HTTP no caminho real de entrega antes de adicionar middleware. Manter respostas clínicas fora de cache HTTP compartilhado.

**Aceite:** comparar acesso frio, retorno e atualização de versão, com funcionamento offline preservado e sem servir HTML antigo com pacotes indisponíveis.

Evidência: [vite.config.ts](vite.config.ts), [App.tsx](src/App.tsx), [MainTabView.tsx](src/views/MainTabView.tsx), [server/index.mjs](server/index.mjs), `express.static`.

### 11. Proteger formulários durante atualização da PWA

**Constatado:** o aviso de nova versão já funciona como componente com opção de adiar; “Atualizar agora” chama a atualização com recarga sem consultar OCR em andamento, formulário alterado ou envio ativo.

**Sugestão:** preservar rascunhos por usuário/paciente; adiar a recarga enquanto uma gravação estiver em andamento e avisar quando houver conteúdo ainda não salvo. Exibir versão e data da atualização em Ajustes, úteis para suporte.

**Aceite:** uma nova versão não perde número digitado, texto de chat ou revisão de receita. Testar também a compatibilidade da fila antiga com a versão nova.

Evidência: [PwaUpdatePrompt.tsx](src/views/PwaUpdatePrompt.tsx), `installUpdate`; formulários das telas de medição, chat e medicamentos.

## Qualidade clínica e experiência de uso

### 12. Unificar regras, classificações e ciclo dos alertas

**Constatado:** frontend e backend têm regras separadas. Nas leituras pressóricas consecutivas há diferença entre `>` e `>=`; o frontend pode emitir atenção junto com urgência, enquanto o backend prioriza um alerta. A classificação de glicose pode exibir “Diabetes” a partir de uma medição individual. O backend gera alertas de glicose baixa, mas não possui regra equivalente para alta. Editar uma medição gera novos cálculos sem um fluxo explícito de revisão dos alertas anteriores; excluir a medição deixa referências de alertas nulas.

**Sugestão:** manter uma política versionada e compartilhada de classificação, com linguagem de acompanhamento, evitando apresentar um diagnóstico automático. Definir com a equipe clínica metas individuais, regras para valores altos/baixos, mensagens ao paciente e comportamento após correção/exclusão. Guardar a versão da regra e trilha da revisão, em vez de simplesmente apagar alertas.

**Aceite:** mesma leitura produz classificação coerente em pressão, glicose, histórico e painéis; os limites e textos são aprovados pela equipe clínica. Este documento não propõe novos limiares médicos.

Evidência: [alertService.ts](src/services/alertService.ts), [clinical-rules.mjs](server/clinical-rules.mjs), [glucose.ts](src/config/glucose.ts), `createMeasurementAlerts`, `createGlucoseAlerts` e chaves estrangeiras de alertas.

### 13. Corrigir significado dos indicadores de adesão e metas

**Constatado:** “aderência à medicação” é inferida por medicamento ativo e medição recente. Isso mede regularidade de registros, não confirmação de uso do remédio. “Dentro da meta” usa faixas globais; “mediu hoje” deriva de pressão, embora o paciente também registre glicose. O total de médicos do painel conta responsáveis associados a pacientes, não necessariamente todos os médicos cadastrados.

**Sugestão:** nomear esses indicadores precisamente; separar adesão ao monitoramento de tomada de medicamentos; explicar período e denominador; mostrar pressão e glicose separadamente e um total combinado quando fizer sentido. Reservar “meta individual” para quando existir configuração clínica específica.

**Aceite:** cada indicador apresenta definição verificável; um paciente que só registrou glicose não aparece ambiguamente como sem nenhuma medição; os números do resumo conferem com a lista detalhada.

Evidência: [PatientListView.tsx](src/views/PatientListView.tsx), cálculo de `adhering`; [ControllerDashboardView.tsx](src/views/ControllerDashboardView.tsx), `loadAll` e prompt de insight.

### 14. Oferecer lembretes e notificações com funcionamento explícito

**Constatado:** os lembretes são verificados por `setInterval` na página e não há implementação de assinatura Web Push nos arquivos analisados. Configurações e marcações de envio ficam em chaves locais sem separação por usuário. O loop inicia antes do login.

**Sugestão:** esclarecer o funcionamento atual e vincular preferências à conta. Para avisos com o app fechado, avaliar Web Push com agendamento no backend, assinaturas no PostgreSQL e tratamento de suporte/permissão do navegador. Notificações de chat devem levar à conversa certa, com conteúdo discreto na tela bloqueada. Evitar prometer entrega garantida ou monitoramento humano contínuo.

**Aceite:** verificar aparelho fechado, permissão negada, assinatura expirada, troca de conta, fuso e envio duplicado. A Push API permite receber eventos sem a página estar carregada, mas depende de assinatura e service worker: [documentação MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

Evidência: [reminderService.ts](src/services/reminderService.ts), [main.tsx](src/main.tsx), [vite.config.ts](vite.config.ts).

### 15. Padronizar datas, unidades e validação dos formulários

**Constatado:** parte dos cálculos usa horário local e parte usa `toISOString()` para identificar dias. Medições novas recebem a hora atual. Há validadores genéricos que aceitam data ausente, embora determinados campos de medição sejam obrigatórios no banco. A edição SQL de pressão não atualiza todos os campos derivados, como pressão arterial média, quando os valores principais mudam.

**Sugestão:** padronizar “hoje” no fuso do usuário, armazenar instantes em UTC e tratar datas sem horário separadamente. Permitir registrar uma medição anterior com data/hora explícitas e validação no servidor. Padronizar vírgula decimal, unidade, limites técnicos e recalcular campos derivados no backend. Revisar campos opcionais e obrigatórios por entidade.

**Aceite:** registros próximos à meia-noite aparecem no dia correto; datas inválidas geram erro útil; editar pressão não deixa valores derivados desatualizados; unidade e valor permanecem consistentes entre foto, formulário e histórico.

Evidência: [database.ts](src/services/database.ts), `fetchStreak`; [reminderService.ts](src/services/reminderService.ts), `tick`; [MedicationsView.tsx](src/views/MedicationsView.tsx); [policy.mjs](server/policy.mjs), `isValidIsoDate`; `entityConfigs` no servidor.

### 16. Completar acessibilidade e padronização de modais

**Constatado:** existe `AppPageHeader` compartilhado. O modal de exclusão de glicose já tem identificação acessível, foco inicial e Escape, mas não há contenção/restauração completa de foco nesse código. Outros modais usam estruturas independentes. As abas inferiores não expõem explicitamente o estado selecionado por atributos de acessibilidade.

**Sugestão:** criar um modal reutilizável com título, foco contido, retorno do foco, teclado e estados de envio; padronizar mensagens de erro e confirmação; verificar zoom, leitor de tela, contraste, teclado virtual e botões em telas pequenas. Preservar a padronização superior existente.

**Aceite:** navegação completa por teclado e leitor de tela sem perder o foco atrás do modal; layouts de 320 px até desktop e fonte ampliada continuam utilizáveis. Referência: [padrão de diálogo modal W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Evidência: [AppPageHeader.tsx](src/views/AppPageHeader.tsx), [GlucoseView.tsx](src/views/GlucoseView.tsx), [DocumentSheetView.tsx](src/views/DocumentSheetView.tsx), [MainTabView.tsx](src/views/MainTabView.tsx).

## Segurança, operação e evolução

### 17. Reduzir dados distribuídos a cada perfil

**Constatado:** o backend já limita o médico à própria carteira e o paciente a si mesmo. Porém `profileToClient()` inclui `planStatus` também nas respostas destinadas ao médico, embora o painel médico esconda o financeiro. O perfil `controller` recebe registros clínicos e conversas de todos os pacientes no bootstrap.

**Sugestão:** definir a matriz de campos e operações por perfil no servidor. Entregar ao painel administrativo resumos e disponibilizar detalhes clínicos apenas quando fizerem parte de sua atribuição; remover campos financeiros das respostas clínicas se não forem necessários. Aplicar `Cache-Control: no-store` consistentemente às respostas autenticadas. Vincular aceite de termos à conta e à versão do documento, pois hoje o aceite é um booleano do navegador.

**Aceite:** inspecionar respostas da API por papel, além das telas; o paciente continua limitado ao próprio prontuário, e cada profissional recebe somente os campos previstos na matriz.

Evidência: [server/index.mjs](server/index.mjs), `profileToClient`, `accessiblePatientIds` e `/api/bootstrap`; [App.tsx](src/App.tsx), `DISCLAIMER_KEY`.

### 18. Controlar IA por finalidade, orçamento e rastreabilidade

**Constatado:** a chave Gemini fica no servidor e existe limite de requisições, mas o navegador envia o prompt e `generationConfig` completos. O limite de IA está baseado no mecanismo padrão por IP. O insight do painel pode ser gerado novamente a cada carregamento. Os parsers OCR registram a resposta bruta no console.

**Sugestão:** manter templates, esquemas e limites de saída no servidor; aceitar do frontend apenas os campos previstos por finalidade. Definir cotas por conta e por finalidade, limite de concorrência e tratamento de indisponibilidade. Reutilizar insight quando os dados e a versão do prompt não mudarem, identificando sua data. Registrar modelo, duração e resultado técnico sem corpo de prontuário, foto ou conversa; remover logs brutos em produção.

**Aceite:** o cliente não consegue ampliar livremente o custo da chamada; cada falha tem causa rastreável; o preenchimento manual permanece disponível quando a IA falhar. Nenhuma troca de modelo foi testada ou recomendada por suposição nesta análise.

Evidência: [server/index.mjs](server/index.mjs), `/api/ai/generate`; [ControllerDashboardView.tsx](src/views/ControllerDashboardView.tsx), `generateInsight`; serviços de OCR.

### 19. Verificar recuperação do banco e organizar migrações

**Constatado:** o servidor aplica `schema.sql` ao iniciar. Não foi verificada a política real de backup do Railway, portanto não é possível afirmar que backups estejam ausentes ou suficientes.

**Sugestão:** inventariar backup, retenção e recuperação; executar futuramente uma restauração em ambiente isolado e definir perda máxima de dados e prazo de recuperação aceitáveis. Versionar migrações, separar execução de esquema da inicialização normal e planejar compatibilidade com PWAs antigas e filas offline. Revisar integridade, índices e crescimento de auditoria/tombstones.

**Aceite:** restaurar uma base de teste e demonstrar login, histórico, chat e permissões; uma implantação incompatível é detectada antes de atingir produção.

Evidência: [server/index.mjs](server/index.mjs), `start`; [server/schema.sql](server/schema.sql).

### 20. Testar jornadas reais dos três perfis antes de publicar

**Constatado:** há testes de autenticação, políticas, regras e arquitetura. Parte dos testes de interface verifica texto do código com expressões regulares; isso não demonstra envio, recebimento ou navegação real. Não há suíte de navegador configurada no `package.json` analisado.

**Sugestão:** adicionar testes de integração da API com PostgreSQL isolado e testes de navegador para paciente, médico e operadora. Cobrir registro manual/foto, histórico combinado, exclusão, conversa bidirecional, transferência de paciente, sessão expirada, fila offline e nova versão da PWA. Usar contas e dados sintéticos em ambiente de teste.

**Aceite:** fluxos passam em Chrome desktop, Android e Safari/PWA no iPhone quando usados pelo público — isso continua sendo teste da PWA, sem desenvolvimento de app nativo. O deploy deve depender de verificações comportamentais dos fluxos alterados.

Evidência: [package.json](package.json), [architecture.test.mjs](server/architecture.test.mjs), [policy.test.mjs](server/policy.test.mjs), [auth.test.mjs](server/auth.test.mjs), [clinical-rules.test.mjs](server/clinical-rules.test.mjs).

### 21. Medir performance e erros de ponta a ponta

**Constatado:** existem logs de console, auditoria e health check, mas não foi encontrada instrumentação de métricas de experiência nos pontos analisados. Isso dificulta saber se a demora vem da foto, rede, banco ou renderização.

**Sugestão:** medir abertura por perfil, latência de leitura/gravação, OCR, atraso de mensagem, tamanho do bootstrap, profundidade/idade da fila e falhas por versão. Correlacionar frontend e API com identificador de requisição sem conteúdo clínico. Definir limites de desempenho após coletar uma linha de base.

**Metas iniciais propostas, não resultados obtidos:** LCP até 2,5 s, INP até 200 ms e CLS até 0,1 no percentil 75, segmentando mobile e desktop conforme [Core Web Vitals](https://web.dev/articles/vitals). Para chat ativo, propor recebimento em até 5 s no percentil 95; para gravação online sem OCR, propor confirmação em até 2 s no percentil 95, ajustando a meta à rede e ao teste controlado.

**Aceite:** um relatório mostra a linha de base e a variação após cada otimização, sem depender apenas de percepção visual.

### 22. Evoluir tarefas clínicas, relatórios e navegação

**Propostas de produto:** transformar alertas em uma fila de acompanhamento com responsável, prioridade, prazo, última ação e histórico; permitir filtros e ordenação por necessidade de revisão; oferecer relatório por paciente/período com pressão, glicose, contexto e origem da leitura. Manter a operadora focada em acesso, cobertura e operação, e o médico em acompanhamento clínico.

Também vale adotar URLs para as telas e pacientes autorizados: a navegação atual por estado local perde a aba ao recarregar e limita links de notificações. Relatórios e links devem aplicar a mesma autorização do prontuário, sem acesso público automático. O relatório não deve apresentar conclusões clínicas inventadas.

**Aceite:** médico consegue identificar quem precisa de revisão, registrar a ação e retornar depois; paciente consegue levar um histórico organizado à consulta; voltar e recarregar mantêm a navegação esperada.

Evidência de base: [PatientListView.tsx](src/views/PatientListView.tsx), [ControllerDashboardView.tsx](src/views/ControllerDashboardView.tsx), [HistoryView.tsx](src/views/HistoryView.tsx), [MainTabView.tsx](src/views/MainTabView.tsx) e tabelas `alerts`/`alert_events`.

### 23. Melhorar gestão de acessos e recuperação de conta

**Constatado:** já há criação de perfis, senhas provisórias, troca obrigatória e revogação de sessões após redefinição. O backend também aceita troca de senha com confirmação da senha atual; a interface de contexto concentra-se no fluxo de primeiro acesso.

**Sugestão:** oferecer troca de senha em Ajustes, status de acesso, desativação reversível e encerramento de sessões pela administração. Tornar claro quem pode redefinir cada conta. Preferir senha provisória individual por usuário, exibida apenas no fluxo de criação/redefinição; avaliar segundo fator para perfis com acesso amplo em uma etapa posterior.

**Aceite:** uma conta desativada perde acesso, a recuperação não altera sua carteira e o usuário consegue trocar a própria senha sem intervenção da operadora. Manter a autenticação no PostgreSQL.

Evidência: [AdminProfilesView.tsx](src/views/AdminProfilesView.tsx), [authService.ts](src/services/authService.ts), [AuthContext.tsx](src/contexts/AuthContext.tsx) e rotas de autenticação/perfis.

### 24. Simplificar manutenção e documentação do projeto

**Constatado:** o servidor concentra rotas, SQL, validação, autenticação e IA em um arquivo de 855 linhas. Existem componentes extensos e sobreposição de gestão de pacientes. Os códigos internos `operator` e `controller` significam médico e operadora, respectivamente, o que facilita confusões futuras. O README explica principalmente autenticação.

**Sugestão:** documentar explicitamente esses papéis e centralizar sua tradução para a interface. Separar módulos por responsabilidade quando forem alterados, sem uma reescrita ampla. Documentar execução local, variáveis por nome sem valores secretos, arquitetura de sync, permissões, deploy, recuperação e critérios de aceite. Manter “KPS Cardio” como nome visível e consolidar componentes compartilhados.

**Aceite:** outra sessão consegue localizar o projeto, compreender os três perfis e executar o fluxo de desenvolvimento sem depender do histórico do chat. Nomes internos históricos podem ser renomeados gradualmente se isso reduzir ambiguidades, com atenção às migrações.

Evidência: [README.md](README.md), [server/index.mjs](server/index.mjs), [policy.mjs](server/policy.mjs), [PatientListView.tsx](src/views/PatientListView.tsx), [PatientManagementSection.tsx](src/views/PatientManagementSection.tsx).

## Sequência sugerida de trabalho futuro

1. **Integridade e isolamento:** itens 1–3, acompanhados de testes de concorrência e troca de conta do item 20.
2. **Fluxos centrais:** chat, atualização reativa, timeout, proteção de rascunhos e coerência de regras/indicadores — itens 4–6 e 11–13.
3. **Medição e performance:** coletar a linha de base do item 21; otimizar bootstrap, consultas, fotos e cache — itens 7–10. Medir novamente com os mesmos cenários.
4. **Operação e experiência:** lembretes, formulários, acessibilidade, minimização de dados, controle de IA e recuperação — itens 14–19.
5. **Evolução de produto:** tarefas clínicas, relatórios, gestão de acesso e manutenção — itens 22–24.

O ponto de partida recomendado é a fila offline: antes de tornar a aplicação mais rápida ou adicionar novas telas, cada ação exibida como salva precisa ter persistência rastreável e recuperação previsível.

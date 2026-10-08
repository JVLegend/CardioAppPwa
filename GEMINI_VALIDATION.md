# Validação local — 08/10/2026

Base: `3c251ca`. Branch: `fix/gemini-model-compatibility`.

- `npm run check`: passou (tipos, suíte inicial de 98 testes, offline e build).
- `npm test` após acrescentar testes do handler: 100/100 passaram.
- `npm run test:security:http`: 39 grupos passaram em PostgreSQL temporário.
- `git diff --check`: passou.
- Lint: projeto não define comando/configuração de lint.

Fetch simulado valida os payloads serializados para OCR e resumo, mantendo
imagens, conteúdo, endpoint/modelo, tokens, MIME e contratos de erro.
Testes incluem modelos 2.5 Flash/Flash-Lite, padrão 3.5 Flash-Lite, aliases e
ID futuro desconhecido. Não houve conexão Gemini nem dados reais.

Um teste antigo de arquitetura precisou apontar para o novo módulo do servidor;
a primeira falha foi corrigida e a suíte repetida passou. Nenhuma falha pendente.

CI: este checkout não contém `.github/workflows`. Existem configurações
Railway/Vercel; vínculos de hospedagem externos não foram verificados.
Entrega somente local, sem push, PR, deploy ou merge.

Risco residual: overrides desconhecidos omitem sampling; confirmar capacidade
e qualidade antes de publicar com um nome não classificado. Não foi avaliada
precisão clínica em respostas reais. O modelo padrão não mudou.

## Revisão independente final

A revisão encontrou que prefixos numéricos antigos podiam classificar nomes
desconhecidos como legados. Corrigido com allowlist de famílias reconhecidas;
`gemini-3-flash-latest`, `gemini-3.5-future` e `gemini-2.99-future` agora omitem
sampling e estão na matriz do handler/payload REST serializado. `temperature: 0`
continua preservado sem teste de truthiness para 2.5 e seus previews reconhecidos.
Gemini 3.5 Flash conserva o override anterior: a documentação o distingue dos
modelos que ignoram sampling, descrevendo sampling como desaconselhado.
Fonte: https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.5

Depois da correção, `npm run check` passou: 104 testes, tipos, offline e build.
Revisor independente reexecutou 20 testes do módulo/handler, todos passaram.
Não identificou novo finding. A allowlist requer manutenção deliberada ao
adotar famílias novas; nenhum modelo é escolhido automaticamente.

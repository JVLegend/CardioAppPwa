# Kardia App PWA

<!-- MIGRACAO_HD_EXTERNO_SUPERJV -->

## Armazenamento local

Tags: #Tecnologia #MacMini #Arquivo

Este projeto foi migrado em 2026-07-09 para o HD externo do Mac mini.

- Caminho principal: `/Volumes/Karine HD Externo/Dados_JV/Projetos_GitHub/CardioAppPwa`
- Caminho legado preservado por symlink: `/Users/iaparamedicos/Documents/GitHub/CardioAppPwa`

## Autenticação

O KardiaApp não depende do Supabase. Perfis, hashes de senha e sessões ficam no
PostgreSQL do Railway. O navegador recebe somente um cookie de sessão `HttpOnly`,
`Secure` e `SameSite=Strict`.

- A primeira operadora é criada com `BOOTSTRAP_ADMIN_EMAIL` e
  `BOOTSTRAP_ADMIN_PASSWORD`.
- A senha de bootstrap deve ser removida do ambiente depois do primeiro deploy.
- Senhas provisórias exigem troca no primeiro acesso.
- A operadora redefine senhas de médicos e pacientes; médicos só podem redefinir
  senhas dos próprios pacientes.
- Uma redefinição revoga todas as sessões anteriores do usuário e entra na auditoria.

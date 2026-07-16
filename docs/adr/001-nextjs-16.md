# ADR-001 — Adotar Next.js 16

- Status: aceito
- Data: 2026-07-15
- Decisão: equipe do projeto

## Contexto

O prompt mestre indicava Next.js 15. A fundação atual e o ambiente de execução utilizam Next.js 16 com React 19. Manter a versão anterior exigiria recriar o scaffold e ampliar o risco de incompatibilidade antes do primeiro fluxo funcional.

## Decisão

Adotar Next.js 16, App Router, React 19 e TypeScript estrito. Server Components continuam sendo o padrão. Client Components serão usados apenas quando houver interatividade, estado local ou API do navegador.

## Consequências

- O projeto acompanha a base suportada pelo ambiente atual.
- Toda dependência futura deve ser validada contra Next.js 16.
- Alterações de comportamento em cache, rotas e APIs de servidor devem ser cobertas por testes.
- O Prompt Master deve ser interpretado com Next.js 16 no lugar de Next.js 15.

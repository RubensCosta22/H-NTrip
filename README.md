# H&NTrip

Aplicativo privado e colaborativo para planejar viagens, acompanhar gastos, organizar documentos e preservar memórias.

## Versão

Produção: `1.0.0`.

## Funcionalidades

- autenticação Supabase e isolamento por workspace;
- papéis owner e admin;
- viagens, participantes, roteiro e mapa;
- orçamento, categorias e gastos;
- checklists colaborativos;
- locais e referências de reservas;
- documentos e fotos em buckets privados;
- favoritos, capa, localização e edição de fotos;
- álbum automático, estatísticas, alertas e histórico;
- arquivamento e restauração;
- busca, filtros, paginação e interface móvel;
- exportação privada dos dados da viagem;
- liveness e readiness para monitoramento.

## Qualidade

```sh
npm run lint
npm run typecheck
npm test
```

Os testes do banco podem ser executados em um Supabase local descartável:

```sh
npm run supabase:start
npm run supabase:reset
npm run supabase:test
```

## Operação

- `GET /api/health` verifica o aplicativo.
- `GET /api/health/readiness` verifica aplicativo e Supabase.
- Migrações são forward-only em `supabase/migrations`.
- Testes de RLS e permissões ficam em `supabase/tests`.
- Procedimentos estão em `docs/operations-v1.md`.
- Guia de uso está em `docs/user-guide-v1.md`.

Nunca salve senhas, connection strings, dumps, service-role keys ou dados pessoais no repositório. Backups de banco e objetos do Storage devem ser protegidos separadamente.

## Publicação no Render

O repositório inclui um Blueprint em `render.yaml`. No Render, crie um novo
**Blueprint**, conecte este repositório e selecione a branch `main`.

Informe as variáveis solicitadas durante a criação:

- `NEXT_PUBLIC_SUPABASE_URL`: URL/API URL do projeto Supabase;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publicável do Supabase;
- `APP_URL`: URL HTTPS final fornecida pelo Render, sem barra no final.

Depois do primeiro deploy, confirme que `APP_URL` corresponde exatamente ao
endereço do serviço e adicione `https://<seu-serviço>.onrender.com/auth/callback`
às URLs de redirecionamento permitidas no Supabase Auth.

# ADR-002 — Supabase PostgreSQL e autorização em duas camadas

- Status: aceito pelo Prompt Master
- Data: 2026-07-15

## Decisão

Usar Supabase PostgreSQL, Auth e Storage como plataforma de dados. Toda operação sensível valida sessão e associação no servidor, enquanto RLS e constraints aplicam negação por padrão no banco.

`workspace_members` é a fonte de autorização. Participantes de viagem são apenas dados informativos. Funções `security definer` ficam no schema privado, usam `search_path` vazio e têm execução explicitamente restrita.

## Consequências

- O cliente nunca escolhe de forma confiável `workspace_id`, papel ou autoria.
- As políticas são testadas com usuário autorizado, outro workspace, autenticado sem associação e anônimo.
- O papel `service_role` não pode aparecer no navegador, logs ou variáveis públicas.
- A hospedagem da aplicação não substitui a autorização do Supabase.

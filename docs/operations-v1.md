# H&NTrip — operação da versão 1

## Sinais de saúde

- `GET /api/health`: liveness do aplicativo. Esperado: HTTP 200 e `{"status":"ok"}`.
- `GET /api/health/readiness`: aplicativo + acesso ao Supabase. Esperado: HTTP 200 e `{"status":"ready"}`.
- HTTP 503 com `degraded` não expõe detalhes. Consulte Sites e Supabase antes de alterar dados.

Cadência sugerida: verificar readiness a cada 5 minutos e alertar após 3 falhas consecutivas. Não use uma conta de usuário ou senha no monitor.

## Backup

1. Conferir no Supabase Dashboard > Database > Backups qual proteção está ativa e a retenção disponível no plano.
2. Manter um dump lógico periódico fora do repositório e criptografado. Nunca versionar a URL do banco, senha ou dump com dados pessoais.
3. Fazer cópia separada dos objetos dos buckets privados `trip-documents` e `trip-photos`. Backup do banco preserva metadados do Storage, mas não os bytes dos arquivos.
4. Manter as migrações deste repositório como fonte versionada de schema, funções e políticas.

## Teste de restauração

- Executar em um projeto Supabase novo, nunca diretamente sobre produção.
- Restaurar schema e dados; depois restaurar os objetos privados nos mesmos caminhos.
- Aplicar as variáveis públicas somente após conferir RLS e executar `supabase test db`.
- Validar login, viagem, gastos, checklist, foto, documento e download com contas de teste.
- Registrar data, responsável, duração, resultado e correções. Repetir trimestralmente.

## Resposta a incidente

1. Confirmar `/api/health` e `/api/health/readiness`.
2. Verificar Sites e, no Supabase, Logs Explorer e relatórios de Database, Auth, Storage, Realtime e API.
3. Se apenas o Supabase estiver degradado, evitar novas mutações e preservar evidências de horário/rota.
4. Se houver suspeita de acesso indevido, desativar o membro afetado, revisar audit logs e rotacionar credenciais administrativas — nunca a publishable key como se fosse segredo.
5. Restaurar somente depois de definir o ponto de recuperação e preservar uma cópia do estado anterior.

## Rotina mensal

- Conferir backups e retenção.
- Conferir falhas de readiness e logs 5xx.
- Revisar membros ativos e convites pendentes.
- Revisar crescimento dos buckets privados.
- Executar qualidade, testes de permissões e atualização segura de dependências.

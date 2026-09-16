# HNT-FINANCE-001 — Baseline do domínio financeiro

Versão 1.0; 2026-09-15; In Review. Owner: RubensCosta22.

O domínio organiza o teto de cada viagem, categorias e gastos efetivos em moeda-base única. `expenses` registra pagamentos positivos, com idempotência e estorno lógico. Valores não devem ser tratados como pagamentos antes de confirmação.

Workspace é a fronteira de acesso; membros ativos owner/admin operam conteúdo. Participantes da viagem são informativos e não conferem acesso. Autenticação no servidor e autorização/RLS no banco são cumulativas. Viagens arquivadas são somente leitura; histórico de mutações é auditado.

O saldo atual é orçamento menos pagamentos ativos. Projeção financeira de HNT-FINANCE-002 passa a combinar pagamentos ativos e previsões pendentes. Dashboard e estatísticas existentes continuam refletindo pagamentos. Previsão original deve permanecer comparável ao realizado, sem dupla contagem.

Locais possuem custos referenciais previstos/realizados, mas não são pagamentos automáticos. Na importação inicial, custos previstos geram registros financeiros vinculados uma vez. Nenhuma soma global combina as duas fontes.

Fonte técnica: migrations de finance, finance_integrity_hardening e archived_trip_read_only; src/features/finance; rota finance, dashboard, statistics e export. ADR-002 rege funções privadas e autorização. Nenhuma informação privada deve entrar no repositório público.

Critérios transversais: centavos exatos; atomicidade e idempotência; isolamento entre workspaces/viagens; sem duplicação na confirmação; totais independentes da paginação; exportação privada; falhas visíveis; UI acessível e responsiva. HNT-FINANCE-002 detalha testes e evolução proposta.

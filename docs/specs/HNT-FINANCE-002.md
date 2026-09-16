# HNT-FINANCE-002 — Valores previstos e realizados

- Produto: H&NTrip; versão da especificação: 1.1; data: 2026-09-15.
- Estado: In Development. Ready após revisão independente da v1.1 (arquivo de revisão).
- Owner e autoridade de produto/release: RubensCosta22.
- Risco: R3, pois cria persistência financeira privada, RLS e confirmação transacional.
- Orçamento de processo: até duas sessões focadas, sem dispensar controles.
- Base: RHC Tech SDD v1.3; ADR-002; HNT-PRODUCT-001; HNT-FINANCE-001.
- Aprovação funcional: solicitação do usuário nesta conversa. Revisão adversarial independente e aceitação dos riscos técnicos: pendentes.

## Problema e objetivo

Hoje o financeiro aceita apenas gastos realizados. As estimativas de Campos foram cadastradas nos custos previstos dos locais, sem um fluxo para confirmar o pagamento. O usuário precisa lançar uma previsão e depois informar o valor real no mesmo planejamento, preservando ambos para comparação.

## Escopo e regras de negócio

FR-01: No formulário financeiro, permitir escolher `Previsto` ou `Realizado`. Manter lançamento realizado direto para despesas não planejadas. Campos: descrição, categoria, estabelecimento opcional, data e valor. Valores monetários positivos com no máximo duas casas decimais.

FR-02: Um previsto possui valor e data estimados. Não altera gastos realizados, saldo real, estatísticas ou percentual utilizado. Pode ser cancelado antes de confirmação; cancelar remove sua contribuição das projeções e preserva histórico auditável.

FR-03: Em um previsto pendente, `Confirmar gasto` abre valor real (preenchido inicialmente com o previsto) e data do pagamento, ambos editáveis. A ação grava exatamente uma despesa e vincula a previsão em uma transação. Preservar o valor previsto original, mesmo quando o real difere.

FR-04: Mostrar, com rótulos distintos:

- Orçamento: teto da viagem.
- Previsto original: soma das previsões não canceladas, inclusive as confirmadas.
- Realizado: soma dos gastos não estornados, incluindo gastos sem previsão.
- Ainda previsto: soma das previsões não canceladas e sem pagamento ativo.
- Projeção final: realizado + ainda previsto.
- Margem projetada: orçamento - projeção final.

Não somar previsto confirmado e gasto correspondente na projeção. Gastos diretos não recebem retrospectivamente um valor previsto fictício.

FR-05: Na lista de previsões, mostrar descrição, categoria, data prevista, valor previsto, situação, valor real e diferença quando confirmado. Histórico de pagamentos continua mostrando os gastos efetivos. Mesmos valores nos totais com ou sem filtros/paginação; filtros afetam apenas a lista.

FR-06: Estornar um gasto confirmado preserva a estimativa e reabre o item como pendente. Nova confirmação gera um novo pagamento; repetição da mesma confirmação não duplica. Confirmação concorrente com valores distintos deve informar conflito, sem sobrescrever silenciosamente.

FR-07: Importar uma única vez os 14 custos previstos positivos dos locais/serviços de `Conhecendo Campos`, com categoria financeira correspondente e vínculo à origem. Validar quantidade e soma antes de gravar. Teto R$ 3.800; previsto R$ 3.562,17; realizado R$ 0; margem R$ 237,83, caso nenhum pagamento tenha sido lançado desde a preparação. Se os dados mudarem, reconciliar antes da importação.

Os R$ 300 de compras já incluem Boulevard, Macedo Soares, chocolates e lembranças. Prana permanece previsto em R$ 100 e pode ser cancelado. Não somar custos de locais novamente ao orçamento financeiro. Previsões importadas tornam-se os registros financeiros confirmáveis; o custo do local permanece referência, sem sincronização bidirecional implícita.

FR-08: Exportação privada inclui previsões e vínculo com os gastos. Atualização colaborativa inclui as previsões. Falha ao ler o planejamento deve mostrar indisponibilidade, nunca totais falsamente zerados.

Não inclui parcelamento, câmbio, rateio, conciliação bancária ou alteração de autenticação, participantes, roteiro e checklist.

## UX e acessibilidade

Entrada: viagem → Orçamento e gastos → novo lançamento. Escolha de tipo clara, com explicação curta. Preservar lançamento real direto e estilo atual do app.

Confirmação em formulário expansível dentro da previsão, com rótulos Valor realizado e Data do pagamento; mostrar o valor previsto ao lado. Botão desabilitado durante envio; erro mantém formulário e dados para correção. Sucesso atualiza lista e totais.

Previsões canceladas saem da lista ativa; nenhuma exclusão física de histórico. Valor realizado zero não representa uma compra gratuita: o usuário cancela a previsão.

Mobile: cartões e formulário em uma coluna, sem tabela horizontal obrigatória. Desktop: valores alinhados e formulário contextual. Usar HTML semântico, foco visível, operação por teclado, mensagens com role=status/alert, rótulos explícitos e situação indicada em texto, não apenas cor.

Estados obrigatórios: vazio, carregando/envio pendente, sucesso, validação, falha de leitura, falha de gravação, sem acesso e sem conexão. Não confirmar localmente em modo offline; informar que é necessário reconectar.

## Arquitetura e decisão

Adicionar `planned_expenses` sem alterar o significado de `expenses.amount`. Essa separação preserva os cálculos existentes de dashboard, estatísticas e gastos realizados. Não usar previsões como despesas de valor zero.

Campos propostos: id, workspace_id, trip_id, category_id, description, merchant, planned_date, planned_amount, confirmed_expense_id, source_place_id opcional, idempotency_key, created_at/by, updated_at/by e cancelled_at/by. FK composta deve assegurar que categoria, origem e pagamento pertencem à mesma viagem/workspace. Vínculo com despesa único; origem única para importação; chave de idempotência única por workspace.

Mutações atômicas em funções privadas, search_path vazio, autenticação e associação verificadas no banco. RPCs públicas SECURITY INVOKER delegam apenas às funções privadas autorizadas, conforme ADR-002. Reutilizar validações da criação de gasto e registrar eventos de auditoria. Travar a previsão antes de confirmar/cancelar e respeitar viagens arquivadas.

A tabela permite SELECT com RLS para membros ativos do workspace. Escritas somente pelas funções controladas. Revogar execução de PUBLIC e anon. Não aceitar workspace/autoria fornecidos pelo navegador. Usuário sem vínculo, vínculo inativo e outro workspace não podem ler ou modificar registros. Viagem arquivada é somente leitura. Não criar service-role key no frontend.

APIs: adicionar previsto, confirmar previsto, cancelar previsto. Repetições idênticas retornam resultado anterior; payload divergente para mesma chave falha. Estorno e confirmação precisam de ordem de bloqueio documentada para evitar corrida e deadlock.

## Privacidade, exportação e observabilidade

Dados: descrições, estabelecimento, datas e valores necessários ao planejamento privado. Acesso segue workspace. Armazenamento no Supabase existente; nenhuma nova integração ou coleta de cartões. Mesma retenção da viagem; cancelamento/estorno auditável e exportação dos dados financeiros. Backups seguem operação atual; não colocar dados pessoais da viagem em migrações ou commits públicos.

Auditar criação, confirmação, cancelamento e importação com IDs internos e resultado. Falhas devem ter mensagens úteis; logs técnicos não contêm descrição, credenciais, cookies ou conteúdo das reservas. Não tratar falha de consulta como lista vazia.

## Migração e implantação

Migração aditiva, sem apagar/reescrever gastos existentes. Índices por trip_id/data/id, categorias e vínculos. Manter clientes antigos compatíveis antes do deploy. Importação específica é operação de dados privada separada da migração de schema, com guardas de idempotência e transação.

Reversão operacional: reverter frontend, manter tabela e pagamentos confirmados; não apagar pagamentos nem executar down migration destrutiva. Se houver erro na importação, remover/cancelar apenas previsões criadas por essa importação e sem confirmação, após contagem e verificação. Restaurar acesso ao fluxo antigo de gastos durante recuperação.

## Controles aplicáveis e gates

Obrigatórios: especificação, critérios de aceite, revisão adversarial independente, arquitetura/ADR, segurança/RLS, privacidade, impacto de banco, reversão/remediação, falhas/auditoria, desempenho/confiabilidade, supply chain, rastreabilidade, regressão, UX manual, verificação pós-release e aceitação explícita de risco.

Sem nova dependência prevista; verificar lockfile e segredos no diff. Consultas paginadas; somas globais exatas sem limite implícito de 1.000 linhas. Meta: sem N+1; leitura financeira p95 inferior a 1s em teste com 1.000 previsões e 1.000 pagamentos. UI não deve enviar confirmação duplicada durante latência.

Legacy touch: financeiro e exportação materialmente afetados. Revisar baseline L1 e L0 antes da primeira mudança R3 conforme SDD 34. Não ampliar escopo para dívida alheia. Risco existente a tratar nesta superfície: totais obtidos com consulta sem paginação podem ser truncados pelo limite do Data API.

## Aceite e testes

| ID | Cenário | Resultado exigido |
|---|---|---|
| AC-01 | Criar previsão de R$ 500 | Previsto 500; realizado 0; projeção 500 |
| AC-02 | Confirmar em R$ 420 | Previsto 500; realizado 420; pendente 0; projeção 420; diferença -80 |
| AC-03 | Reenviar confirmação igual | Apenas um pagamento ativo |
| AC-04 | Confirmações concorrentes diferentes | Uma vence, outra recebe conflito; sem duplicação |
| AC-05 | Adicionar gasto direto de R$ 50 após AC-02 | Realizado/projeção 470; previsto permanece 500 |
| AC-06 | Estornar R$ 420 | Previsão volta a pendente; realizado 50; projeção 550 |
| AC-07 | Cancelar previsão pendente | Retirada da projeção; auditoria preservada |
| AC-08 | Outro workspace, anônimo ou vínculo inativo | Nenhuma leitura privada ou mutação permitida |
| AC-09 | Categoria/origem/pagamento de outra viagem | Rejeição no banco |
| AC-10 | Viagem arquivada | Nenhuma mutação permitida |
| AC-11 | Importação Campos repetida | Mesmos 14 previstos, soma 3.562,17; nenhum gasto inventado |
| AC-12 | Mais de 1.000 registros/filtros/paginação | Totais globais exatos; lista correta |
| AC-13 | Falha de consulta/gravação | Erro visível; sem sucesso falso ou total zero enganoso |
| AC-14 | Mobile/desktop/teclado | Formulários e confirmação utilizáveis sem sobreposição |
| AC-15 | Exportação/estorno/dashboard | Previsões exportadas; gastos legados e saldo real preservados |

Testes: unitários de cálculos/validação; integração transacional para confirmação/estorno/reenvio; permissões reais com papéis autenticados; teste concorrente; regressão do financeiro existente; build/typecheck/lint; inspeção visual mobile e desktop; verificação final das somas e do deploy.

## Revisão 1.1 — resoluções da revisão independente

M1: adicionar ledger `planned_expense_confirmations` imutável, com previsão, despesa, request_idempotency_key, valor real, data e autoria. Chave única por workspace. Cada nova confirmação intencional usa nova chave; retry usa a mesma. Retry de confirmação já estornada retorna erro específico `confirmation_reversed`, sem criar pagamento. Retry idêntico ativo retorna o mesmo pagamento; payload divergente é conflito. Conservar todos os vínculos históricos, além de confirmed_expense_id como referência ao último pagamento.

M2: todas as mutações novas travam viagem (FOR UPDATE), depois previsão, depois despesa. A RPC legada reverse_expense será substituída por wrapper invoker que aplica a mesma ordem e preserva assinatura/comportamento. Atualização do estado/arquivamento da viagem trava a mesma linha, serializando contra confirmação, cancelamento e criação. Revalidar estado após adquirir lock. Não mudar RPC add_expense nem demais domínios nesta entrega.

M3: nesta versão não há edição de previsão. Para corrigir previsão pendente, cancelar e recriar; a interface explica esse caminho. Confirmação permite editar apenas valor e data reais. Estorno reabre a previsão. Modificação do valor previsto original não é permitida.

M4: importação privada, fora da migration pública. Snapshot item a item inclui ID do local, updated_at, categoria mapeada, valor, nome e data resolvida. O importador trava viagem e origens e compara os dados ao snapshot revisado antes de gravar. Qualquer divergência ou pagamento existente não reconciliado aborta. `source_place_id` único impede duplicação, mesmo após cancelamento. Registrar batch ID em todas as linhas e auditoria; segunda execução não duplica. Remediação alcança apenas batch correto sem histórico de confirmação.

Precisão: numeric(14,2) no banco e agregação SQL, rejeitando zero/negativos, NaN, infinito, excesso de casas e overflow antes do cast. Moeda é a moeda-base da viagem no instante da criação; impedir confirmar em outra moeda. Não realizar câmbio. Enviar strings decimais à RPC. Previsões e ledger expõem somente SELECT por RLS, sem mutações diretas autenticadas.

Validação adicional obrigatória: retry antigo depois de estorno e reconfirmação; corrida confirmação×estorno×cancelamento×arquivamento; alteração de um item do snapshot compensada por outro preservando soma; source repetido; importação com pagamentos existentes. Projeção cancela corretamente Prana e recalcula a margem.

## Estado de prontidão

Escopo e regras descritos. Revisão independente da v1.1 concluída: todos os achados Major e Minor resolvidos; Ready para implementação. Usuário autorizou revisão independente e envio da branch nesta sessão. Revisão v1.0 concluída; v1.1 enviada para revalidação dos achados. Este documento não afirma testes executados nem aprovação técnica concluída.

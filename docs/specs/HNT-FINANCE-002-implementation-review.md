# HNT-FINANCE-002 — Revisão independente da implementação

- Data: 2026-09-16; revisor independente `/root/finance_spec_review`.
- Escopo: inspeção estática; nenhuma edição de código ou execução de testes nesta revisão. Implementador executa integração/concorrência/QA separadamente.
- Base Git: `4f843010a92f0f0ecfaf612c23cb6e636100f387`, alterações locais ainda não incorporadas nesse commit.
- Migration revisada: `supabase/migrations/20260915202234_planned_expenses.sql`, SHA-256 `e229a1142928c37cbbd424402e1d5dad2718d54cde757ddb0331985fa43d2f1e`.
- Actions revisadas: `src/features/finance/actions.ts`, SHA-256 `8924f1485136ba39cfacc7d260d5513731244e6e0a363386e2ded2937661d787`.
- Fontes adicionais: schema/formulários financeiros, página finance, migrations de autorização, financeiro e update_trip; HNT-FINANCE-002 v1.1 e revisão documental.

## Decisão

**Changes requested:** três Major; nenhum Blocker adicional identificado. A estrutura de autorização e confirmação é consistente com a especificação, mas os itens abaixo impedem aprovação para release nesta versão. Não houve deploy ou verificação em produção nesta revisão.

## Findings

### IM-01 — Major — Resumo financeiro usa snapshots distintos

`trip_finance_summary` é PL/pgSQL VOLATILE por omissão. Lê pendências e depois realizados em comandos separados. Se uma confirmação commitar entre as leituras, o primeiro comando pode incluir previsão pendente e o segundo incluir o pagamento correspondente, produzindo dupla contagem transitória na projeção. O inverso ocorre com estorno. Atomicidade do escritor não garante consistência desses leitores separados.

Correção: função read-only STABLE com snapshot único ou um único SELECT SQL agregado que produza todos os totais e orçamento sob a mesma visão. Não é necessário bloquear escritores para obter resumo. Testar consulta concorrente com confirmação/estorno e exigir que o resultado corresponda integralmente ao estado anterior ou posterior, jamais uma mistura.

### IM-02 — Major — Mudança da moeda-base altera o significado dos totais

`public.update_trip` permite alterar `base_currency`. A confirmação detecta `currency_changed`, mas o resumo soma previsões e despesas sem verificar moeda, e a página formata todos os valores na moeda-base atual. Exemplo: previsão criada BRL 500, mudar viagem para USD: tela passa a apresentar USD 500 sem conversão. FR exclui câmbio.

Correção limitada à fronteira tocada: impedir no banco mudança de moeda-base enquanto existem registros financeiros vinculados, inclusive histórico relevante, ou detectar incompatibilidade no resumo e exibir indisponibilidade explícita em vez de valores falsos. Impedimento deve abranger RPC e UPDATE permitido pelo banco. Testar previsão existente, gasto existente e mudança concorrente com criação/confirmação; preservar mudança de moeda em viagem sem registros quando válida.

### IM-03 — Major — Reset automático do formulário rompe retenção e chave de retry

`ConfirmExpenseForm` e `ExpenseForm` usam inputs não controlados e guardam a chave somente no valor de um input oculto. As actions retornam `{status: 'error'}` normalmente; React considera a action concluída e reseta inputs não controlados, sem interpretar esse status de domínio. Assim o valor real/data retornam ao default e a chave oculta pode ser apagada. Um retry de criação após resposta de erro ambígua pode gerar nova chave e duplicar gasto/previsão já persistido.

Fundamento: comportamento documentado do [form do React](https://react.dev/reference/react-dom/components/form). Achado estático; confirmar no QA do runtime vinext/React usado pelo projeto.

Correção: manter campos controlados ou devolver/restaurar explicitamente os valores; conservar chave por tentativa lógica em estado/ref de JavaScript independente do DOM e repassar no form. Erro deve manter chave, valor e data; novo lançamento intencional recebe nova chave. Testar erro de validação retornado e resposta ambígua após commit seguida de retry, assegurando um único registro e dados preservados.

## Aspectos favoráveis inspecionados

- Ordem viagem → previsão → despesa é consistente entre confirmação, cancelamento e estorno; lock da viagem serializa operações novas e UPDATE de arquivamento.
- Retry antigo de confirmação consulta ledger imutável; pagamento estornado produz `confirmation_reversed`, sem criação de novo pagamento. Chave distinta não sobrescreve confirmação ativa.
- Pagamento interno recebe chave própria, impedindo reutilização de pagamento direto por chave escolhida no navegador.
- FKs compostas restringem vínculos a mesma viagem/workspace; ledger conserva confirmações anteriores e referência atual permite reabrir após estorno.
- RLS SELECT nas tabelas novas, DML autenticado revogado; funções privadas têm search_path vazio, sessão e associação verificadas. Wrappers públicos são invoker. Grant EXECUTE privado ao authenticated é compatível com delegação invoker; não elimina checagens internas.
- Actions autenticam membro; banco deriva propriedade/autoria e não confia no tripId de redirecionamento para autorização.
- Valores positivos, limite numérico e precisão são verificados antes de armazenamento; agregação SQL remove truncamento de 1.000 linhas.

## Riscos/limitações e evidências pendentes

Não há revisão da importação nesta rodada: ela é operação privada separada e deve cumprir snapshot/batch/reconciliação previstos. Não se afirma teste de RLS, concorrência, exportação ou renderização executado. Aprovação posterior exige correção/disposição dos Major e evidências dos gates do plano, incluindo permissões reais, retry após estorno/reconfirmação, arquivamento concorrente, falhas preservando formulário e contagens financeiras exatas.

## Revalidação e extensão de escopo solicitada — 2026-09-16

Revisor inspecionou correções e, a pedido do implementador, importador e exportação financeira. Os testes PGlite informados pelo implementador não foram reexecutados por este revisor.

Artefatos reavaliados (SHA-256):

- Migration: `ca2a2f0d77a222848873a02d09f1cf5b6eed48d3ff1e4c2ba05c9d91f1433568`.
- ExpenseForm: `3cbb99d5f15439095d5038d389d673d67d5618c5e4b30333b864f51bffba1760`.
- ConfirmExpenseForm: `438d778187e0bc85d2c89807a321262a3bffaa0ee3075fd1ba2fbcb68126b3e6`.
- Importador: `cefb0ad555d608b484a79c2c88e4d81681d6295f80fadfcd2ce2f451a4c89ac1`.

| ID | Disposição |
|---|---|
| IM-01 | Resolvido estaticamente: summary STABLE usa snapshot do comando chamador. |
| IM-02 | Resolvido na superfície nova: trigger impede relabel de moeda com histórico financeiro; summary recusa mismatch existente. Criação direta legada concorrente permanece protegida contra total enganoso pelo mismatch check. |
| IM-03 | Resolvido estaticamente: campos controlados e chave persistida em useRef independente do reset DOM. QA de erro/retry continua obrigatório. |

### IM-04 — Major — Delimitador SQL fixo permite conteúdo quebrar o importador

`scripts/import-place-estimates.mjs` interpola JSON no corpo `DO $import$ ... $import$`. Escapar aspas simples não escapa o delimitador externo de dollar quoting. Um nome ou outro texto que contenha literalmente `$import$` encerra antecipadamente o corpo SQL; conteúdo adicional pode quebrar ou alterar o comando administrativo gerado. A origem é dado da viagem, não código confiável.

Correção: codificar o JSON como hex/base64 e decodificar no SQL, ou escolher delimitador que comprovadamente não aparece em nenhum conteúdo interpolado. Evitar interpolação de texto não validado fora desse mecanismo. Teste obrigatório com nomes contendo aspas, barras, quebras de linha e `$import$`; todos devem continuar dados literais, sem alterar estrutura SQL. O comportamento rollback padrão é favorável, mas não neutraliza alteração da estrutura do script.

### IM-05 — Major — Exportação paginada não representa conjunto financeiro consistente

`financeRows` usa OFFSET ordenado por UUID. Inserir uma linha com UUID anterior ao limite entre duas páginas desloca índices: pode repetir registro e omitir o novo. Além disso, expenses, previsões e confirmações são lidas em operações concorrentes independentes. Uma confirmação entre leituras pode aparecer sem seu pagamento ou produzir estados incompatíveis entre previsão e ledger. Isso compromete o vínculo exportável prometido e histórico financeiro exato, mesmo quando cada consulta individual passa.

Correção preferencial: RPC STABLE read-only que retorne apenas a seção financeira completa em uma snapshot, com agregação JSON no servidor para contornar limite Data API. Alternativamente materializar snapshot transacional e paginar esse snapshot. Keyset isoladamente reduz duplicação, mas não resolve coerência entre tabelas. Preservar autorização/RLS e falha explícita. Testar >1.000 linhas e confirmação/estorno concorrentes; cada despesa/confirmacão exportada deve ter seu vínculo, sem IDs duplicados.

Aspectos favoráveis do importador: rollback por padrão, validação item a item e categoria, total/quantidade, origem única, batch, recusa de finanças não reconciliadas, lock SHARE de expenses e NOWAIT na viagem evitando esperar enquanto outra confirmação segura viagem. Rerun de batch verifica equivalência sem recriar cancelados. Exportação preserva histórico estornado e usa headers privados.

**Decisão atual: Changes requested por IM-04 e IM-05.** Os três findings anteriores estão fechados estaticamente; não reabertos. Nenhuma mudança de código feita por este revisor.

## Disposição final dos findings — 2026-09-16

Após nova inspeção independente das correções solicitadas:

| ID | Disposição final | Evidência estática |
|---|---|---|
| IM-04 | Resolvido | JSON agora é codificado UTF-8 em hex antes de interpolação; `decode`/`convert_from` recuperam dados dentro do SQL. Dados livres não podem conter delimitador externo no texto executável. Demais interpolações permanecem limitadas por validação UUID, decimal e moeda. |
| IM-05 | Resolvido | `trip_finance_export` é STABLE SECURITY INVOKER, autentica e depende de RLS, agrega despesas ativas, histórico completo, previsões e confirmações na mesma snapshot. A rota usa essa RPC, sem paginação OFFSET da seção financeira. |

Hashes desta aprovação:

- Importador: `0556c878cd85eea2b488de91254d48479a77642dea0f0e2c2971b3f050471142`.
- Migration: `641007b9012e7e34161a3d98101b3e32394dbc25de286ebda17ceeeaa928bd83`.
- Export route: `c06092772bd774e5dace766158083aad9d142455aa6210615ebdf08aa28bf44c`.

**Approved na revisão independente da implementação: nenhum Blocker/Major permanece aberto entre IM-01 e IM-05.** A validação de UI/layout continua com o implementador, sem nova inspeção nesta rodada. Os resultados relatados de testes locais (1.004 previsões exportadas, importação com delimitador, RLS, retry e estorno) devem ser anexados pelo executor às evidências; este revisor não os executou. Gates CI/concorrência, QA e verificação pós-release continuam exigíveis. Esta disposição fecha os findings técnicos e não afirma publicação ou testes executados pelo revisor.

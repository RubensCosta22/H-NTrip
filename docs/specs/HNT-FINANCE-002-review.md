# HNT-FINANCE-002 — Revisão adversarial independente

- Data: 2026-09-15.
- Revisor: agente independente `/root/finance_spec_review`, contexto separado do autor/implementador, acionado após autorização explícita do usuário. Não escreveu a especificação nem implementou a solução.
- Tipo: revisão documental e inspeção estática dos contratos legados; nenhum teste de runtime ou acesso ao banco foi executado.
- Artefato: HNT-FINANCE-002 v1.0, SHA-256 `40e9b5b45dd8c4ead099b34f2a7f69f13c1b1dc8eebb3afeef264caff69b689f`.
- Baselines: HNT-FINANCE-001 `63429de134ac14d8fa0a15c5c9fc23e2c7cb658f5f9e36f9aeea4d6852ad9e03`; HNT-PRODUCT-001 `6eb1d3762c33c8cb03fb5a257e811a78777f46201c261a177e1702a92972bcdd`.
- Código-base: `4f843010a92f0f0ecfaf612c23cb6e636100f387`; fontes adicionais: docs/engineering/README.md, ADR-002 e migrations finance, finance_integrity_hardening, archived_trip_read_only.

## Decisão

**Changes requested.** A separação entre previsto e realizado é apropriada e a especificação trata isolamento, totais globais e importação com boa cobertura. Os quatro achados Major abaixo precisam de disposição explícita antes de Ready. Não há Blocker independente dos Major registrados. Esta revisão não equivale a aprovação de release ou evidência de testes.

## Achados

### M1 — Major — Vínculo histórico e reenvio após estorno incompletos

FR-06 exige reabrir, reconfirmar e exportar histórico; o único `confirmed_expense_id` proposto perde o vínculo anterior quando é substituído. Também falta definir o que acontece quando chega um retry da primeira confirmação depois de estornar ou reconfirmar: não pode reabrir um pagamento estornado nem confirmar novamente implicitamente.

Correção: persistir vínculo imutável de cada pagamento à previsão, por FK na despesa ou tabela de confirmações, com no máximo um pagamento ativo. Guardar chave e payload normalizado por confirmação; retry antigo retorna o resultado histórico e seu estado atual, nunca cria novo gasto. Nova confirmação exige chave nova. Acrescentar aceite: confirmar A → estornar A → confirmar B → repetir A; B permanece ativo, ambos os vínculos exportáveis. Testar também repetição de A entre estorno e B.

### M2 — Major — Protocolo concorrente precisa incluir o estorno legado e arquivamento

O texto pede ordem de bloqueio, mas não a define. A função legada `public.reverse_expense` atualiza apenas expenses; não bloqueia previsão nem reabre seu vínculo. O trigger legado de arquivamento somente lê a viagem. Reutilizar esses contratos sem ajuste pode deixar estado confirmado apontando a despesa estornada ou permitir corrida entre arquivamento e confirmação.

Correção: definir ordem única, por exemplo viagem → previsão → despesa, para confirmar, cancelar e estornar, incluindo a RPC antiga. Toda mutação financeira deve obter lock de viagem compatível com leitura e conflitante com arquivamento e validar estado após o lock. Documentar como despesas diretas entram no protocolo. Acrescentar aceites para confirmar×estornar, confirmar×cancelar, estornar×estornar, confirmar×arquivar; exigir nenhuma duplicação, nenhum estado incoerente e nenhum deadlock no teste dirigido. Manter endpoints legados compatíveis como wrappers autorizados conforme ADR-002.

### M3 — Major — Edição prometida sem contrato

FR-07 chama as previsões de editáveis; APIs somente adicionam, confirmam e cancelam. FR-03 preserva o valor original, mas o esquema só tem `planned_amount`. Não fica claro se editar altera o baseline, quais campos podem mudar, nem como impedir confirmação com versão antiga.

Correção: escolher e registrar contrato explícito. Opção mínima: previsões são imutáveis após criação, correções usam cancelar e criar nova, mantendo histórico; remover promessa de edição. Caso edição seja parte do escopo, definir valor original versus atual, permissão por estado, RPC, versionamento otimista e auditoria. Acrescentar aceite para alteração/correção e confirmação concorrente com formulário desatualizado.

### M4 — Major — Importação precisa validar identidade, não só quantidade e soma

Quantidade 14 e soma 3.562,17 não comprovam que são os mesmos itens. Há despesas existentes e alterações de fontes que podem preservar ambos os totais. A cláusula “reconciliar” não fornece decisão executável para evitar dupla previsão ou sobreposição com gastos diretos.

Correção: identificar viagem/workspace por IDs verificados em operação privada; validar snapshot item a item (origem, valor, categoria/mapeamento, versão ou updated_at), além de quantidade/soma, sob transação. Interromper em divergência de fontes ou existência de pagamentos sem reconciliação explícita; não inferir vínculos por descrição/valor. Retry deve validar equivalência das fontes já importadas sem recriar previsões canceladas. Registrar batch/import ID auditável. Acrescentar aceites para alteração com mesma soma, corrida de importações, pagamento existente e retry após cancelamento.

### m1 — Minor — Fórmula de pendências deve excluir cancelados expressamente

FR-02 é correto, mas “soma das previsões sem pagamento ativo” em FR-04 inclui literalmente cancelados. Especificar `cancelled_at IS NULL AND sem pagamento ativo`; incluir exemplo com item cancelado jamais confirmado e item estornado depois cancelado.

### m2 — Minor — Precisão e moeda na fronteira

Os baselines exigem centavos exatos; formalizar armazenamento/cálculo decimal ou centavos inteiros, limites máximos, moeda-base da viagem e rejeição de mais de duas casas antes de coerção SQL (numeric com escala pode arredondar). Cobrir entrada brasileira, valor negativo/zero, precisão excedente e overflow nos testes.

### AR1 — Accepted Risk — Fonte de local sem sincronização

O custo referencial do local pode divergir da previsão financeira após importação. É uma consequência aceitável do escopo, explicitamente assumida em FR-07, desde que UI explique a fonte financeira e não some ambas. Esta classificação é recomendação técnica do revisor; não afirma nova aceitação de risco pelo usuário.

## Autorização, controles e evidências futuras

RLS por associação ativa, autoria derivada da sessão e FKs compostas estão adequadamente exigidas. Incluir nos testes usuário autenticado sem associação, membro inativo, owner/admin permitido, DML direto negado, RPC com IDs de outro workspace e SELECT/exportação de outro workspace negados. Ausência de grants não substitui RLS; wrappers invoker não substituem validação dentro das funções privadas.

Baselines descrevem corretamente o domínio, mas permanecem In Review e não demonstram L0/L1 executado. Registrar evidência efetiva da inspeção e disposição dos riscos tocados, sem chamar baseline documental de auditoria completa. Verificar controles centrais aplicáveis antes de Ready; esta revisão não consultou o padrão central remoto.

Depois de corrigir o documento, registrar hash da versão revisada e disposição por ID. Implementação e release exigem os testes, permissões reais, concorrência, exatidão acima de 1.000 linhas, exportação, QA móvel/desktop e pós-release que a própria especificação lista.

## Revalidação independente — versão 1.1

- Data: 2026-09-15; mesmo revisor independente, sem autoria da implementação.
- Artefato reavaliado: HNT-FINANCE-002 v1.1, SHA-256 `5af58cfb6e0f0cd82ec5e93b96495587d5053c1360571a8d41458998b27a08ca`.
- Decisão: **Approved for implementation / Ready do ponto de vista desta revisão independente.** Não constitui autorização de release nem afirma gates executados.

| ID | Disposição | Fundamentação |
|---|---|---|
| M1 | Resolvido na especificação | Ledger imutável conserva cada vínculo; chave por tentativa e erro explícito `confirmation_reversed` impedem retry antigo de ressuscitar gasto. O erro é alternativa válida ao retorno histórico sugerido. |
| M2 | Resolvido no escopo tocado | Ordem viagem → previsão → despesa definida; estorno legado ganha wrapper compatível; revalidação após lock e teste das corridas exigidos. A revisão não exige refatorar criação de gastos diretos ou outros domínios. |
| M3 | Resolvido | Previsão imutável; cancelamento e recriação são o caminho explícito de correção. Valor/data reais seguem editáveis na confirmação. |
| M4 | Resolvido na especificação | Snapshot item a item, locks, origem única, abortar divergências/pagamentos não reconciliados e batch auditável formalizados. |
| m1 | Resolvido | FR-04 agora exclui expressamente cancelados de Ainda previsto. |
| m2 | Resolvido | Precisão, limites, rejeição antes do cast, moeda-base e transporte decimal especificados. |
| AR1 | Mantido como decisão de escopo | Fontes separadas sem sincronização bidirecional continuam explícitas; não há risco novo introduzido pela revisão. |

Nenhum Major ou Blocker documental permanece aberto. Os baselines HNT-FINANCE-001 e HNT-PRODUCT-001 são coerentes com o desenho revisado e podem acompanhar o estado Ready no escopo deste incremento. Isso não transforma documentos em evidência de auditoria L0/L1: o registro de inspeção e os gates aplicáveis continuam necessários.

Observação de verificação do M4: como `add_expense` legado não será alterado, travar somente a viagem não bloqueia por si só um gasto direto concorrente. A operação privada de importação deve impedir essa janela por serialização apropriada da leitura de despesas ou por janela operacional controlada, com leitura final de reconciliação. Essa escolha pertence à implementação da importação; não exige ampliar o escopo do fluxo legado. Não executar importação se houver gasto não reconciliado.

Mudanças meramente administrativas de estado/hash após esta revalidação não alteram a aprovação; mudanças de contrato, autorização, fórmulas ou concorrência exigem nova revisão. Testes transacionais, permissões e QA permanecem pendentes e obrigatórios antes de release.

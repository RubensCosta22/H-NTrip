# Validação da versão 1 — permissões e fluxos

## Contas de teste

- Conta A: owner do workspace.
- Conta B: admin ativa.
- Use janelas anônimas diferentes. Nunca compartilhe senhas ou códigos de acesso.

## Conta owner

1. Entrar, abrir a viagem e confirmar acesso a todas as seções.
2. Criar e editar um item em roteiro, gastos, checklist, documentos, fotos e locais.
3. Arquivar e restaurar uma foto, um documento e um local.
4. Abrir Configurações > Acessos e confirmar que consegue convidar e desativar admins.
5. Abrir Histórico e confirmar que as ações anteriores aparecem com o ator correto.

## Conta admin

1. Entrar e confirmar que visualiza a mesma viagem e os registros do workspace.
2. Criar e editar um item de planejamento.
3. Confirmar que consegue enviar e baixar arquivos privados.
4. Abrir Configurações > Acessos e confirmar que não consegue convidar, revogar convites ou remover membros.

## Revogação

1. Como owner, desativar temporariamente uma conta admin descartável.
2. Na sessão já aberta da conta admin, atualizar uma rota protegida.
3. Resultado esperado: acesso interrompido; dados e arquivos do workspace não devem ser exibidos.
4. Reative a conta admin por um novo convite somente se desejar continuar usando essa conta.

## Isolamento

1. Nunca altere IDs manualmente em produção.
2. A suíte `supabase test db` verifica RLS forçado, grants e RPCs privilegiadas em ambiente local descartável.
3. Downloads e imagens devem exigir sessão ativa e usar URLs privadas temporárias.

## Critério de aprovação

- Nenhum usuário anônimo acessa dados privados.
- Admin ativa trabalha no conteúdo, mas não gerencia membros.
- Membro desativado perde acesso na próxima atualização.
- Todas as ações críticas aparecem no histórico.
- Upload, download, arquivamento e restauração funcionam nas duas contas autorizadas.

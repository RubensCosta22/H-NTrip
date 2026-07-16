# Registro de lançamento — H&NTrip 1.0.0

Data: 16 de julho de 2026  
Ambiente: produção  
Status: aprovado para uso privado

## Portões concluídos

- Fluxos funcionais validados pelo responsável do projeto.
- Permissões de owner e admin validadas com contas separadas.
- Upload, download, edição, arquivamento e restauração validados.
- Interface móvel revisada.
- Liveness e readiness retornando HTTP 200.
- Qualidade, tipos, build e 55 testes aprovados antes do corte.
- Migrações necessárias aplicadas ao Supabase de produção.

## Escopo congelado

O escopo da versão 1.0 é o descrito no `CHANGELOG.md`. Novas funcionalidades entram em versões posteriores; correções urgentes usam `1.0.x`.

## Rollback

1. Interromper novas alterações e registrar o horário do incidente.
2. Reimplantar a última versão estável do Sites quando o problema for apenas no aplicativo.
3. Não reverter migrações destrutivamente. Criar correção forward-only.
4. Para perda de dados, restaurar primeiro em projeto Supabase separado e validar RLS, Auth e Storage.
5. Confirmar health, readiness e fluxos críticos antes de reabrir o uso.

## Próximas versões

- `1.0.x`: correções de estabilidade e segurança.
- `1.1`: notificações e melhorias operacionais.
- `2.0`: experiência offline e sincronização ampliada.

# Changelog

## 1.0.0 — 2026-07-16

Primeiro lançamento estável do H&NTrip.

### Incluído

- acesso privado com owner/admin e auditoria;
- ciclo completo de planejamento de viagem;
- finanças, checklists, documentos, fotos e locais;
- álbum, estatísticas, alertas, exportação e histórico;
- upload/download privado, edição, arquivamento e restauração;
- filtros, paginação, sincronização resiliente e experiência móvel;
- testes de RLS/permissões, readiness e guias operacionais.

### Segurança e privacidade

- RLS forçado nas tabelas expostas;
- mutações críticas por RPCs auditadas;
- arquivos privados e acesso temporário;
- nenhuma coleta automática de geolocalização;
- endpoints de saúde sem dados de usuário ou workspace.

### Limitações conhecidas

- alterações offline completas não são sincronizadas;
- notificações push/e-mail ainda não são enviadas;
- backups dos objetos de Storage exigem rotina separada;
- testes de desativação devem usar conta descartável.

# HNT-PRODUCT-001 — Baseline do produto e arquitetura

Versão 1.0; 2026-09-15; In Review. Owner: RubensCosta22.

H&NTrip é um aplicativo privado colaborativo para planejar viagens e organizar participantes, roteiro, locais, orçamento, gastos, checklists, documentos e memórias. Não processa pagamentos bancários. A viagem contém datas, destino, fuso, moeda-base, orçamento e estado de ciclo de vida.

Workspace é a fronteira de dados e acesso. Owner administra membros e convites; admin trabalha no conteúdo. Participantes são dados informativos. Toda operação privada exige autenticação e associação ativa no servidor e banco. Viagens arquivadas preservam histórico e impedem mutações até restauração.

Arquitetura existente: React/rotas compatíveis Next executadas com vinext; Supabase Auth/PostgreSQL/Storage e Realtime seletivo; deploy externo configurado no projeto. ADR-001 e ADR-002 permanecem fontes técnicas. Nenhuma mudança de hosting faz parte da evolução financeira.

Documentos e fotos são privados, com acesso temporário; exportações exigem autorização e auditoria. Evitar senhas, cartões e credenciais em dados, logs e repositório. Manter isolamento, auditabilidade, backup/remediação, acessibilidade e suporte móvel durante a viagem.

Estado: consolidação do comportamento descrito no README, guia, ADRs e migrations. Não equivale a auditoria completa do legado. Primeiro incremento R3 desta sessão: HNT-FINANCE-002, com revisão independente e gates próprios antes da implementação e release. RHC Tech SDD v1.3 é autoridade de governança.

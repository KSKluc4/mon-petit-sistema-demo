-- POR QUE ESTA MIGRATION EXISTE — LEIA ANTES DE MEXER
--
-- Ela repete, palavra por palavra, o que `20260728142124_valor_livre_por_atendimento`
-- já havia feito. Não é duplicação por engano: a migration original foi aplicada em
-- produção em 28/07/2026 e depois DESFEITA no banco por uma migration local
-- (`20260729180000_restaura_valor_padrao_servico`) que nunca chegou ao GitHub.
--
-- Como dev e produção compartilham o MESMO banco Neon, aquela reversão local
-- derrubou o schema de produção sem que nenhum deploy percebesse: o
-- `_prisma_migrations` continuava marcando `valor_livre_por_atendimento` como
-- aplicada, então `prisma migrate deploy` via "nada pendente" e não corrigia nada.
-- O resultado foi código novo contra schema velho, e TODO INSERT que dependia
-- de valor nulo passou a estourar `23502 not-null violation`:
--   - criar agendamento (valorTotal nulo e valorCobrado nunca enviado)
--   - fechar atendimento com "Receber depois" (valorTotal nulo)
--   - "+ Novo serviço" e o seed (valorPadrao inexistente no código)
--
-- `Servico.valorPadrao` foi removido A PEDIDO DA CLIENTE: o preço varia por
-- cachorro, então serviço não tem preço fixo — o valor é livre por atendimento.
-- NÃO recrie esta coluna e não "reconcilie" o banco nessa direção. Se encontrar
-- o banco divergindo do schema, rode `git fetch` primeiro e PERGUNTE.
-- Ver CLAUDE.md → "Regra permanente: valor livre por atendimento".

-- AlterTable
ALTER TABLE "Agendamento" ALTER COLUMN "valorTotal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AgendamentoServico" ALTER COLUMN "valorCobrado" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Atendimento" ALTER COLUMN "valorTotal" DROP NOT NULL;

-- AlterTable
-- A coluna só existe porque a reversão local a recriou e a repovoou com valores
-- placeholder (7000, 6000, 3500...) inventados por ela — não há preço real a perder.
ALTER TABLE "Servico" DROP COLUMN IF EXISTS "valorPadrao";

-- Regime de caixa: o faturamento passa a contar pela data em que o dinheiro
-- entrou, não pela data do atendimento. As duas só diferem quando o atendimento
-- foi fechado com "Receber depois" e o pagamento veio noutro dia.
--
-- Migration puramente aditiva (expand): nenhuma coluna sai e nada vira NOT NULL,
-- então o código anterior continua rodando contra este schema.

-- AlterTable
ALTER TABLE "Atendimento" ADD COLUMN     "dataRecebimento" TIMESTAMP(3);

-- Backfill. Estabelece a invariante `formaPagamento != null <=> dataRecebimento
-- != null` nas linhas que já existem: todo atendimento já pago foi pago no
-- fechamento, então a data do recebimento é a do próprio atendimento.
--
-- É isto que dispensa um COALESCE em toda consulta de faturamento — e sem ele
-- todo histórico já pago sairia do faturamento no primeiro deploy.
UPDATE "Atendimento"
   SET "dataRecebimento" = "data"
 WHERE "formaPagamento" IS NOT NULL
   AND "dataRecebimento" IS NULL;

-- CreateIndex
CREATE INDEX "Atendimento_dataRecebimento_idx" ON "Atendimento"("dataRecebimento");

-- CreateIndex
CREATE INDEX "Atendimento_data_idx" ON "Atendimento"("data");

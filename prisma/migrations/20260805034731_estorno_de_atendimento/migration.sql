-- CreateTable
CREATE TABLE "AtendimentoEstorno" (
    "id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "feitoPor" TEXT NOT NULL,
    "feitoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxaBps" INTEGER,
    "atendimentoId" TEXT NOT NULL,
    "formaId" TEXT,

    CONSTRAINT "AtendimentoEstorno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtendimentoEstorno_atendimentoId_idx" ON "AtendimentoEstorno"("atendimentoId");

-- CreateIndex
CREATE INDEX "AtendimentoEstorno_data_idx" ON "AtendimentoEstorno"("data");

-- AddForeignKey
ALTER TABLE "AtendimentoEstorno" ADD CONSTRAINT "AtendimentoEstorno_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtendimentoEstorno" ADD CONSTRAINT "AtendimentoEstorno_formaId_fkey" FOREIGN KEY ("formaId") REFERENCES "FormaPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

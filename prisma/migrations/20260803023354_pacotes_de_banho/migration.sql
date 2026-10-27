-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "pacoteId" TEXT;

-- CreateTable
CREATE TABLE "Pacote" (
    "id" TEXT NOT NULL,
    "banhosTotal" INTEGER NOT NULL,
    "valorTotal" INTEGER NOT NULL,
    "dataCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validadeAte" TIMESTAMP(3) NOT NULL,
    "vendidoPor" TEXT NOT NULL,
    "observacoes" TEXT,
    "formaId" TEXT NOT NULL,
    "parcelas" INTEGER,
    "taxaBps" INTEGER,
    "dataRecebimento" TIMESTAMP(3) NOT NULL,
    "petId" TEXT NOT NULL,

    CONSTRAINT "Pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacoteConsumo" (
    "id" TEXT NOT NULL,
    "indice" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pacoteId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,

    CONSTRAINT "PacoteConsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacoteEstorno" (
    "id" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "feitoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taxaBps" INTEGER,
    "pacoteId" TEXT NOT NULL,
    "formaId" TEXT,

    CONSTRAINT "PacoteEstorno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pacote_petId_idx" ON "Pacote"("petId");

-- CreateIndex
CREATE INDEX "Pacote_dataRecebimento_idx" ON "Pacote"("dataRecebimento");

-- CreateIndex
CREATE UNIQUE INDEX "PacoteConsumo_atendimentoId_key" ON "PacoteConsumo"("atendimentoId");

-- CreateIndex
CREATE INDEX "PacoteConsumo_pacoteId_idx" ON "PacoteConsumo"("pacoteId");

-- CreateIndex
CREATE UNIQUE INDEX "PacoteConsumo_pacoteId_indice_key" ON "PacoteConsumo"("pacoteId", "indice");

-- CreateIndex
CREATE INDEX "PacoteEstorno_pacoteId_idx" ON "PacoteEstorno"("pacoteId");

-- CreateIndex
CREATE INDEX "PacoteEstorno_data_idx" ON "PacoteEstorno"("data");

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "Pacote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pacote" ADD CONSTRAINT "Pacote_formaId_fkey" FOREIGN KEY ("formaId") REFERENCES "FormaPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pacote" ADD CONSTRAINT "Pacote_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteConsumo" ADD CONSTRAINT "PacoteConsumo_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "Pacote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteConsumo" ADD CONSTRAINT "PacoteConsumo_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteEstorno" ADD CONSTRAINT "PacoteEstorno_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "Pacote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteEstorno" ADD CONSTRAINT "PacoteEstorno_formaId_fkey" FOREIGN KEY ("formaId") REFERENCES "FormaPagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

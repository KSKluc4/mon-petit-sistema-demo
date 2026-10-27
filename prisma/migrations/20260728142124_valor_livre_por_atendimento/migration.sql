/*
  Warnings:

  - You are about to drop the column `valorPadrao` on the `Servico` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agendamento" ALTER COLUMN "valorTotal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AgendamentoServico" ALTER COLUMN "valorCobrado" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Atendimento" ALTER COLUMN "valorTotal" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Servico" DROP COLUMN "valorPadrao";

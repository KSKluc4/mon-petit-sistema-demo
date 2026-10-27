-- AlterTable
ALTER TABLE "Atendimento" ADD COLUMN     "recebidoPor" TEXT,
ADD COLUMN     "recebidoPorId" TEXT,
ADD COLUMN     "responsavelId" TEXT;

-- AlterTable
ALTER TABLE "Pacote" ADD COLUMN     "vendidoPorId" TEXT;

-- AlterTable
ALTER TABLE "PacoteEstorno" ADD COLUMN     "feitoPorId" TEXT;

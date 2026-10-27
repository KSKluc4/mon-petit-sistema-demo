-- CreateEnum
CREATE TYPE "Especie" AS ENUM ('CAO', 'GATO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MACHO', 'FEMEA');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('AGENDADO', 'EM_ATENDIMENTO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EtapaAtendimento" AS ENUM ('BANHO_FINALIZADO', 'TOSA_FINALIZADA', 'PET_PRONTO', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'OUTRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "endereco" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "especie" "Especie" NOT NULL,
    "raca" TEXT NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "dataNascimento" TIMESTAMP(3),
    "pesoKg" DOUBLE PRECISION,
    "observacoes" TEXT,
    "padraoPet" TEXT,
    "clienteId" TEXT NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorPadrao" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'AGENDADO',
    "etapa" "EtapaAtendimento",
    "observacoes" TEXT,
    "valorTotal" INTEGER NOT NULL,
    "petId" TEXT NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendamentoServico" (
    "id" TEXT NOT NULL,
    "valorCobrado" INTEGER NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,

    CONSTRAINT "AgendamentoServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atendimento" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "servicosRealizados" TEXT NOT NULL,
    "valorTotal" INTEGER NOT NULL,
    "responsavel" TEXT NOT NULL,
    "formaPagamento" "FormaPagamento",
    "observacoes" TEXT,
    "agendamentoId" TEXT NOT NULL,

    CONSTRAINT "Atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");

-- CreateIndex
CREATE INDEX "Pet_clienteId_idx" ON "Pet"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Servico_nome_key" ON "Servico"("nome");

-- CreateIndex
CREATE INDEX "Agendamento_petId_idx" ON "Agendamento"("petId");

-- CreateIndex
CREATE INDEX "Agendamento_dataHora_idx" ON "Agendamento"("dataHora");

-- CreateIndex
CREATE UNIQUE INDEX "AgendamentoServico_agendamentoId_servicoId_key" ON "AgendamentoServico"("agendamentoId", "servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "Atendimento_agendamentoId_key" ON "Atendimento"("agendamentoId");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoServico" ADD CONSTRAINT "AgendamentoServico_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendamentoServico" ADD CONSTRAINT "AgendamentoServico_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

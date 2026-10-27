-- CreateTable
CREATE TABLE "RegistroAtividade" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "descricao" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,

    CONSTRAINT "RegistroAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroAtividade_criadoEm_idx" ON "RegistroAtividade"("criadoEm");

-- CreateIndex
CREATE INDEX "RegistroAtividade_entidade_entidadeId_idx" ON "RegistroAtividade"("entidade", "entidadeId");

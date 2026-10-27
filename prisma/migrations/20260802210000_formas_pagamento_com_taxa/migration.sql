-- Forma de pagamento vira TABELA, com taxa editável e snapshot por venda.
--
-- Antes era um enum genérico (Dinheiro/Pix/Crédito/Débito/Outro) e o sistema não
-- sabia quanto realmente caía na conta. Cada bandeira cobra uma taxa diferente,
-- e a maquininha muda os percentuais com o tempo — por isso as taxas precisam
-- ser dados editáveis, não código.
--
-- Escrita à mão em vez de gerada: o `migrate dev` queria DROPAR o enum e criar
-- outro, o que apagaria a coluna. `ALTER TYPE ... RENAME` preserva tudo.
--
-- EXPAND, não destrutiva: nada é dropado. A coluna `Atendimento.formaPagamento`
-- e o enum continuam existindo, congelados e sem leitor, até um segundo deploy
-- (CLAUDE.md → "Migrations no deploy").

-- 1. Libera o nome `FormaPagamento` para o model novo, sem perder dado.
ALTER TYPE "FormaPagamento" RENAME TO "FormaPagamentoLegado";

-- 2. Tipos e tabelas novas.
CREATE TYPE "TipoPagamento" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO');

CREATE TABLE "FormaPagamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoPagamento" NOT NULL,
    "rotulo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL,
    "legado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FormaPagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormaPagamento_nome_key" ON "FormaPagamento"("nome");
CREATE INDEX "FormaPagamento_ativo_ordem_idx" ON "FormaPagamento"("ativo", "ordem");

CREATE TABLE "TaxaFormaPagamento" (
    "id" TEXT NOT NULL,
    "parcelas" INTEGER NOT NULL,
    "taxaBps" INTEGER,
    "formaPagamentoId" TEXT NOT NULL,

    CONSTRAINT "TaxaFormaPagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxaFormaPagamento_formaPagamentoId_parcelas_key"
    ON "TaxaFormaPagamento"("formaPagamentoId", "parcelas");

ALTER TABLE "TaxaFormaPagamento"
    ADD CONSTRAINT "TaxaFormaPagamento_formaPagamentoId_fkey"
    FOREIGN KEY ("formaPagamentoId") REFERENCES "FormaPagamento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Colunas novas no Atendimento.
ALTER TABLE "Atendimento" ADD COLUMN "formaId" TEXT;
ALTER TABLE "Atendimento" ADD COLUMN "parcelas" INTEGER;
ALTER TABLE "Atendimento" ADD COLUMN "taxaBps" INTEGER;

ALTER TABLE "Atendimento"
    ADD CONSTRAINT "Atendimento_formaId_fkey"
    FOREIGN KEY ("formaId") REFERENCES "FormaPagamento"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. As formas. Semeadas AQUI, e não em `prisma/seed.ts`, porque a produção
--    aplica migration no deploy mas tem o seed bloqueado — sem isto o site
--    subiria com o seletor vazio e ninguém conseguiria fechar atendimento.
--    IDs fixos (não cuid) para o backfill abaixo poder referenciá-los.
INSERT INTO "FormaPagamento" ("id", "nome", "tipo", "rotulo", "ordem", "ativo", "legado") VALUES
  ('dinheiro',           'Dinheiro',          'DINHEIRO', 'Dinheiro',   10, true,  false),
  -- Conta 1 e Conta 2 são linhas separadas mesmo as duas tendo taxa zero: a
  -- separação existe para saber em qual conta o dinheiro entrou.
  ('pix-conta-1',       'Pix Conta 1',      'PIX',      'Conta 1',    20, true,  false),
  ('pix-conta-2',         'Pix Conta 2',        'PIX',      'Conta 2',       21, true,  false),
  ('pix-maquininha',     'Pix na maquininha', 'PIX',      'Maquininha', 22, true,  false),
  ('visa-debito',        'Visa débito',       'DEBITO',   'Visa',       30, true,  false),
  ('mastercard-debito',  'Mastercard débito', 'DEBITO',   'Mastercard', 31, true,  false),
  ('elo-debito',         'Elo débito',        'DEBITO',   'Elo',        32, true,  false),
  ('amex-debito',        'Amex débito',       'DEBITO',   'Amex',       33, true,  false),
  ('visa-credito',       'Visa crédito',      'CREDITO',  'Visa',       40, true,  false),
  ('mastercard-credito', 'Mastercard crédito','CREDITO',  'Mastercard', 41, true,  false),
  ('elo-credito',        'Elo crédito',       'CREDITO',  'Elo',        42, true,  false),
  ('amex-credito',       'Amex crédito',      'CREDITO',  'Amex',       43, true,  false),
  -- Formas só para receber o histórico anterior ao controle de taxas. Ficam
  -- FORA do seletor (`ativo = false`) e o nome diz o que são: a taxa daqueles
  -- pagamentos é desconhecida, não zero.
  ('legado-pix',         'Pix (registro antigo)',     'PIX',      'Pix',     90, false, true),
  ('legado-debito',      'Débito (registro antigo)',  'DEBITO',   'Débito',  91, false, true),
  ('legado-credito',     'Crédito (registro antigo)', 'CREDITO',  'Crédito', 92, false, true),
  -- "Outro" não tinha tipo; entra como DINHEIRO só para satisfazer a coluna. O
  -- tipo de forma legada não é usado em lugar nenhum (elas nunca são escolhidas).
  ('legado-outro',       'Outro (registro antigo)',   'DINHEIRO', 'Outro',   93, false, true);

-- 5. As taxas de hoje. Em pontos-base: 339 = 3,39%.
--    NULO = ainda não configurada (Amex), e nunca 0 — 0% seria uma afirmação.
INSERT INTO "TaxaFormaPagamento" ("id", "formaPagamentoId", "parcelas", "taxaBps") VALUES
  ('tx-dinheiro-1',       'dinheiro',           1, 0),
  ('tx-pix-conta-1-1',   'pix-conta-1',       1, 0),
  ('tx-pix-conta-2-1',     'pix-conta-2',         1, 0),
  ('tx-pix-maq-1',        'pix-maquininha',     1, 99),

  ('tx-visa-deb-1',       'visa-debito',        1, 145),
  ('tx-master-deb-1',     'mastercard-debito',  1, 145),
  ('tx-elo-deb-1',        'elo-debito',         1, 274),
  ('tx-amex-deb-1',       'amex-debito',        1, NULL),

  ('tx-visa-cred-1',      'visa-credito',       1, 339),
  ('tx-visa-cred-2',      'visa-credito',       2, 673),
  ('tx-visa-cred-3',      'visa-credito',       3, 849),
  ('tx-visa-cred-4',      'visa-credito',       4, 949),

  ('tx-master-cred-1',    'mastercard-credito', 1, 339),
  ('tx-master-cred-2',    'mastercard-credito', 2, 673),
  ('tx-master-cred-3',    'mastercard-credito', 3, 849),
  ('tx-master-cred-4',    'mastercard-credito', 4, 949),

  ('tx-elo-cred-1',       'elo-credito',        1, 468),
  ('tx-elo-cred-2',       'elo-credito',        2, 817),
  ('tx-elo-cred-3',       'elo-credito',        3, 993),
  ('tx-elo-cred-4',       'elo-credito',        4, 1093),

  ('tx-amex-cred-1',      'amex-credito',       1, NULL),
  ('tx-amex-cred-2',      'amex-credito',       2, NULL),
  ('tx-amex-cred-3',      'amex-credito',       3, NULL),
  ('tx-amex-cred-4',      'amex-credito',       4, NULL),

  ('tx-legado-pix-1',     'legado-pix',         1, NULL),
  ('tx-legado-deb-1',     'legado-debito',      1, NULL),
  ('tx-legado-cred-1',    'legado-credito',     1, NULL),
  ('tx-legado-outro-1',   'legado-outro',       1, NULL);

-- 6. Backfill do histórico.
--
--    `taxaBps` fica NULO para tudo que veio de cartão/Pix: naquela época o
--    sistema não registrava taxa, e escrever 0 afirmaria que não houve taxa —
--    justamente o que o pedido manda evitar. Líquido = bruto nesses casos, mas
--    a tela mostra "não registrada".
--
--    DINHEIRO é a exceção e recebe 0 de verdade: dinheiro não tem taxa, nem
--    antes nem agora. Não há nada de desconhecido nesse caso.
UPDATE "Atendimento"
   SET "formaId" = CASE "formaPagamento"
         WHEN 'DINHEIRO' THEN 'dinheiro'
         WHEN 'PIX'      THEN 'legado-pix'
         WHEN 'DEBITO'   THEN 'legado-debito'
         WHEN 'CREDITO'  THEN 'legado-credito'
         WHEN 'OUTRO'    THEN 'legado-outro'
       END,
       "taxaBps" = CASE WHEN "formaPagamento" = 'DINHEIRO' THEN 0 ELSE NULL END
 WHERE "formaPagamento" IS NOT NULL
   AND "formaId" IS NULL;

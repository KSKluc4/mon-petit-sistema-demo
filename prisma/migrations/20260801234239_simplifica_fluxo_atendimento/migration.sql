-- Fluxo de atendimento simplificado a pedido da cliente: as etapas
-- intermediárias (iniciar / banho finalizado / tosa finalizada) saíram, porque
-- na prática ninguém para o banho no meio para tocar num botão. Sobram
-- AGENDADO → PRONTO → FINALIZADO, mais CANCELADO.
--
-- Esta migration é deliberadamente NÃO destrutiva (CLAUDE.md → "Migrations no
-- deploy", expand/contract): ela só ACRESCENTA o valor 'PRONTO' e limpa dados.
-- O valor 'EM_ATENDIMENTO' e a coluna "etapa" continuam existindo, sem que
-- nenhum código os use, e saem numa migration futura — assim o código antigo
-- que ainda estiver no ar durante o deploy não quebra ao escrever neles.

-- AlterEnum
ALTER TYPE "StatusAgendamento" ADD VALUE 'PRONTO';

-- Não usar 'PRONTO' abaixo: o Postgres roda cada migration numa transação e
-- proíbe usar um valor de enum recém-adicionado na mesma transação em que ele
-- foi criado. Os UPDATEs a seguir só mencionam valores que já existiam.

-- Todo agendamento que estava "em atendimento" volta para o começo do fluxo.
-- Decisão consciente: não tentamos adivinhar quais estariam prontos a partir da
-- etapa — o banco tem pouquíssimos registros e o atendente reavalia na hora.
UPDATE "Agendamento" SET "status" = 'AGENDADO' WHERE "status" = 'EM_ATENDIMENTO';

-- A etapa era o andamento interno do fluxo antigo; agora o status já diz tudo.
-- Zerada em todas as linhas para a coluna ficar de fato morta até ser dropada.
UPDATE "Agendamento" SET "etapa" = NULL WHERE "etapa" IS NOT NULL;

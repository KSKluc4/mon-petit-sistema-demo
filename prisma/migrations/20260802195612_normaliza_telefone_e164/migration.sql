-- Telefone passa a ser guardado em E.164 ("+5541999990000").
--
-- Antes o campo guardava o que o atendente digitasse — "(41) 99999-0000",
-- "41988887777" — e o link do WhatsApp prefixava "55" fixo, o que gerava link
-- inválido para número estrangeiro. Agora o país faz parte do dado.
--
-- Migration só de DADOS: a coluna continua String e continua NOT NULL, então o
-- código anterior roda contra este banco sem quebrar. Nada é dropado.
--
-- Todos os cadastros de hoje são brasileiros — é a premissa combinada. Ainda
-- assim a conversão é conservadora: o que não dá para classificar com
-- confiança fica EXATAMENTE como está, e `formatarTelefone()` (lib/telefone.ts)
-- sabe exibir valor não-E.164 devolvendo o texto cru. Prefixar "+55" num
-- fragmento de 4 dígitos seria inventar dado.
--
-- Idempotente: rodar de novo não muda nada, porque tudo que já começa com "+"
-- é preservado.

UPDATE "Cliente" c
SET telefone = novo.valor
FROM (
  SELECT
    id,
    CASE
      -- Já em E.164 (inclusive estrangeiro): não encosta.
      WHEN telefone ~ '^\s*\+' THEN telefone

      -- Telefone nacional: 10 dígitos (fixo ou celular antigo) ou 11 (celular
      -- com o 9º dígito). A checagem de comprimento vem ANTES da de prefixo
      -- "55" de propósito — senão um número de DDD 55 (Rio Grande do Sul),
      -- como 55 99999-8888, seria lido como se o 55 fosse o código do país.
      WHEN length(digitos) IN (10, 11) THEN '+55' || digitos

      -- Já vem com o código do país colado, só sem o "+".
      WHEN length(digitos) IN (12, 13) AND digitos LIKE '55%' THEN '+' || digitos

      -- Qualquer outra coisa (vazio, fragmento, número atípico): preserva.
      ELSE telefone
    END AS valor
  FROM (
    SELECT
      id,
      telefone,
      -- Tira a máscara e um único "0" de tronco à esquerda (o do "0 41 9...").
      -- Um só, não `^0+`: zeros repetidos não são tronco e virariam outro número.
      regexp_replace(regexp_replace(telefone, '\D', '', 'g'), '^0', '') AS digitos
    FROM "Cliente"
  ) base
) novo
WHERE c.id = novo.id
  AND c.telefone IS DISTINCT FROM novo.valor;

# Sistema Mon Petit — Especificação

Sistema de gestão para o Pet Shop Mon Petit (Campo Largo/PR), focado em agilidade: o atendente deve conseguir cadastrar um agendamento em menos de 30 segundos. Interface limpa, poucos cliques, botões grandes (pensado para uso em tablet no balcão).

---

## ⚠️ REGRAS PERMANENTES — leia antes de mexer no banco

Estas duas regras existem porque **cada uma já custou uma produção quebrada**. Não são preferências de estilo.

### 1. `Servico.valorPadrao` foi removido de propósito. Nunca recrie.

Serviço **não tem preço**. A cliente pediu assim: o preço varia por cachorro (porte, pelagem, temperamento), então não existe valor fixo por serviço — **o valor é livre por atendimento**, digitado na hora ou deixado em branco para preencher na entrega. Por isso `Agendamento.valorTotal`, `AgendamentoServico.valorCobrado` e `Atendimento.valorTotal` são **nullable**, e nulo significa *"valor a definir"* — nunca R$ 0,00, nunca somado ao faturamento.

**Nenhuma sessão deve recriar a coluna `valorPadrao`, tornar esses campos `NOT NULL`, nem "reconciliar" o banco nessa direção.** Já aconteceu: em 29/07/2026 uma sessão encontrou o banco divergindo do `schema.prisma` que ela tinha em mãos, concluiu que o banco estava errado e escreveu `restaura_valor_padrao_servico` para "consertar". Como dev e produção compartilhavam o mesmo banco Neon (não compartilham mais — ver "Ambientes de banco"), isso derrubou o schema de produção. O sintoma foi todo INSERT com valor nulo estourando `23502 not-null violation`: criar agendamento, fechar atendimento com "Receber depois", "+ Novo serviço" e o próprio seed. E **nenhum deploy corrigia**, porque o `_prisma_migrations` seguia marcando `valor_livre_por_atendimento` como aplicada — `prisma migrate deploy` via "nada pendente". Corrigido em 31/07/2026 por `20260731181500_reaplica_valor_livre_por_atendimento`.

### 2. Rode `git fetch` antes de julgar qualquer drift de banco.

A sessão acima errou por um motivo simples: **trabalhou a partir de um repositório desatualizado**. O `origin/master` em cache estava 4 commits atrás, então a migration que ela chamou de *"aplicada fora deste repositório, sem arquivo versionado"* estava, sim, versionada — num commit que aquela máquina não tinha baixado.

Antes de concluir que o banco está errado:

1. `git fetch` e compare `git log HEAD..origin/master`. O banco quase sempre está certo e o repositório é que está velho.
2. Confira `_prisma_migrations` no banco contra `prisma/migrations` — uma migration registrada lá que você não tem em disco é sinal de repositório desatualizado, **não** de banco corrompido.
3. **Ao encontrar drift, PARE e pergunte.** Não escreva migration de "reconciliação" por conta própria. Desde 31/07/2026 dev e produção são branches Neon separadas e há trava contra comando destrutivo na produção (ver "Ambientes de banco"), mas a trava impede o acidente — não o mau julgamento. Uma migration de "reconciliação" errada, commitada e enviada, chega à produção pelo deploy normal.

---

## Módulos
1. Clientes: nome, telefone (com código de país — ver "Telefone"), endereço (opcional), observações. Um cliente tem vários pets.
2. Pets: nome, foto, espécie (cão/gato), raça, sexo, data de nascimento ou idade, peso, tutor, observações livres (ex: "muito bravo", "não secar o rosto", "alergia a perfume").
3. Agenda (tela principal): grade de horários do dia. Cada agendamento mostra horário, espécie+nome do pet, serviços, nome do tutor. Cores por status: verde=agendado, amarelo=pronto, azul=finalizado, vermelho=cancelado. Clicar abre a ficha completa.
4. Atendimento: botões grandes na ficha do pet para mudar status rapidamente. **Só dois passos: Pet pronto → Entregue.** A cliente testou o fluxo antigo de 5 etapas (Iniciar atendimento → Banho finalizado → Tosa finalizada → Pet pronto → Entregue) e pediu para tirar as intermediárias — ninguém para o banho no meio para tocar num botão. Ver "Fluxo de atendimento" abaixo.
5. Histórico: ao finalizar um atendimento, salva automaticamente data, serviços realizados, valor, funcionário responsável, observações. Consultável na ficha do pet.
6. Serviços: cadastro de serviços só com nome e ativo/inativo, sem preço (seed inicial: Banho, Tosa Corpo, Tosa Higiênica, Tosa na Tesoura, Hidratação, Corte de Unhas, Desembolo). O valor é livre por atendimento: no agendamento a seleção múltipla de serviços não soma nada, o campo de valor fica sempre em branco e pode ser preenchido na hora ou depois, na entrega.
7. Caixa: tela do dia com cliente, pet, serviços realizados, forma de pagamento, valor, e faturamento total do dia — mais a lista "A receber" com todas as pendências em aberto, de qualquer data (ver "Regime de caixa e baixa de pendência").
8. Busca: barra única pesquisando por nome do pet, nome do tutor ou telefone.
9. WhatsApp: botões que abrem wa.me com mensagem pré-pronta — Confirmar horário, Pet pronto e Agradecimento na ficha, mais Cobrar em cada pendência do Caixa.
10. Dashboard inicial: agendamentos de hoje, quantos agendados/prontos/finalizados/cancelados, faturamento do dia.
11. Padrão do Pet: aba na ficha do pet, cadastrada uma vez e reaproveitada em todo atendimento futuro (ex: "máquina 7 no corpo", "tesoura na cabeça", "não usar perfume", "precisa de focinheira").
12. Relatórios: tela de fechamento de período para a contabilidade — filtro de período, resumo, tabelas por serviço / cliente-pet / forma de pagamento, evolução de 12 meses e exportação em Excel e PDF. Ver "Relatórios" abaixo.

## Fluxo de atendimento

Simplificado em 01/08/2026, depois de a cliente testar o sistema. O fluxo antigo tinha 5 etapas; na prática as intermediárias nunca eram marcadas (ninguém interrompe o banho para tocar num botão), então sobraram **dois toques**:

```
Agendado (verde) ──[Pet pronto]──> Pronto (amarelo) ──[Entregue]──> Finalizado (azul)
      └──────────────[Cancelar]──────────────┘                → Cancelado (vermelho)
```

- **Cancelar** é um botão de verdade (secundário/contorno, nunca laranja — o laranja é sempre a próxima ação real), disponível enquanto o status for Agendado ou Pronto e ausente depois de entregue. A confirmação com pet, horário e campo de motivo continua num painel (`?cancelar=1`), não num `confirm()`.
- **"Voltar uma etapa"** desfaz um degrau: Finalizado → Pronto (apagando o `Atendimento` do histórico) e Pronto → Agendado. **Só enquanto não houver pagamento registrado** — ver "Corrigir e devolver" abaixo.
- **WhatsApp** acompanha o status, sem citar etapa nenhuma: "Confirmar horário" em Agendado, "Pet pronto" em Pronto/Finalizado, "Agradecimento" em Finalizado.

**Sobras do fluxo antigo, de propósito** (expand/contract — ver "Migrations no deploy"): o valor `EM_ATENDIMENTO` do enum `StatusAgendamento`, o enum `EtapaAtendimento` inteiro e a coluna `Agendamento.etapa` continuam existindo no banco e no schema, **sem nenhum código que os leia ou escreva**. A migration `20260801234239_simplifica_fluxo_atendimento` é deliberadamente não destrutiva: só acrescenta `PRONTO`, converte todo `EM_ATENDIMENTO` em `AGENDADO` e zera `etapa`. Dropar essas três coisas é um segundo deploy, quando alguém quiser fazer — nunca junto com o código que parou de usá-las. Enquanto isso, `STATUS_INFO` mantém uma entrada `EM_ATENDIMENTO` que renderiza como "Agendado", de rede de segurança, e `STATUS_VISIVEIS` (`components/agenda/statusInfo.ts`) é a lista que a interface percorre — **use ela, nunca `Object.keys(STATUS_INFO)`**, senão o legado vira um quinto card no dashboard.

## Relatórios

Tela `/relatorios` (01/08/2026), pedida para fechar o mês e passar números à contabilidade. Filtro de período na URL (`?atalho=` ou `?de=&ate=`), nunca em estado local: o link pode ser recarregado, salvo ou mandado para a contadora e continua mostrando o mesmo recorte — e é o mesmo período que os botões de exportar reaproveitam.

### Regra de contagem — é o que não pode errar

Uma função só, `classificarAtendimento()` em `lib/faturamento.ts`, decide se um atendimento é `PAGO` / `A_RECEBER` / `SEM_VALOR`. **Caixa, Dashboard e Relatórios chamam essa função em vez de repetir o if/else.** Foi por dividir essa lógica que os três nunca divergiram; um segundo `if` copiado é o jeito garantido de o fechamento do mês não bater.

O relatório conta **só atendimentos pagos** (valor definido **e** forma de pagamento registrada), pela **data do recebimento** (ver "Regime de caixa" abaixo). Pendências (a receber, sem valor) ficam fora do faturamento e aparecem à parte. Cancelado nunca gera `Atendimento`, então é contado direto em `Agendamento` — e por isso, só ele, pela **data do agendamento**. Tudo isso está escrito na própria tela, num box, porque a dona precisa conferir antes de mandar para a contabilidade.

`gerarRelatorio()` (`lib/relatorios.ts`) é a fonte única: tela, Excel e PDF saem da mesma chamada. Se a planilha fosse calculada por outro caminho, os dois divergiriam em silêncio e o erro só apareceria no fechamento.

### Regime de caixa e baixa de pendência (02/08/2026)

"Receber depois" existia desde o começo, mas **não havia como marcar que depois foi pago**: a pendência entrava na lista e nunca saía. Duas coisas foram resolvidas juntas.

**1. A pendência não tem mais recorte de dia.** O Caixa filtrava por `Atendimento.data`, então uma conta em aberto desde julho só reaparecia se alguém navegasse até a data exata — era o jeito garantido de nunca mais ser cobrada. Hoje `listarPendencias()` (`lib/faturamento.ts`) devolve **todas** as pendências abertas, da mais antiga para a mais recente, e a seção "A receber" aparece em toda visita ao Caixa, em qualquer data. Ela também aparece no Dashboard (banner com o total, fora do bloco condicional de "tem agendamento hoje" — num dia parado é justamente quando dá para cobrar) e na ficha do pet.

**2. O faturamento conta pela data do recebimento, não do atendimento.** Regime de caixa. Um banho do dia 28/07 pago em 02/08 entra no faturamento de **02/08**.

> **Por que caixa e não competência.** Pela competência, receber hoje uma pendência de julho mudaria **retroativamente** o faturamento de julho — e o relatório que já foi exportado e mandado para a contadora deixaria de bater com o sistema, sem nada explicando a diferença. Esse é o único modo de falha que não tem conserto depois. Pelo caixa, período fechado nunca mais muda. O custo é conhecido e está escrito na tela.

#### A invariante (é ela que impede contar duas vezes)

```
Atendimento.formaId != null  <=>  Atendimento.dataRecebimento != null
```

> Era `formaPagamento` (o enum) até 02/08/2026. Quem manda hoje é `formaId`, a relação — ver "Formas de pagamento com taxa" abaixo. O campo antigo continua no banco, congelado e sem leitor.

Os dois campos são **sempre escritos juntos, na mesma transação**, por `registrarRecebimento()` em `lib/recebimento.ts` — a única escrita de recebimento do sistema. As três telas que dão baixa (Caixa, ficha do agendamento, fechamento do atendimento) passam por lá.

Como o dinheiro tem **uma data só** e toda consulta de faturamento filtra por ela, nenhum atendimento cai em dois períodos. **Se alguma tela gravar `formaId` sozinho, o atendimento sai da lista de pendências (que filtra por forma nula) sem entrar no faturamento (que filtra por data de recebimento): o dinheiro some da conta sem deixar rastro.** Não crie um caminho que grave um sem o outro.

A migration `20260802185315_recebimento_de_pendencia` é aditiva (expand) e faz o backfill `dataRecebimento = data WHERE formaPagamento IS NOT NULL` — sem ele todo o histórico já pago sairia do faturamento no primeiro deploy. `registrarRecebimento` também recusa uma segunda baixa: dois toques no balcão não podem reescrever o dia em que o dinheiro entrou.

#### Duas bases de data no relatório

`gerarRelatorio()` faz **duas consultas**, porque o período responde a duas perguntas e uma só não fecha as duas:

| Consulta | Filtra por | Alimenta |
|---|---|---|
| `recebidos` | `dataRecebimento` | faturamento, ticket médio, por serviço, por pet, por forma, gráfico de 12 meses |
| `realizados` | `data` | listagem detalhada e as pendências do período |

Filtrar tudo por `dataRecebimento` faria as **pendências sumirem** do relatório (elas não têm data de recebimento) — sumir com número é tão ruim quanto contar duas vezes. As duas somas **não precisam bater**, e a tela diz isso: há um box "Como o faturamento se compõe" (recebido no período · quanto veio de atendimento anterior · quantos feitos aqui seguem em aberto) e a listagem ganhou coluna **"Recebido em"**, com marca *(fora do período)* quando o dinheiro contou noutro mês. Sem essa marca a listagem visivelmente não somaria o número do topo e pareceria erro.

O gráfico de 12 meses também mudou para `dataRecebimento` — se contasse pela data do atendimento, contradiria os cards logo acima dele na mesma tela.

Excel e PDF carregam a mesma explicação e a mesma coluna nova.

### Corrigir e devolver — e por que são coisas diferentes (05/08/2026)

Até aqui só existia um jeito de mexer num atendimento já fechado: **"Voltar uma etapa"**, que fazia `atendimento.deleteMany` **sem olhar o pagamento**. Um toque num atendimento pago levava embora `valorTotal`, `formaId`, `taxaBps` e `dataRecebimento` juntos — o recebimento sumia do Caixa, o faturamento de um período possivelmente já fechado mudava sozinho, e **não sobrava linha nenhuma dizendo que existiu**. Era o modo de falha que o regime de caixa existe para evitar, atrás de um `confirm()`. Corrigido antes de a loja ter qualquer atendimento real (produção conferida vazia em 05/08/2026).

O erro comum do balcão é digitar R$ 85 no lugar de R$ 58 e perceber meio minuto depois. Isso **não é um estorno**:

| O que aconteceu no mundo | Mecanismo | Onde |
|---|---|---|
| O dinheiro **voltou** ao cliente | **Devolver dinheiro** — linha nova, datada hoje | `estornarRecebimento` |
| O **número foi digitado errado**; dinheiro nenhum se moveu | **Corrigir pagamento** — edita em cima | `corrigirRecebimento` |

Registrar uma digitação errada como estorno faria o sistema **afirmar que R$ 85 entraram e R$ 85 voltaram** — dois fatos que nunca aconteceram, indo para a contabilidade como reais. É a mesma recusa que impede valor nulo de virar R$ 0,00 e taxa nula de virar 0%. A velocidade vem junto (um painel em vez de refazer o fechamento inteiro), mas não é o argumento.

**Corrigir só no mesmo dia contábil** (`dataISODe(dataRecebimento) === hojeISO()`), e a função **nunca toca `dataRecebimento`** — é essa linha que a torna segura: o dinheiro segue reconhecido no dia em que entrou, e como esse dia é hoje, nenhum período fechado se mexe. Recebimento de ontem para trás cai na devolução, pelo mesmo motivo já documentado no `PacoteEstorno`.

`AtendimentoEstorno` é tabela, não flag, pela razão do `PacoteEstorno`: um estorno parcial, se um dia existir, é a mesma linha com valor menor. A FK é **`ON DELETE RESTRICT`** — o banco recusa apagar um atendimento devolvido, mesmo que algum código futuro tente.

#### A regra que não pode ser "consertada" de volta

O atendimento estornado **continua contando na consulta de faturamento pelo valor cheio**; quem tira o dinheiro é a linha de estorno, **na data dela**. Filtrar os estornados para fora da consulta parece mais limpo e está **errado**: um recebimento de agosto devolvido em setembro sumiria retroativamente do faturamento de agosto. Testado — o mês da venda fica intacto e a saída cai no mês corrente.

Daí saem **dois números de receita avulsa**, e a diferença não é descuido:

| Campo | O que é | Quem usa |
|---|---|---|
| `faturamentoAvulsoBruto` | antes das devoluções | rateio por serviço (fecha por diferença) e ticket médio |
| `faturamentoAvulso` | já líquido | os cards, o Excel, o PDF |

O rateio **tem** que ser bruto: as linhas de estorno não estão em `pagos` e podem nem ser deste período. Unificar os dois faria uma devolução virar "combinado" negativo — um número que não existe. A tela mostra a devolução em linha própria, e a reconciliação do rateio agora exibe **"Total em atendimentos"** (`faturamentoAvulsoBruto`), não o faturamento do topo.

> Aproveitando: a célula "Total do período" dessa reconciliação exibia `resumo.faturamento`, que **inclui venda de pacote** — então desde 03/08/2026 os três números não somavam sempre que havia pacote vendido no período. Corrigido junto.

`classificarAtendimento()` ganhou a situação **`ESTORNADO`** (4º parâmetro), mesmo padrão do `PACOTE`. Ela serve para **exibição**, não para filtrar faturamento — está escrito na própria função, porque é o engano natural.

Devolvido **não volta a ser pendência**: `formaId` continua gravado, então some do "A receber" sozinho. E o atendimento **permanece no histórico do pet**, marcado — o registro de dinheiro que se moveu duas vezes tem que sobreviver a quem quer apagá-lo. É comportamento que a dona encontra no balcão ("cancelei o pagamento e o atendimento não sumiu") e está no treinamento.

### Quem fez cada coisa (05/08/2026)

Rastreabilidade do dinheiro: quando um número parece errado, dá para saber a origem sem adivinhar. `lib/autoria.ts` é a fonte única — o tipo `Autor` (`{ nome, id }`, direto da sessão) e os helpers de exibição.

| Campo | Quando é gravado |
|---|---|
| `Atendimento.responsavel` + `responsavelId` | ao finalizar |
| `Atendimento.recebidoPor` + `recebidoPorId` | ao dar baixa |
| `Pacote.vendidoPor` + `vendidoPorId` | na venda |
| `PacoteEstorno.feitoPor` + `feitoPorId` | no cancelamento |
| `AtendimentoEstorno.feitoPor` + `feitoPorId` | na devolução |

**Atendeu e recebeu são pessoas diferentes no caso comum** — quem entrega o pet de manhã pode não ser quem recebe o dinheiro à tarde. Por isso são dois campos, e duas colunas no Excel.

**O nome é snapshot, o id vai junto.** O nome congela porque a pessoa pode se renomear em `/conta` e um histórico que muda depois do fato deixa de ser histórico. O id desempata: `atualizarNomeAction` **não valida unicidade de nome**, então nome sozinho não volta para um usuário. Não é FK — `Usuario` nunca é apagado, e uma relação exigiria uma back-relation por campo de autoria, sem ganho.

**Nulo é "anterior ao registro de autoria", nunca "sem responsável"** (`AUTOR_DESCONHECIDO`). Dizer "sem responsável" afirmaria que ninguém fez, quando a verdade é que ninguém anotou — a mesma recusa de valor nulo virar R$ 0,00 e taxa nula virar 0%. **Use `comAutor()`/`formatarAutor()`; não escreva o fallback na mão.**

**`registrarRecebimento` recebe o autor e as três telas de baixa herdam de graça** — é o retorno de existir um caminho de escrita só. **`corrigirRecebimento` NÃO reescreve `recebidoPor`**: quem recebeu o dinheiro foi quem recebeu, e uma correção feita pela outra pessoa não muda esse fato; quem corrigiu é outro evento e vai para o registro de atividade.

`vendidoPor` era gravado desde 03/08/2026 e **não aparecia em tela nenhuma** — agora aparece no Caixa e na aba de pacotes da ficha. O PDF do relatório segue sem coluna de autoria de propósito: ele é a versão de imprimir e já está denso; quem precisa perguntar à pessoa certa é a contadora, e ela trabalha no Excel.

### Registro de atividade (05/08/2026)

`RegistroAtividade` cobre o que os campos de autoria **não** cobrem. Uma coluna responde "quem fez isto?" enquanto a linha existe; ela não resolve dois casos:

1. **A linha some.** Excluir cliente ou pet apaga tudo — não sobra onde pendurar coluna, e "quem apagou a ficha da Mila?" fica sem lugar para ser respondido.
2. **Precisa do ANTES.** "A taxa mudou" não ajuda; "3,39% → 4,10%" ajuda. Coluna guarda um valor, nunca dois. A taxa é o caso extremo: `TaxaFormaPagamento` é **sobrescrito no lugar**, então o percentual antigo era **irrecuperável** — os atendimentos guardam o snapshot deles, a tabela não.

**Os 9 pontos registrados**, e a lista é curta de propósito: excluir cliente, excluir pet, alterar taxa, reativar agendamento (que **apaga o `motivoCancelamento`**, o único rastro de que houve cancelamento), corrigir pagamento (valor/forma antes→depois), desfazer um atendimento não pago em "Voltar uma etapa", e — desde 26/10/2026 — renomear serviço, desativar/reativar serviço e redefinir a senha do outro usuário.

- **Renomear serviço** grava o nome antigo→novo. É o mais importante dos três: a tabela "Por serviço" agrupa por `servicoId` mas exibe o nome **atual**, então renomear reetiqueta retroativamente um relatório que já foi para a contadora. Salvar o formulário sem mudar o nome não registra nada.
- **Redefinir senha** grava quem redefiniu de quem e diz na frase que a sessão do outro caiu — é o efeito que a pessoa sente sem entender. **Nunca** grava a senha, o hash ou qualquer parte deles, nem em `antes`/`depois`.

**Fora, por decisão:** criar/editar cliente e pet, criar agendamento, criar serviço, padrão do pet, alterar o próprio nome ou senha. Nada disso apaga dado nem mexe em dinheiro, e **encher o log de ruído é como ele deixa de ser lido**.

**O filtro ganhou uma quarta categoria, "Acesso"** (`CATEGORIAS` e `CATEGORIA_DA_ACAO` em `lib/eventos.ts`). Renomear serviço → **Dinheiro** (como a taxa: cadastro que muda como o dinheiro aparece no relatório); desativar/reativar → **Agenda** (o efeito é o serviço sumir da tela de agendar); senha redefinida → **Acesso**.

> Chegou a ser posta em Exclusões para manter três pílulas, com base numa estimativa de largura **não medida**. Revertido antes do commit: quem procura "quem trocou minha senha?" teria que adivinhar que ela mora em Exclusões, e esta tela existe para eliminar adivinhação — **categoria que mente é pior que categoria a mais**. E estimativa de largura já mentiu neste projeto (o iframe de 768px que virava viewport de 751px, em "Design").

**No celular as pílulas quebram em duas linhas** (`flex-wrap` em `components/atividade/TipoFiltro.tsx`), mantendo `min-h-[44px]`, `px-4` e `whitespace-nowrap`. Em 768px para cima as cinco (Tudo + 4) cabem numa linha só, então o wrap só age no celular.

> Chegou a ser uma linha só que **rolava na horizontal**, como a nav do header e as abas do pet. Medido em 390px: o conteúdo tinha 454px em 358px e **"Acesso" ficava inteira fora da tela**, sem nada indicando que existia — justo a pílula criada para ser encontrada por quem procura "quem trocou minha senha?". Um esmaecimento na borda só avisaria que há mais; quebrar a linha **mostra** a opção. A regra que fica: **linha que rola serve para NAVEGAÇÃO**, que se aprende uma vez e se usa todo dia; **filtro numa tela de investigação**, aberta raramente por quem não sabe quais opções existem, tem que deixar toda opção à vista.

#### As duas regras

**Gravado na MESMA transação da mudança que descreve.** Se a mudança acontece e o log falha, fica dado alterado sem rastro — exatamente o buraco que a tabela existe para fechar. Por isso `registrarAtividade(tx, ...)` recebe a transação em curso: passar o `prisma` global funciona e é o jeito errado sempre que houver transação por perto. Testado — quando a mudança falha, o registro some junto.

**Append-only.** Não existe função de editar nem de apagar, e não deve passar a existir. Um log reescrevível não responde "o que aconteceu?", responde "o que alguém quis que parecesse ter acontecido".

`descricao` é a frase **pronta**, escrita no momento do fato e congelada: a tela não precisa de um switch para montar texto, e um registro antigo não passa a ser descrito de outro jeito quando o código muda. `antes`/`depois` são Json e só onde o valor importa — não é diff de linha inteira, que viraria ruído.

`criadoEm` é **operacional** (quando alguém apertou o botão) e não se confunde com data contábil: registrar atividade nunca move dinheiro de período. Os dois eixos não se cruzam.

`acao` é `String` com as constantes em `ACOES` (`lib/atividade.ts`), não enum de banco — ação nova é mudança de código, não migration.

#### A tela `/atividade` — uma linha do tempo, quatro fontes

Alcançada por **`/conta` → Configurações da loja**, nunca pelo header (teto medido de 5 destinos).

Quem abre esta tela está **investigando** ("sumiu um valor do caixa de terça") e **não sabe em qual mecanismo a resposta mora**. Duas telas separadas — uma para o registro, outra para as devoluções — obrigariam a pessoa a adivinhar onde procurar, que é o que a rastreabilidade existe para eliminar. Por isso `listarLinhaDoTempo()` junta:

| Fonte | O que traz |
|---|---|
| `RegistroAtividade` | o que não deixa linha própria |
| `AtendimentoEstorno` | dinheiro devolvido |
| `Pacote` | venda de pacote |
| `PacoteEstorno` | cancelamento de venda |

As três últimas **já têm linha própria com autor e não são duplicadas no registro** — são lidas de onde estão. Duplicar criaria duas fontes podendo discordar sobre o mesmo fato.

**Fora: recebimento e finalização de atendimento.** Acontecem em todo atendimento e encheriam a lista a ponto de esconder o evento raro que alguém veio procurar. Quem fez cada um está na ficha e no Caixa, que é onde a pergunta nasce. Mesmo critério que manteve criar/editar cliente fora do registro.

**Linguagem de gente, não de sistema:** *"Ana devolveu R$ 58,00 do atendimento da Mila"*, com concordância de gênero por `lib/genero.ts` — nunca slug de ação nem id. E o **antes→depois fica na própria linha** (*"Alterou a taxa de Visa crédito: 3,39% → 4,10%"*), não escondido atrás de um clique: é a informação inteira, não um detalhe.

Filtro por **período** (reaproveita o `PeriodoFiltro` do Relatórios, agora com `basePath`) e por **tipo**, em 4 categorias — Dinheiro · Exclusões · Agenda · Acesso (a quarta desde 26/10/2026, ver acima). Quatro e não nove: o que foi rejeitado era **nove pílulas virando TRÊS linhas** de botão no celular, justo na tela em que se está procurando algo. **Cinco pílulas (Tudo + 4) em DUAS linhas foi aceito de propósito** em 26/10/2026: é o preço de toda opção ficar visível, e a alternativa testada — rolar na horizontal — escondia "Acesso" inteira fora da tela (ver acima). Os dois filtros moram na URL, como no Relatórios.

> `lib/eventos.ts` existe separado de `lib/linhaDoTempo.ts` porque o filtro é componente de **cliente** e precisa da mesma lista de categorias. Um `import "server-only"` nesse caminho quebra o build inteiro — mesma razão de `lib/periodos.ts` estar fora da regra.

### Pacotes de banho pré-pagos (03/08/2026)

Pacote de **2 ou 4 banhos**, do **PET** (não do tutor), pago **inteiro na compra**, válido **30 dias**. O que normalmente encerra o pacote é o saldo zerar, não a data. Valor livre, digitado na venda — mesma regra do resto do sistema.

#### A garantia contra contar duas vezes — é o que não pode errar

O dinheiro do sistema entra em **duas tabelas, disjuntas por construção**:

| Fonte | Reconhecida em | O que é |
|---|---|---|
| `Pacote.valorTotal` | `Pacote.dataRecebimento` | a venda antecipada, valor cheio |
| `Atendimento.valorTotal` | `Atendimento.dataRecebimento` | avulso, ou **só o extra** numa visita de pacote |

```
Nenhum campo do Atendimento jamais recebe o valor do pacote, e PacoteConsumo
não tem coluna de valor. Os mesmos centavos não têm como aparecer nas duas.
```

Não é uma regra a lembrar — é a **falta de um lugar onde o erro caberia**. Num atendimento que usa pacote, `valorTotal` significa **só o extra do dia** (`0` quando não houve extra). **A única forma de quebrar isso é escrever `Atendimento.valorTotal` a partir do valor de um pacote: é a linha a vigiar em qualquer revisão.**

#### As três armadilhas que isso abriu (todas fechadas, todas testadas)

Foram encontradas lendo o código antes de escrever, e cada uma seria um bug silencioso:

**1. Banho de pacote viraria pendência eterna.** `listarPendencias()` define "em aberto" como `formaId: null` — e uma visita de pacote sem extra tem forma nula. Ela apareceria no "A receber" do Caixa, no banner do Dashboard e na ficha do pet, **para sempre, cobrando um dinheiro que já entrou**. `classificarAtendimento()` ganhou o parâmetro `usouPacote` e uma quarta situação `PACOTE`; o filtro de pendências chama essa função em vez de repetir o `if`. O mesmo valia para o painel "Pagamento ainda não registrado" da ficha do agendamento, para o selo "Em aberto" do histórico do pet e para o contador de pendências da ficha — os quatro foram corrigidos.

**2. Banho de pacote envenenaria a tabela "Por serviço".** A regra é que "faturamento atribuível" soma só os atendimentos em que o serviço foi o **único**. Um Banho de pacote se qualificaria e entraria como **R$ 0 no numerador e uma venda no denominador**: os 4 sábados da Mila puxariam a média do Banho para baixo e o recorte "2 de 3" diria que houve três vendas reais — número inventado indo para a contabilidade. Está fora porque `FILTRO_PAGO` exige `formaId`, e visita de pacote sem extra não tem. **Testado com o serviço vinculado**, que é o caso real.

**3. "Voltar uma etapa" apaga o `Atendimento`.** `PacoteConsumo` tem `onDelete: Cascade` a partir do atendimento, então o banho volta ao saldo sozinho. Testado.

#### Decisões

- **Sem extra, `valorTotal = 0`, não nulo.** Nulo significa "a definir" (regra permanente) e reusá-lo para "já pago" estragaria o sentido de que o resto do sistema depende. O `0` aqui é afirmação verdadeira: esta visita não custou nada a mais. O custo é que, para quem lê `valorTotal` sem saber de pacote, a visita parece de graça — por isso a situação `PACOTE` existe e as telas dizem **"Pago no pacote"**, nunca "R$ 0,00".
- **Validade é DERIVADA, não gravada** (`statusDoPacote`): ativo / encerrado (saldo zerou) / expirado (venceu com saldo) / cancelado (estorno de 100%). Um `status` gravado precisaria de um job para virar no dia certo, e **este projeto não tem scheduler nenhum** (só o backup no GitHub Actions) — o campo ficaria errado entre execuções. Precedência: cancelado > encerrado > expirado > ativo (esgotado ganha de vencido: a data deixa de importar).
- **`indice` é atribuído no CONSUMO, não no agendamento.** A cliente marca os 4 sábados de uma vez; numerar antes renumeraria tudo quando uma visita acontecesse fora de ordem. O agendamento mostra só "Pacote"; o "Banho 2 de 4" aparece ao fechar. O `@@unique([pacoteId, indice])` é o que torna o último banho seguro contra dois aparelhos ao mesmo tempo — o segundo estoura e a transação inteira volta atrás.
- **A marcação no agendamento é INTENÇÃO, não reserva.** O fechamento reconfere o saldo na hora, numa transação com a criação do atendimento. Se o pacote acabou ou venceu no meio, a tela avisa e **nada é gravado** — melhor pedir para refazer do que consumir um banho que não existe.
- **Dois pacotes ativos são permitidos, consumindo sempre do MAIS ANTIGO** (decisão da dona, 03/08/2026). Bloquear a segunda venda travaria o balcão quando o 5º sábado chega antes de alguém lembrar de vender o pacote novo. O mais antigo é o que vence primeiro, então essa ordem também protege o cliente. Com mais de um ativo, a ficha do pet diz qual será usado.

#### Cancelamento de venda, e por que é tabela

Só enquanto **nenhum banho foi usado** — depois disso o serviço já foi prestado, e devolver vira estorno parcial (decisão ainda não tomada pela dona).

`PacoteEstorno` é **tabela, não um flag `canceladoEm` no pacote**, de propósito: assim um estorno **parcial**, se um dia existir, é a mesma linha com valor menor e sem a trava de consumo — sem um segundo mecanismo de "dinheiro que voltou" para reconciliar, que é como uma conta deixa de fechar. O cancelamento de hoje é simplesmente um estorno de 100%.

A `data` do estorno é **contábil** e segue o **regime de caixa como todo o resto: é o dia do CANCELAMENTO, nunca o da venda.**

> Chegou a ser datada pelo dia da venda, para a receita sumir de lá. Corrigido em 03/08/2026, ainda antes de a dona usar: datar pela venda **reescreveria um período já fechado** — exatamente o modo de falha que o regime de caixa existe para evitar, e o único que não tem conserto depois que o relatório foi para a contadora. Cancelar no mesmo dia continua se anulando sozinho (venda e estorno caem juntos, o caso comum de erro de digitação); cancelar no mês seguinte deixa o mês da venda intacto e lança a devolução no mês corrente, que é onde o dinheiro de fato saiu.

`criadoEm` e `feitoPor` registram quem cancelou e quando, e o `pacoteId` mantém o vínculo com a venda original — a rastreabilidade não depende da data. A tela de cancelamento diz que a devolução entra no caixa de hoje e que o faturamento do dia da venda não muda; o card do Caixa mostra a data da venda original ao lado do estorno, já que os dois podem cair em dias diferentes.

#### Onde os números aparecem

- **Caixa**: a venda entra no dia pelo valor cheio, junto dos outros recebimentos; o estorno entra negativo; os banhos consumidos aparecem numa seção própria, **fora do total**, com o aviso de que já foram pagos.
- **Relatórios**: `faturamento` = **avulso + pacotes**. Mas o **rateio por serviço e o ticket médio fecham contra o AVULSO**, não contra o total — venda de pacote não passa por serviço nem por atendimento, e incluí-la faria o "combinado" (calculado por diferença) absorver dinheiro de pacote como se tivesse saído de um atendimento. A tabela **por forma de pagamento inclui os pacotes**, porque eles passam pela mesma maquininha: sem isso a soma das linhas daria o avulso enquanto o Total daria o faturamento inteiro, e a tabela não fecharia consigo mesma.
- **Banhos de pacote consumidos no período** é contado à parte e mostrado na tela, no Excel e no PDF: é serviço prestado sem receita no dia, e sem esse número o mês parece mais fraco do que foi.
- O gráfico de 12 meses soma as duas fontes, senão contradiz os cards logo acima.

### Formas de pagamento com taxa (02/08/2026)

A forma de pagamento era um enum genérico (Dinheiro/Pix/Crédito/Débito/Outro) e o sistema **não sabia quanto realmente caía na conta**: cada bandeira cobra uma taxa diferente, e o relatório mostrava o bruto como se fosse receita. Hoje a forma é **tabela** (`FormaPagamento` + `TaxaFormaPagamento`), com taxa editável pela dona em `/formas-pagamento`.

**Por que tabela e não enum:** a maquininha muda os percentuais com o tempo. Com enum, cada mudança de taxa exigiria um deploy.

Uma linha por **bandeira + modalidade** ("Visa débito" e "Visa crédito" são duas linhas, não uma com flag): só `CREDITO` pergunta parcelamento, e é o `tipo` que dá esse comportamento. **Pix Conta 1 e Pix Conta 2 são separados** apesar de ambos terem taxa zero — a distinção existe para saber em qual conta o dinheiro entrou.

#### As três decisões que sustentam a conta

**1. A taxa é um SNAPSHOT por venda (`Atendimento.taxaBps`), não uma leitura da tabela.** Mesmo motivo que fez o faturamento virar regime de caixa: se o líquido fosse recalculado a partir da tabela, a dona editar um percentual hoje mudaria **retroativamente** o fechamento do mês passado, e o relatório já enviado à contadora deixaria de bater. Com o snapshot, período fechado nunca muda.

**2. Taxa nula é "desconhecida", nunca 0%.** Mesma armadilha de `valorTotal` nulo virar R$ 0,00 — 0% é uma *afirmação* ("não houve taxa"), e afirmar isso sobre um pagamento cuja taxa ninguém registrou põe número inventado na contabilidade. Onde a taxa é nula o líquido é contado igual ao bruto, e **a tela diz isso**: o líquido do período é apresentado como *limite superior*, com aviso. Dinheiro e Pix entre contas têm `0` de verdade, gravado.

**3. A taxa é resolvida no SERVIDOR, a partir de (forma, parcelas).** Nunca vem do formulário — senão o cliente escolheria a própria taxa. `registrarRecebimento()` continua sendo a única escrita, e ganhou a resolução da taxa junto com a invariante.

#### Enum antigo: expand/contract em aberto

A migration `20260802210000_formas_pagamento_com_taxa` é **aditiva** e foi escrita à mão — o `migrate dev` queria dropar o enum e recriá-lo, o que **apagaria a coluna**; `ALTER TYPE ... RENAME` preserva o dado. Ela renomeia `FormaPagamento` → `FormaPagamentoLegado`, cria as tabelas, semeia o catálogo e faz o backfill do histórico.

**O catálogo é semeado NA MIGRATION, não em `prisma/seed.ts`**, porque a produção aplica migration no deploy mas tem o seed bloqueado — sem isso o site subiria com o seletor de pagamento vazio e ninguém conseguiria fechar atendimento.

No backfill, o histórico de cartão/Pix vai para **formas "(registro antigo)"** — inativas, fora do seletor, com taxa **nula**: naquela época a taxa não era registrada, e ela é desconhecida, não zero. `DINHEIRO` é a única exceção e vai para a forma real com taxa `0`, porque dinheiro nunca teve taxa.

**Dívida de contract, para um segundo deploy sozinho** (mesma lista de `Agendamento.etapa` e `StatusAgendamento.EM_ATENDIMENTO`): dropar a coluna `Atendimento.formaPagamento` e o enum `FormaPagamentoLegado`. Os dois seguem declarados no schema, congelados, **sem nenhum código que os leia ou escreva** — só para schema e banco baterem. Nunca junto do código que parou de usá-los.

#### Onde fica a tela

`/formas-pagamento` é alcançada por **`/conta` → Configurações da loja**, e não pelo header: a navegação está no teto medido de 5 destinos (ver "Design"), e um sexto item quebraria uma largura que já foi consertada duas vezes. O relatório também linka para lá, contextualmente, quando há recebimento sem taxa registrada.

### Por que o valor NÃO é rateado entre serviços

Serviço não tem preço (regra permanente no topo deste arquivo) — o valor é um total livre por atendimento. Num "Banho + Tosa" de R$ 85 o sistema **nunca soube** quanto foi de cada um. Ratear (R$ 42,50 + R$ 42,50) produziria número inventado que iria para a contabilidade como se fosse real. Decisão tomada com a dona em 01/08/2026:

- **Qtd.** conta todas as vezes que o serviço foi realizado, inclusive em atendimento combinado.
- **Faturamento atribuível** e **valor médio** somam apenas os atendimentos em que aquele serviço foi o **único** — com o recorte visível na célula ("2 de 3").
- Uma linha de reconciliação fecha a conta: *serviço único + combinados = faturamento do período*. O total combinado é calculado **por diferença**, então fecha sempre.

A tabela agrupa por `servicoId` (a relação), **não** pelo texto de `Atendimento.servicosRealizados`: renomear um serviço não mexe no histórico, então agrupar pelo texto quebraria "Banho" em duas linhas depois de uma renomeação. O rótulo exibido é o nome atual. A listagem detalhada, essa sim, usa `servicosRealizados` — ali o que vale é o que foi feito naquele dia.

### Exportação

`/relatorios/export?formato=xlsx|pdf` (route handler, `runtime = "nodejs"`). **Chama `requireSession()` por conta própria** — o `proxy.ts` só confere a assinatura do JWT, então sem essa linha um cookie de sessão já invalidada baixaria o relatório inteiro da loja (ver "Invalidação de sessão").

- **Excel** (`exceljs`): 5 abas — Resumo, Por serviço, Por cliente, Forma de pagamento, Atendimentos (detalhado, com todas as pendências, uma coluna Situação e a coluna **Data do recebimento**, que é por onde a contabilidade refaz a conta do faturamento). Valores vão como **número em reais com formato de moeda**, nunca texto, para a contabilidade poder somar e filtrar. O banco guarda centavos; a conversão fica só em `lib/exportacao/comum.ts`.
- **PDF** (`jspdf` + `jspdf-autotable`): versão de imprimir/enviar. O `autoTable` cuida sozinho da quebra de página e de repetir o cabeçalho da tabela, que é o que a listagem de atendimentos precisa num mês cheio. Sem Chromium de propósito — `puppeteer` foi descartado por não caber numa function da Vercel.
- O gráfico de 12 meses é **CSS puro**, sem biblioteca de gráfico: são 12 valores e uma escala linear, e uma dependência a mais não se pagaria.

> `exceljs` arrasta um `uuid` com CVE moderada (bounds check no `buf` do v3/v5/v6). Não é explorável aqui — o exceljs chama `uuid.v4()` sem `buf` — e o "conserto" do `npm audit` é regredir para `exceljs@3.4.0`. Deixado como está, de olho.

### Responsivo

Tabela de relatório no celular é **rolagem horizontal com a primeira coluna fixa** (`components/relatorios/Tabela.tsx`), não card empilhado: estas tabelas existem para comparar linhas entre si, e em card comparar exige rolar a tela toda. Quem rola é o contêiner da tabela — a página nunca rola na horizontal. A célula fixa precisa de fundo opaco próprio, senão o conteúdo passa por baixo.

## Arquitetura
- Next.js App Router + TypeScript + Tailwind + Prisma, hospedado na Vercel.
- Produção: (URL privada do cliente)
- Banco de dados: Postgres na Neon.
- Fotos de pets: Vercel Blob.
- Acesso via navegador de qualquer dispositivo, protegido por login (2 usuários).
- Acesso restrito a 2 usuários (dono e vice-dona), sem gestão de funcionários. O usuário logado é gravado automaticamente como responsável no histórico de atendimentos.
- Valores monetários sempre em centavos (Int). Valor nulo = "valor a definir" (o atendimento existe mas ainda não tem preço) — nunca é exibido como R$ 0,00 nem entra no faturamento.

## Princípios
Poucos cliques, interface limpa, botões grandes, cadastro e agendamento rápidos, histórico fácil de consultar.

## Design

Redesign visual completo aplicado após os 11 módulos estarem funcionais — identidade de marca própria por cima da mesma UX (nenhuma rota/fluxo/lógica mudou).

- **Cores**: escalas customizadas no Tailwind v4 via `@theme` em `app/globals.css` — `brand-*` (teal #189a9a) e `accent-*` (laranja #f09040), nomeadas assim de propósito para não colidir com as escalas nativas `teal`/`orange` do Tailwind. `600`/`700` são os tons mínimos usados como fundo com texto branco (contraste AA); tons mais claros (`50`/`100`) são só para fundos suaves com texto escuro por cima. Convenção de uso: `brand` para ações primárias genéricas e estados de seleção (pills, tabs, radios), `accent` reservado só pra a ação-hero de cada tela (`+ Novo agendamento`, `Agendar`, os botões de próxima etapa no atendimento, `Confirmar entrega`). As 4 cores de status do agendamento (verde=agendado/amarelo=pronto/azul=finalizado/vermelho=cancelado) continuam com significado operacional fixo — usam tons esmeralda/âmbar/céu/rosa (`components/agenda/statusInfo.ts`) só pra combinar com a paleta, não foram trocadas por brand/accent.
- **Tipografia**: `next/font` com Nunito (`--font-nunito`, display — títulos e botões, aplicada via seletor global a `h1/h2/h3/.font-display`) + Inter (`--font-inter`, texto).
- **Ícones**: `lucide-react` em vez de emoji cru em navegação, botões e indicadores (espécie do pet via `components/agenda/EspecieIcon.tsx`). Emoji só sobrevive em comentários/strings de mensagem (ex. WhatsApp), nunca em UI.
- **Logo**: sem `public/logo.png` — logotipo é SVG próprio em `components/ui/Logo.tsx` (patinha nas cores da marca + wordmark "Mon Petit"), usado no header e no login; `PawPattern` (mesmo arquivo) é a textura de fundo sutil do login.
- **Componentes-base** (`components/ui/`): `Card` (sombra em camadas, cantos bem arredondados), `Button` (variantes `primary`/`accent`/`secondary`/`danger`/`ghost`, elevação sutil no hover), `EmptyState` (ilustração SVG cão+gato para listas vazias), `Input`/`Textarea`/`PhoneInput`/`RadioPills` com foco em `brand`.
- **Atendimento**: `EtapaTimeline` (`components/agenda/EtapaTimeline.tsx`) tem ícone por etapa e um pulso sutil (`animate-ping`) na etapa em andamento — puramente visual, calculado a partir do `concluidos[]`/`rank`. Desde a simplificação do fluxo são 3 degraus (Agendado · Pronto · Entregue) e o primeiro já nasce concluído: o agendamento existir cumpre a etapa.
- **PWA**: `app/manifest.ts` + `app/icon.svg` (patinha teal) substituem o favicon antigo; `viewport.themeColor` teal na barra do navegador mobile; títulos de aba via template `Mon Petit · %s` (`app/layout.tsx` + `metadata`/`generateMetadata` por página).
- Mobile-first mantido: botões com no mínimo 44px de altura, PT-BR em todos os textos.
- **Header com 5 destinos** (desde Relatórios, 01/08/2026): a barra do header é `max-w-5xl`, mais larga que o conteúdo (`max-w-3xl`), e os rótulos de texto da nav — mais o wordmark e o nome do usuário — só aparecem a partir de `lg`. Medido: com os 5 rótulos o header precisa de 860px e estourava os 768px do contêiner antigo, jogando "Relatórios" por cima do nome do usuário. No celular quem rola é a **nav** (`overflow-x-auto`, barra escondida), não a página: apertar o padding até caber quebraria o alvo de toque de 44px.
- **O header não pode depender do tamanho do nome.** Três regras, porque o nome do usuário empurrava a navegação até a lupa da busca encostar no "Caixa" (medido: 8px de folga com "Fernanda"; hoje são 48px no pior caso):
  1. `gap-4 lg:gap-6` entre navegação e bloco do usuário. Gap de flex **não comprime**, então essa folga mínima sobrevive a qualquer nome.
  2. Teto de `max-w-[7.5rem]` (120px) + `truncate` no nome, em `inline-block` (`truncate` não corta elemento `inline`). O avatar fica **fora** desse span, então nunca some, e o nome inteiro vai no `title` do link da conta.
  3. **Nome completo, não só o primeiro.** Chegou a exibir apenas o primeiro nome em 01/08/2026; revertido em 02/08 porque mostra a pessoa errada para quem é chamado pelo segundo nome — o usuário real "Maria Eduarda" aparecia como "Maria". O encurtamento nunca foi o que segurava o layout: quem segura são os itens 1 e 2, e isso foi medido com um nome absurdo ("Wolfeschlegelsteinhausen Silva") sem estouro.
  Testado com "Ana", "Fernanda", "Maria Fernanda Albuquerque" e um primeiro nome extremo, em 390 / 820 / 1280px: a navegação não se move, a lupa mantém 44×44 e o header nunca estoura.
- **Rótulos da nav a partir de `md` (768px)** desde 02/08/2026 — antes era `lg`. Só coube porque o nome do usuário parou de disputar espaço (item acima). Medido em viewport exato: 768px → 16px de folga entre nav e lupa (o mínimo do `gap-4`), 820px → 59px, 1024px → 140px, sem estouro em nenhum. O wordmark e o nome do usuário continuam em `lg`: são eles que não cabem junto dos 5 rótulos abaixo de 1024px.

> Ao medir header em iframe, zere a borda (`border:0` + `outline`) e esconda a barra de rolagem (`html{overflow-y:hidden}`). Os dois somam ~17px e fazem um iframe de 768px virar viewport de 751px — o `md` não casa e a medição mente.

## Status

Diretriz visual em uso desde este passo: mobile-first, botões com no mínimo 44px de altura, PT-BR em todos os textos, componentes reutilizáveis em `components/ui/`.

- [x] Login (sessão via cookie httpOnly assinado com JWT, 30 dias) e middleware/proxy protegendo todas as rotas exceto `/login`
- [x] Módulo 1 — Clientes: listar, criar, editar, excluir (bloqueado se houver pets), ficha com lista de pets, telefone internacional guardado em E.164 com seletor de país (ver "Telefone")
- [x] Módulo 2 — Pets: criar, editar, excluir (bloqueado se houver agendamentos), foto redimensionada para 800px via sharp; `lib/storage.ts` usa Vercel Blob quando `BLOB_READ_WRITE_TOKEN` está definido (produção) e cai para storage local em `/public/uploads` em dev, espécie/sexo em botões grandes, idade por data ou aproximada, observações em destaque na ficha
- [x] Módulo 11 — Padrão do Pet: aba dedicada na ficha do pet, editável e persistida
- [x] Módulo 3 — Agenda: visão de um dia (`/agenda`), navegação ‹ hoje › + seletor de data, cards coloridos por status com borda lateral, ficha do agendamento em `/agendamentos/[id]`, botão flutuante "+ Novo agendamento". Fluxo rápido de criação em tela única (`/agenda/novo`): busca de pet em tempo real (nome do pet ou tutor), atalho "+ Novo cliente/pet" que retorna ao agendamento com o pet pré-selecionado (param `voltar`), horários em passos de 30 min (08:00–18:00) + horário livre, serviços em botões toggle (sem preço), campo de valor livre sempre em branco com máscara R$ 0,00 e teclado numérico, sugestão do último valor cobrado do pet logo abaixo do campo (combinação idêntica de serviços vira "Última vez", senão cai no último atendimento — só preenche com um toque), aviso discreto de horário ocupado (não bloqueia), padrão/observações do pet em destaque. Datas sempre no fuso America/Sao_Paulo via `lib/datas.ts`.
- [x] Módulo 4 — Atendimento: a ficha do agendamento (`/agendamentos/[id]`) virou a tela usada durante o banho/tosa — botão principal de um toque sempre mostrando o próximo passo (Pet pronto → Entregue; ver "Fluxo de atendimento"), linha do tempo visual de 3 degraus (bolinhas conectadas), padrão do pet e observações sempre em destaque amarelo no topo, "Editar agendamento" e "Cancelar agendamento" como botões secundários enquanto o atendimento está em aberto, e "Voltar uma etapa" discreto (corrige toque errado, inclusive desfazendo uma finalização). Ao tocar em "Entregue", abre um painel de fechamento na própria tela (forma de pagamento em botões grandes, total pré-preenchido e editável, observações opcionais), com "Receber depois" para finalizar sem forma de pagamento (preenchível depois pela própria ficha).
- [x] Módulo 5 — Histórico: ao fechar o atendimento, cria automaticamente o registro em `Atendimento` (serviços realizados, valor, forma de pagamento, observações, responsável = usuário logado). Aba "Histórico" na ficha do pet lista os atendimentos do mais recente ao mais antigo, marcando os que ficaram **em aberto** (selo com link para o Caixa) e mostrando "Recebido em DD/MM" só quando a data do recebimento difere da do atendimento. A contagem de atendimentos em aberto do pet é um banner no topo da ficha, visível em **qualquer aba** — não pode depender de alguém lembrar de abrir o Histórico.
- [x] Módulo 6 — Serviços (`/servicos`): lista só com o nome (serviço não tem preço), editar em formulário simples (`/servicos/[id]/editar`, renomear não afeta o histórico — cada `Atendimento` guarda os nomes em `servicosRealizados`), "+ Novo serviço", "Desativar"/"Reativar" (`ativo=false` some da tela de novo agendamento mas segue nos históricos), validação de nome duplicado.
- [x] Módulo 7 — Caixa (`/caixa`): visão de um dia (mesmo padrão ‹ hoje › da agenda) listando os **recebimentos do dia** — filtra por `Atendimento.dataRecebimento`, não pela data do atendimento (regime de caixa), e marca com um selo "atendimento de DD/MM" o recebimento atrasado. Acima disso, a seção **"A receber"** com **todas as pendências em aberto de qualquer data** (ordenadas da mais antiga, com data do atendimento, pet, tutor, serviços, valor e "há X dias" colorido por faixa: neutro < 7 dias, âmbar ≥ 7, vermelho ≥ 30), total pendente em destaque, botão **Receber** (painel com valor pré-preenchido e **editável** — o cliente pode acertar diferente — mais forma de pagamento e confirmação) e botão **Cobrar** no WhatsApp. Rodapé fixo com o recebido do dia em destaque, total a receber e contagem de atendimentos sem valor definido (as duas últimas linhas são **globais**, e o rótulo diz "no total" para não parecer que não fecham com o dia) e mini-resumo por forma de pagamento em ordem estável.
- [x] Módulo 8 — Busca (`/busca`): ícone 🔍 sempre acessível no header, campo único pesquisando em tempo real por nome do pet, nome do tutor ou trecho de telefone (ignora acentos/maiúsculas via `lib/texto.ts`, reaproveitado também na busca de pet do agendamento; telefone comparado pelos dígitos — tanto o E.164 completo quanto o número sem o código do país, com mínimo de 3 para não "inundar" a lista a cada tecla; ver "Telefone"). Resultados em cards grandes separados por Pets e Clientes, estado vazio amigável.
- [x] Módulo 9 — WhatsApp: `lib/whatsapp.ts` centraliza as mensagens prontas (fácil de editar) e a normalização do telefone para o formato do wa.me (só dígitos, com o código do país que vem do próprio telefone — nunca `55` chutado; ver "Telefone"). "Confirmar horário" (ficha do agendamento, status agendado, com "hoje"/"amanhã"/"no dia DD/MM" conforme a data), "Pet pronto" (status Pronto ou Finalizado) e "Agradecimento" (agendamento finalizado e também sempre na ficha do pet). Botões grandes verdes (`components/ui/WhatsappButton.tsx`); sem telefone válido, o botão fica desabilitado com aviso. **As mensagens concordam gênero** — ver abaixo.

## Telefone (02/08/2026)

O telefone era gravado como o atendente digitasse — "(41) 99999-0000", "41988887777" — e o link do WhatsApp prefixava `55` fixo. Um número do Canadá virava `wa.me/554165551234`: link inválido. Hoje **o país faz parte do dado**.

- **Guardado em E.164**: `+5541999990000`, `+14165551234`. Uma migration só de dados (`20260802195612_normaliza_telefone_e164`) converteu o que existia assumindo Brasil.
- **Exibido legível**: brasileiro no formato local `(41) 99999-0000`, estrangeiro com o código visível `+1 416 555 1234`.
- **wa.me usa o número completo**, sem forçar DDI nenhum.

Tudo passa por `lib/telefone.ts` — `paraE164`, `formatarTelefone`, `telefoneValido`, `digitosDeBusca`, `mascaraAoDigitar`. **Não formate nem monte telefone na mão em tela nenhuma.**

### Três decisões que custaram bug

**1. Brasil NÃO é formatado pela biblioteca.** `formatNational()` do libphonenumber devolve `"2833334444"` — sem agrupamento — para `+552833334444`, um número antigo de 8 dígitos que existe no cadastro real. Usar a biblioteca aqui seria regressão visível: a ficha mostra "(28) 3333-4444" hoje. A regra brasileira é local e **incondicional** (não é "usa a biblioteca e cai no nosso se falhar"): previsível vale mais que esperto. A biblioteca cuida de parse, detecção de país, E.164, validação e formatação estrangeira.

**2. Nome de país vem de arquivo GERADO, não de `Intl.DisplayNames`.** O ICU do Node e o do Chrome divergem — servidor renderizava "Hong Kong, RAE da China", navegador "Hong Kong" — e isso estourava **erro de hidratação do React em toda tela com o campo de telefone**. `lib/paises.ts` é gerado por `scripts/gerar-nomes-paises.mjs` e congelado no repositório.

**3. `isPossible()`, não `isValid()`, decide o que é gravado.** Sem essa checagem a biblioteca aceita fragmento: `"3333"` viraria `"+553333"`, inventando um país que ninguém informou. O que não dá para entender é guardado **como foi digitado**, e `formatarTelefone()` devolve texto cru nesse caso — mesmo princípio de valor nulo nunca virar R$ 0,00. Validade é assunto do **aviso**, não da gravação: o formulário avisa em âmbar e **deixa salvar**, porque cadastro rápido é prioridade e a cliente pode ter um número atípico.

### Campo

`components/ui/PhoneInput.tsx`: seletor de país (Brasil pré-selecionado, então o caso comum continua sendo um campo só) + número. **Sem bandeira** — emoji não entra na interface (ver Design); o rótulo é `+55 Brasil`, com o código na frente de propósito, porque em tela estreita o select corta o fim do texto. Digitar `+1 416...` troca o seletor sozinho.

O formulário manda o **texto cru + o país**; quem converte para E.164 é o servidor (`lerTelefone` em `clientes/actions.ts`). O campo escondido não é fonte de verdade — existe uma conversão só, e cliente e servidor não têm como discordar.

> A máscara brasileira é idêntica à de antes (mesma função, mesmos cortes). Ela **tira a máscara antes de remascarar**: o campo é controlado, então o que chega a cada tecla já vem formatado da vez anterior — sem isso os parênteses se acumulam e "41999990000" vira `((() () ()-`.

### Busca

`digitosDeBusca()` devolve **dois** recortes: o E.164 completo e o número sem o código do país. Quem procura digita o número local ("99999"), não "5541999990000" — e sem o recorte nacional uma busca por "41" passaria a competir com o "55" que agora está na frente de todo telefone brasileiro.

### Concordância de gênero (02/08/2026)

Os textos que citam o pet pelo nome usavam masculino fixo, então uma cadela virava "do Mila" e "O Mila foi um amor" — e isso chegava assim no WhatsApp da cliente. Hoje a concordância vem do campo `Pet.sexo`, por `lib/genero.ts` (`comArtigo`, `comArtigoMaiusculo`, `deArtigo`).

Cinco textos usam isso: as 4 mensagens do WhatsApp (incluindo a cobrança, 02/08/2026) e a confirmação de cancelamento (`CancelarAgendamentoForm`). **Ao escrever qualquer frase nova que cite o pet pelo nome, use esses helpers** em vez de escrever "o"/"do" na mão.

Sem sexo conhecido, a regra é **reformular a frase**, nunca chutar masculino: some o artigo ("Confirmando o horário **de** Mila", "Mila foi um amor") e o "Pet pronto" troca o adjetivo flexionado por um infinitivo ("Já pode vir buscar Mila"). Note que `Pet.sexo` é **NOT NULL** e o formulário obriga a escolha, então esse caminho não é alcançável hoje — ele existe para o dia em que o campo virar opcional, e para a decisão ficar num lugar só.

"Excluir o pet {nome}?" **não** entra nessa regra: ali o artigo concorda com a palavra "pet" (substantivo masculino), não com o animal.
- [x] Módulo 10 — Dashboard inicial (`/`, rota inicial após login): saudação (bom dia/boa tarde/boa noite conforme o horário de Brasília) com nome do usuário e data por extenso, 4 cards de contagem do dia coloridos por status — Agendados, Prontos (pets esperando retirada, a informação que importa no balcão), Finalizados, Cancelados — (tocar leva à agenda de hoje), faturamento em 3 cards — dia em destaque (tocar leva ao `/caixa`), semana (segunda a domingo) e mês (dia 1 até hoje) menores, lado a lado a partir do tablet e empilhados no celular; contam só atendimentos pagos, **pela data do recebimento**, e a lógica é compartilhada com o Caixa via `lib/faturamento.ts` para nunca divergir, banner de **valores em aberto** com o total (de qualquer data, e fora do bloco condicional de "tem agendamento hoje" — num dia parado é justamente quando dá para cobrar), lista "Pendentes de hoje" com os agendamentos ainda não finalizados (máx. 5, link "Ver agenda completa"), atalhos grandes (+ Novo agendamento · Buscar · Caixa), estado vazio amigável quando não há nada no dia. Header com navegação compacta (ícones) em telas estreitas para não quebrar no celular.

- [x] Módulo 12 — Relatórios (`/relatorios`): filtro de período (Este mês · Mês passado · Últimos 3 meses · Este ano · intervalo personalizado; padrão = mês atual), box explicando o que está sendo contado, 4 cards (faturamento, atendimentos, ticket médio, cancelados), banner de pendências fora do faturamento, box "Como o faturamento se compõe" (reconcilia recebido × realizado), gráfico de 12 meses, tabelas por serviço (com a reconciliação do rateio), por cliente/pet (ordenável por qualquer coluna) e por forma de pagamento, listagem dos atendimentos do período, e exportação em Excel (5 abas) e PDF. Ver "Relatórios" acima.

Todos os 11 módulos da especificação original estão concluídos, mais o módulo 12 (Relatórios), pedido depois.

## Deploy

- Produção: (URL privada do cliente) (projeto Vercel `mon-petit-sistema`).
- Deploy automático: o projeto está conectado ao repositório GitHub `KSKluc4/mon-petit-sistema` — todo push na branch `master` gera um novo deploy de produção. Deploy manual, se precisar: `vercel --prod`.
- **Push na branch `teste` gera um deploy de Preview**, que é o ambiente de teste com cópia dos dados da loja — ver "Ambiente de teste (staging)".
- Banco: branch `production` do projeto Neon `mon-petit` (`DATABASE_URL`). Dev e teste usam branches separadas — ver "Ambientes de banco".
- Variáveis de ambiente de produção (Vercel → Project Settings → Environment Variables, escopo Production): `DATABASE_URL`, `SESSION_SECRET` (gerado à parte do valor de dev) e `BLOB_READ_WRITE_TOKEN` (injetado automaticamente ao conectar o Blob store ao projeto).
- Build de produção roda `prisma generate && next build && prisma migrate deploy` (`package.json`): toda migration em `prisma/migrations` já commitada é aplicada automaticamente, mas **depois** do build, para um build quebrado não deixar o banco migrado com o código velho no ar (ver "Migrations no deploy" abaixo). Não é preciso rodar `prisma migrate deploy` manualmente.
- Conta do usuário logado (`/conta`, menu do usuário → ícone 👤): editar o próprio nome (usado na saudação do dashboard e gravado como responsável no histórico de atendimentos — o cookie de sessão é re-assinado na hora, sem precisar logar de novo) e alterar a própria senha. Logins e nomes de exibição são independentes. **Conferido na produção em 02/08/2026**: logins `usuario1` e `usuario2`. Eram `dono`/`vice` no seed inicial — foram renomeados depois, então não confie no seed para descobrir o login: consulte o banco.
- **Esqueceu a senha, no dia a dia (sem serviço de e-mail)**: como só existem 2 usuários, cada um pode redefinir a senha do outro. Em `/conta` → "Redefinir senha do outro usuário", digitar a nova senha para o colega + a PRÓPRIA senha como confirmação de identidade (protege contra alguém mexer num aparelho destravado). O link "Esqueci minha senha" em `/login` só explica esse fluxo (sem formulário de e-mail — pede pro outro usuário fazer a redefinição). Redefinir força a sessão antiga do outro usuário a cair no próximo carregamento de página (ver "Invalidação de sessão" abaixo).
- **Esqueceu a senha, os DOIS ao mesmo tempo (procedimento de emergência)**: `npx tsx scripts/reset-senha.ts <login> <novaSenha> --producao` gera o hash bcrypt e atualiza o usuário direto no banco, sem passar pela tela de login nem pelo fluxo acima. Como o `.env` local aponta para a branch de dev, é preciso apontar a `DATABASE_URL` para a produção só nessa hora (`npx neonctl connection-string production --project-id SEU-PROJECT-ID`) — e o `--producao` é obrigatório, senão o script recusa (ver "Ambientes de banco"). Ele imprime o banco alvo antes de agir: confira que diz `[PRODUÇÃO — a loja]`. Ex.: `npx tsx scripts/reset-senha.ts usuario1 NovaSenha123 --producao` (os logins reais são `usuario1` e `usuario2` — **não** `dono`/`vice`, que só existiram no seed).
- **Invalidação de sessão** (`Usuario.sessionVersion`, JWT stateless): o JWT carrega o `sessionVersion` visto no momento do login (`sv`); `getSession()` (`lib/auth.ts`) compara com o valor atual no banco a cada chamada e trata como sessão inválida se não bater. Redefinir a senha do outro usuário incrementa esse campo, então qualquer sessão já aberta dele é derrubada — sem precisar de tabela de sessões. Importante: o **middleware** (`proxy.ts`) só confere a assinatura do JWT (rápido, sem tocar o banco) — quem decide se a sessão ainda vale de verdade são `getSession()`/`app/login/page.tsx`. Por isso a checagem "já logado, não mostra /login" mora na própria página de login (com acesso ao banco) e não no middleware: se o middleware redirecionasse pra fora de `/login` só com base na assinatura do JWT, uma sessão invalidada no banco mas com JWT ainda válido ficaria presa num loop entre `/` e `/login`.

## Ambientes de banco

Desde 31/07/2026 **dev e produção são branches separadas** do mesmo projeto Neon (`mon-petit`, id `SEU-PROJECT-ID`). Antes disso eram o mesmo banco, e foi exatamente assim que a produção quebrou em 29/07 — ver "Regras permanentes" no topo.

| Ambiente | Branch Neon | Endpoint | Quem usa | Onde mora a URL |
|---|---|---|---|---|
| **Produção** (a loja) | `production` (default) — `br-id-producao` | `ep-seu-endpoint-producao` | o site no ar | só na Vercel, escopo Production |
| **Teste** (staging) | `teste` — `br-id-teste` | `ep-seu-endpoint-teste` | os deploys de Preview | só na Vercel, escopo Preview |
| **Dev** | `dev` — `br-id-dev` | `ep-seu-endpoint-dev` | máquina local | `.env` (não commitado) |

O `.env` local **nunca** deve apontar para a produção. Se precisar da URL de produção (para um dump, por exemplo), gere na hora em vez de guardá-la: `npx neonctl connection-string production --project-id SEU-PROJECT-ID`.

No `.env` de dev use o host **direto**, sem `-pooler`: `migrate dev` usa advisory lock e o pooler em modo transaction o derruba com `P1002`. O runtime do app é o contrário — lá o pooled é o certo, e é o que a Vercel usa.

### A trava

Três lugares abrem o banco por caminhos diferentes, e os três checam o ambiente. A lógica é uma só, em `lib/ambiente.ts` — **é lá que se atualiza o endpoint de produção** se ele mudar.

| Onde | O que protege | Comportamento |
|---|---|---|
| `prisma.config.ts` | a Prisma CLI | bloqueia `migrate dev`, `migrate reset`, `db push` |
| `prisma/seed.ts` | o seed | bloqueia; libera com `PERMITIR_SEED_PRODUCAO=1` |
| `scripts/reset-senha.ts` | o reset de senha | exige `--producao` por escrito |

Sempre **duas camadas**: (1) a URL é o endpoint conhecido de produção, e (2) o `.env` não declara `AMBIENTE=dev`. A segunda fecha por padrão, então uma URL de produção *nova* — ou copiada da Vercel para um `.env` qualquer — também é barrada. A Vercel nunca define `AMBIENTE`.

`prisma generate` e `prisma migrate deploy` **não** são bloqueados, de propósito: o primeiro roda no `postinstall` e o segundo é como a produção aplica migration no build. Travar qualquer um dos dois derrubaria `npm install` e todo deploy.

O `reset-senha` é o único que aceita produção como alvo legítimo — é o procedimento de emergência para quando os dois usuários perdem a senha, e aí o único banco que importa é o da loja. Por isso ele não bloqueia: exige `--producao` explícito, e imprime o banco alvo antes de agir.

**A trava não distingue `teste` de `dev`** — ela conhece um endpoint só, o da produção. Para a branch `teste`, `ehProducao()` é `false` e `descreverBanco()` imprime `[dev]`; com `AMBIENTE=dev` no `.env`, `migrate dev`, `migrate reset` e `db push` são **permitidos** contra o staging. Isso é de propósito: o staging é descartável (é uma cópia da produção que some no primeiro `branches reset`), então errar a mão lá custa um reset, não a loja. Só não se engane com o rótulo `[dev]` num terminal apontado para o `teste`: o que ele afirma é "não é a produção", não "é a sua máquina".

### Ambiente de teste (staging) — 03/08/2026

Um lugar para treinar, conferir um recurso novo e ensaiar migration **com os dados de verdade**, sem tocar na loja. O `dev` também é cópia da produção, mas roda **só na máquina de quem programa** — o teste é um site no ar, que a dona abre do próprio celular.

É isso que cria o risco que as duas proteções abaixo endereçam: **dado real num ambiente descartável**, com telefones de clientes de verdade dentro.

- **Banco**: branch `teste` da Neon, criada a partir da `production`. **Descartável de propósito**: `npx neonctl branches reset teste --parent --project-id SEU-PROJECT-ID` a traz de volta ao estado da loja, e tudo que foi feito lá some. Nada de atendimento de verdade aqui.
- **Deploy**: push na branch git `teste` → deploy de Preview na Vercel. O build é o mesmo da produção, então `prisma migrate deploy` roda contra a branch `teste` — **é aqui que uma migration nova é ensaiada contra dado real antes de chegar na loja**.
- **Variáveis**: escopo **Preview** na Vercel — `DATABASE_URL` (branch `teste`), `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN` e `NEXT_PUBLIC_AMBIENTE=teste`. Os logins e senhas são os da produção, porque o banco é cópia. O `SESSION_SECRET` é entrada **própria** do escopo Preview e deve ser mantido diferente do de produção — é o que impede uma sessão aberta no teste de valer na loja.

#### As duas proteções, e por que são inertes na produção

As duas dependem de `NEXT_PUBLIC_AMBIENTE`, que **só existe no escopo Preview**. Sem a variável nada disso renderiza — **não há como esquecer isto ligado no ar**. A resposta mora em `lib/ambienteCliente.ts` (`EH_AMBIENTE_TESTE`), fonte única.

**1. Tarja + título da aba.** A tarja fica no layout **RAIZ**, não no grupo `(app)`: a primeira tela é o `/login`, que está fora do grupo — sem isso a cliente digitaria a senha sem nenhum aviso de onde está. O aviso vai **também no título da aba** (`[TESTE] Mon Petit · %s`), porque a tarja rola para fora da tela numa página longa e o título não. Duas camadas para o mesmo risco: confundir teste com produção e trabalhar de verdade num banco que some no primeiro reset.

**2. WhatsApp abre prévia, não `wa.me`.** O staging isola o banco, **não o mundo lá fora**: o telefone vem da cópia da produção, então um toque mandaria mensagem de teste para um cliente de verdade — o risco mais perigoso deste ambiente e o menos evidente. O botão continua verde, no mesmo lugar e clicável, mas abre a **prévia** com o texto exato e para quem iria. Desabilitar esconderia o que o botão faz; um número fixo ainda abre o WhatsApp e depende de alguém manter esse número certo. A prévia responde melhor "o que este botão faria?" — e é justamente a mensagem que se quer conferir (concordância de gênero, nome do pet, valor).

> Duas armadilhas, já escritas no próprio `lib/ambienteCliente.ts`: **não troque por checagem de hostname** (a URL de preview muda a cada deploy — a regra passaria a depender de um dado que ninguém controla), e **mudar a variável exige rebuild** (`NEXT_PUBLIC_` é embutida no bundle, não lida em tempo de execução).

`WhatsappButton` virou componente de cliente para poder abrir/fechar a prévia; na produção renderiza exatamente a mesma âncora de antes.

#### O dev local também liga as duas proteções (04/08/2026)

O staging nasceu protegido e o **dev local não** — e o dev é o ambiente com o risco mais antigo: a branch `dev` da Neon também é cópia da produção, então os telefones ali são de clientes reais, e `NEXT_PUBLIC_AMBIENTE` só existia no escopo Preview da Vercel. Na máquina local `EH_AMBIENTE_TESTE` era `false`: sem tarja, e o botão do WhatsApp abrindo o **wa.me de verdade**. Testar "Confirmar horário" mandava mensagem para o cliente — o mesmo risco que o staging tratou como "o mais perigoso e o menos evidente", solto justamente onde se mexe no código todo dia.

Fechado pondo `NEXT_PUBLIC_AMBIENTE="teste"` no `.env` local, e no `.env.example` para a próxima máquina já nascer assim. **Não exigiu mudança de código nenhuma** — é a mesma variável, a mesma `EH_AMBIENTE_TESTE`, a mesma fonte única; foi para isso que ela não depende de hostname.

A produção continua intocada: quem define a variável é o `.env` (não commitado) e o escopo Preview da Vercel. Nenhum dos dois existe no build de produção.

### Fluxo de migration daqui pra frente

1. Confira que o `.env` aponta para a branch `dev` (`AMBIENTE=dev`).
2. Edite `prisma/schema.prisma`.
3. `npx prisma migrate dev --name <nome_curto>` — cria e aplica **só no dev**.
4. Teste (`npm run lint`, `npm run build`, o app rodando).
5. Commit da migration **junto** com o código que depende dela. Para migration de risco, push antes na branch `teste` — o deploy de Preview aplica ela contra uma cópia da produção, que é o ensaio mais próximo do real que existe aqui. Depois push no `master`.
6. A Vercel aplica na produção no build, via `prisma migrate deploy`. **Não** rode `migrate deploy` à mão contra a produção — deixe o deploy fazer.

Para mudança destrutiva (dropar coluna, tornar `NOT NULL`), continua valendo o expand/contract da seção "Migrations no deploy": dois deploys, nunca um. E dispare o backup antes.

### Recriar ou renovar a branch de dev

```bash
# a branch de dev ficou velha? sincroniza com a produção de novo:
npx neonctl branches reset dev --parent --project-id SEU-PROJECT-ID

# criar uma branch nova (outra pessoa, outra máquina):
npx neonctl branches create --project-id SEU-PROJECT-ID --name dev-fulano --parent production
npx neonctl connection-string dev-fulano --project-id SEU-PROJECT-ID   # host DIRETO
```

Depois é só pôr a URL no `.env` com `AMBIENTE=dev`. Nenhuma alteração de código é necessária — a trava reconhece qualquer branch que não seja a de produção.

Requer `npx neonctl auth` uma vez por máquina.

## Backup do banco

O banco é a única coisa insubstituível do sistema (o código está no Git; o cadastro de clientes/pets e o histórico de atendimentos, não). Duas camadas independentes — o passo a passo de ativar e restaurar está no README.

- **Camada 1 — Point-in-Time Restore da Neon** (principal): a Neon mantém histórico de alterações e restaura o banco para qualquer instante dentro da janela de retenção, via Console → *Branches* → *Restore*. A janela depende do plano (gratuito = horas; pagos = dias a um mês) e se ajusta em *Settings → Storage / History retention*. **O valor do plano atual precisa ser conferido no console** — não foi possível verificar a partir do repositório.
- **Camada 2 — dump diário fora da Neon**: `.github/workflows/backup-banco.yml` roda `scripts/backup-banco.sh` todo dia às 06:12 UTC (03:12 em Brasília) e guarda o `.dump` como artifact do GitHub Actions, com retenção de 30 dias. Existe porque o PITR não cobre perda da conta/projeto Neon. Depende do secret `DATABASE_URL_BACKUP` (conexão **direta**, sem `-pooler`: o PgBouncer em modo transaction trunca o `pg_dump`). Também roda sob demanda por *workflow_dispatch* — o hábito recomendado é disparar antes de todo deploy com migration nova. **Primeira execução bem-sucedida em 02/08/2026** (antes disso o secret não existia e, depois de criado, o `pg_dump` era velho demais — ver abaixo).
- **A versão do `pg_dump` tem que acompanhar a Neon.** O `pg_dump` recusa banco de major maior que a dele (`aborting because of server version mismatch`), e a Neon sobe de versão sozinha — já foi de 16 para **18.4** sem aviso. Duas armadilhas, as duas já pagas: instalar `postgresql-client-N` **não basta**, porque o pgdg instala em `/usr/lib/postgresql/N/bin` e o runner já tem um `pg_dump` mais velho em `/usr/bin` ganhando no PATH — o passo passa verde com a versão errada. Por isso o workflow instala o metapacote `postgresql-client` (a mais nova do pgdg), entra com a maior major encontrada no `GITHUB_PATH`, e **confere a versão num passo separado** antes de tentar o dump. Nada de major fixada na mão.
- O script trata como falha um dump com menos de 2 KB (dump vazio saindo com código 0 é a falha silenciosa clássica), descarta o arquivo ruim e nunca sobrescreve um backup existente (o carimbo de data tem resolução de 1 segundo, então duas execuções seguidas colidiriam de nome).
- Ciclo `pg_dump` → `pg_restore` validado contra um Postgres 16 local: contagens de todas as tabelas idênticas, schema preservado e `_prisma_migrations` incluído (o banco restaurado não tenta reaplicar migrations).

## Migrations no deploy (decisão tomada)

O build era `prisma generate && prisma migrate deploy && next build`: se o `next build` falhasse, o banco já estava migrado e a Vercel mantinha o deploy anterior no ar — **código velho contra schema novo**. Opções avaliadas:

- **(A) Inverter a ordem** — `prisma generate && next build && prisma migrate deploy`. Uma linha; elimina exatamente esse cenário (build quebra → banco intacto). Se a migration falhar, o comando sai com código ≠ 0 e a Vercel não promove o deploy. Contras: só funciona enquanto nenhuma rota precisar do schema novo *durante* o build; e sobra uma janela de segundos entre migrar e promover. **ADOTADA.**
- **(B) Tirar a migration do build** e rodar `prisma migrate deploy` à mão (ou num workflow com aprovação). Controle total e dá para fazer backup imediatamente antes. Contra: troca um risco raro (build falhar) por um frequente (esquecer de migrar e subir código que espera colunas inexistentes) — ruim para 2 pessoas sem rotina de ops.
- **(C) Expand/contract** — nunca fazer mudança destrutiva no mesmo deploy do código que a acompanha. A migration `valor_livre_por_atendimento` seria 2 passos: primeiro parar de usar `Servico.valorPadrao`, depois dropar a coluna num deploy seguinte. É a solução de raiz (torna o deploy reversível), ao custo de 2–3 deploys por mudança destrutiva. **ADOTADA como regra de processo** (não é código: depende de dividir a mudança na hora de escrever a migration).
- **(D) Backup sob demanda antes de migrar** — disparar o workflow de backup antes do deploy. Não previne, mas garante recuperação. **ADOTADA como hábito** (*Actions → Backup do banco → Run workflow*).
- **(E) Banco separado por ambiente** (Neon branches). **ADOTADA em 31/07/2026** — ver "Ambientes de banco". Era a causa raiz do incidente de 29/07.

**Implementado: A + C + D + E.** (B) foi descartada (troca um risco raro por um frequente).

**(E) — fechado em 31/07/2026.** Duas coisas foram verificadas: `vercel env ls` confirma que `DATABASE_URL` está **só no escopo Production** (deploy de preview não roda migration na produção — esse risco nunca existiu); e o risco de verdade, a máquina de dev apontando para o banco da loja, foi eliminado criando a branch `dev` na Neon e trancando os comandos destrutivos. Ver "Ambientes de banco".

Verificado ao adotar (A): com o `next build` falhando, o `&&` corta a sequência e o `prisma migrate deploy` não chega a rodar (exit 1). As únicas rotas estáticas do build são `/_not-found`, `/icon.svg` e `/manifest.webmanifest`, nenhuma delas lê o banco — se um dia alguma página estática passar a ler o banco, essa ordem precisa ser revista.

**Ressalva importante:** nenhuma ordenação protege contra uma migration que roda com sucesso mas está errada (um `DROP COLUMN` indesejado, por exemplo). Contra isso só existe backup/PITR — por isso o backup vem antes desta decisão.

### Drift do `motivoCancelamento` — RESOLVIDO em 31/07/2026

A coluna `Agendamento.motivoCancelamento` existia no banco mas não no `schema.prisma`, sobra do trabalho de "cancelar/editar agendamento" que foi descartado. Isso fazia `prisma migrate dev` acusar drift e se oferecer para **resetar o banco** — que na época era o de produção.

Resolvido declarando a coluna no schema (nullable, ainda sem uso em código, à espera da refação do recurso) e registrando-a em `20260731183200_declara_motivo_cancelamento`, com `ADD COLUMN IF NOT EXISTS` para ser no-op num banco que já a tem e efetiva num banco novo ou restaurado de dump anterior a 29/07. Conferido com `prisma migrate diff` do banco ao vivo contra o schema: *"No difference detected"*.

**Não há drift conhecido hoje.** Se `migrate dev` voltar a oferecer reset, é sinal de drift novo — pare e investigue antes de aceitar.

> ⚠️ **A branch `descarte/local-divergente` (local, não enviada) contém `restaura_valor_padrao_servico` — a migration que causou a queda de 29/07.** Nunca faça merge dessa branch nem rode `migrate deploy` a partir dela: isso recria `Servico.valorPadrao` e quebra a produção de novo. Ela existe só como arquivo morto do trabalho descartado; para aproveitar algo dali, copie o código à mão e deixe a pasta `prisma/migrations` de fora.

# Mon Petit — Sistema de gestão

Sistema interno do Pet Shop Mon Petit (Campo Largo/PR): clientes, pets, agenda,
atendimento, histórico, caixa e dashboard. Usado no dia a dia por 2 pessoas, em
tablet no balcão e no celular.

A especificação do produto e o estado de cada módulo estão no [CLAUDE.md](./CLAUDE.md).

> **Versão vitrine.** Este repositório é uma cópia pública do sistema, publicada
> com autorização do cliente para portfólio. Telefones, nomes de usuários,
> identificadores de infraestrutura e a URL de produção foram trocados por
> exemplos, e o workflow de backup diário foi removido (em repositório público
> os artifacts com o dump do banco ficariam acessíveis). O sistema em uso pela
> loja continua num repositório privado.

- **Produção:** (URL privada do cliente)
- **Stack:** Next.js (App Router) · TypeScript · Tailwind · Prisma · Postgres (Neon) · Vercel

## Rodando localmente

```bash
npm install
cp .env.example .env     # preencha DATABASE_URL e SESSION_SECRET
npx prisma migrate deploy
npm run dev              # http://localhost:3000
```

Sem `BLOB_READ_WRITE_TOKEN`, as fotos de pets vão para `/public/uploads` em vez
do Vercel Blob — suficiente para desenvolvimento.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `prisma generate && next build && prisma migrate deploy` |
| `npm run lint` | ESLint |
| `npx prisma db seed` | Serviços iniciais + os 2 usuários |
| `npx tsx scripts/reset-senha.ts <login> <senha> [--producao]` | Emergência: redefine senha direto no banco (`--producao` é obrigatório para mirar a loja) |
| `./scripts/backup-banco.sh [pasta]` | Dump manual do banco (ver abaixo) |

## Deploy

Todo push na branch `master` dispara deploy de produção na Vercel.

Cada ambiente tem seu **próprio banco** — três branches do mesmo projeto Neon,
separadas desde 31/07/2026 (antes disso dev e produção compartilhavam o mesmo
Postgres, e foi assim que a produção quebrou):

| Ambiente | Branch Neon | Como se chega lá |
| --- | --- | --- |
| Produção | `production` | push na branch `master` |
| Teste (staging) | `teste` | push na branch `teste` → deploy de Preview |
| Dev | `dev` | `npm run dev` na máquina local (`.env`) |

O staging é uma **cópia da produção**, com dados de verdade: traz tarja de aviso
em todas as telas e o botão do WhatsApp abre uma prévia da mensagem em vez de
enviá-la — o banco é isolado, os telefones dos clientes não. É descartável
(`neonctl branches reset teste --parent`), então não faça atendimento real lá.

Comandos destrutivos da Prisma (`migrate dev`, `migrate reset`, `db push`) são
bloqueados quando a `DATABASE_URL` aponta para a produção. Detalhes das travas e
o fluxo de migration estão em `CLAUDE.md` → "Ambientes de banco".

## Backup e restauração

O banco é a única coisa insubstituível do sistema: o código está no Git, mas o
cadastro de clientes, pets e o histórico de atendimentos, não. São duas camadas
independentes.

### Camada 1 — Point-in-Time Restore da Neon (principal)

A Neon não guarda "arquivos de backup": ela mantém um histórico de alterações
que permite restaurar o banco para **qualquer instante** dentro de uma janela de
retenção. É mais preciso que um dump diário — dá para voltar para "5 minutos
antes do acidente" em vez de perder o dia inteiro.

**Conferir e ajustar a janela** (Neon Console → projeto → *Settings* →
*Storage* / *History retention*): a janela depende do plano — no gratuito é
curta (horas) e nos planos pagos vai de alguns dias a um mês. **Confirme o valor
do plano atual no console** e suba para pelo menos 7 dias se estiver menor.

**Restaurar:** Neon Console → *Branches* → selecione a branch (`production`) →
*Restore* → escolha o instante. A Neon cria automaticamente uma branch com o
estado anterior à restauração, então a operação em si é reversível.

Antes de restaurar a produção, vale restaurar para uma **branch nova** e
conferir os dados ali — a branch tem uma connection string própria e não afeta
quem está usando o sistema.

### Camada 2 — Dump diário no GitHub Actions (independente)

O PITR da Neon não ajuda se o problema for a conta ou o projeto Neon em si
(exclusão acidental, fim do plano, perda de acesso). Por isso há um dump diário
guardado fora da Neon.

- **Workflow:** `.github/workflows/backup-banco.yml` (só no repositório privado — ver o aviso no topo)
- **Script:** [`scripts/backup-banco.sh`](./scripts/backup-banco.sh)
- **Quando:** todo dia às 06:12 UTC (03:12 em Brasília, loja fechada). Também
  dá para rodar na mão em *Actions → Backup do banco → Run workflow* — faça isso
  antes de qualquer deploy que traga migration nova.
- **Onde ficam os arquivos:** como *artifact* da execução, em
  *Actions → Backup do banco → (execução) → Artifacts*, com retenção de **30
  dias**. O arquivo se chama `monpetit-<data-hora>.dump`.

**Configuração necessária (uma vez):** criar o secret `DATABASE_URL_BACKUP` em
*Settings → Secrets and variables → Actions* com a connection string da Neon.

> Use a conexão **direta**, não a do pooler. O host do pooler tem `-pooler` no
> nome e roda PgBouncer em modo *transaction*, que não suporta as transações
> longas do `pg_dump` — o dump sai truncado. O script recusa URLs com `-pooler`
> justamente para evitar isso.

O script falha de propósito se o dump sair com menos de 2 KB (dump vazio que
"passa" é a falha silenciosa clássica de backup), descarta o arquivo ruim e
nunca sobrescreve um backup já existente.

**Restaurar um dump:**

```bash
# 1. Baixe e descompacte o artifact do GitHub Actions.
# 2. Restaure num banco NOVO primeiro (na Neon: crie uma branch e use a URL dela).
pg_restore --no-owner --no-privileges -d "$URL_DO_BANCO_NOVO" monpetit-2026-07-28T061200Z.dump

# 3. Confira os dados. Só então aponte a aplicação para lá.
```

Para sobrescrever um banco existente, acrescente `--clean --if-exists` — isso
**apaga** os objetos atuais antes de recriar, então só use com certeza absoluta.

O dump inclui a tabela `_prisma_migrations`, então o banco restaurado já sabe
quais migrations foram aplicadas e o `prisma migrate deploy` não tenta reaplicar
nada.

**Duas ressalvas honestas:**

- O artifact contém dados pessoais de clientes (nomes, telefones). O repositório
  é privado, mas qualquer pessoa com acesso de leitura consegue baixar.
- O GitHub desativa workflows agendados após 60 dias sem atividade no
  repositório. Se o projeto ficar parado, o backup diário para de rodar em
  silêncio — vale conferir a aba Actions de vez em quando.

## Migrations no deploy

`npm run build` roda `prisma generate && next build && prisma migrate deploy` —
a migration é a **última** etapa, de propósito. Se o `next build` falhar, o
`&&` corta a sequência e o banco não é tocado; se a migration falhar, o comando
sai com código ≠ 0 e a Vercel não promove o deploy. Antes a ordem era inversa e
um build quebrado deixava o banco migrado com o código velho no ar.

Duas regras que valem junto com isso (o raciocínio completo está no
[CLAUDE.md](./CLAUDE.md)):

- **Mudança destrutiva nunca vai no mesmo deploy do código que a acompanha.**
  Dropar ou renomear coluna vira 2 deploys: primeiro o código para de usar,
  depois a coluna sai. Isso mantém o deploy reversível.
- **Rode o backup sob demanda antes de subir migration nova**
  (*Actions → Backup do banco → Run workflow*). Nenhuma ordenação protege
  contra uma migration que roda com sucesso e está errada — só backup protege.

// Inventário do banco: lista o que existe hoje, para decidir o que limpar
// antes do uso real. Uso:
//   npx tsx scripts/inventario-banco.ts
// Roda contra a DATABASE_URL do .env, que é a branch de DEV. Para inventariar
// a PRODUÇÃO, gere a URL na hora e passe inline — ela nunca vai para o .env
// (CLAUDE.md → "Ambientes de banco"):
//   DATABASE_URL="$(npx neonctl connection-string production \
//     --project-id SEU-PROJECT-ID --database-name neondb)" \
//     npx tsx scripts/inventario-banco.ts
// A primeira linha da saída diz contra qual banco ele rodou.
//
// ESTE SCRIPT SÓ LÊ. Não existe nenhum create/update/delete aqui, de propósito:
// a remoção é um passo separado, feito depois de olhar esta lista.
//
// Não vai para o bundle, mas ENTRA no typecheck do `next build`: o tsconfig
// inclui `**/*.ts` e o next.config.ts não ignora erro de tipo. Um erro de tipo
// aqui quebra o build e derruba o deploy — rode `npx tsc --noEmit` ao mexer.
//
// NÃO importe lib/telefone.ts aqui. Ele monta a lista de países no momento do
// import (getCountryCallingCode), e sob tsx (CJS) o libphonenumber-js/min
// entrega a metadata como `{ default }` e estoura antes da primeira linha:
// "`metadata` argument was passed but it's not a valid metadata". No app não
// acontece porque o bundler do Next resolve o interop. Por isso o telefone sai
// CRU, em E.164 — num inventário isso é até melhor para identificar o registro.
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { descreverBanco } from "../lib/ambiente";
import { formatCentavos, formatDataCurta, formatHora } from "../lib/datas";

const LINHA = "─".repeat(76);

function cabecalho(titulo: string) {
  console.log(`\n${LINHA}\n${titulo}\n${LINHA}`);
}

async function main() {
  console.log(`Banco: ${descreverBanco()}`);

  const [clientes, pets, agendamentos, atendimentos, servicos] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: { criadoEm: "asc" },
      include: { _count: { select: { pets: true } } },
    }),
    prisma.pet.findMany({
      orderBy: { nome: "asc" },
      include: { cliente: { select: { nome: true } }, _count: { select: { agendamentos: true } } },
    }),
    prisma.agendamento.findMany({
      orderBy: { dataHora: "asc" },
      include: {
        pet: { select: { nome: true, cliente: { select: { nome: true } } } },
        servicos: { include: { servico: { select: { nome: true } } } },
        atendimento: { select: { id: true } },
      },
    }),
    prisma.atendimento.findMany({
      orderBy: { data: "asc" },
      include: {
        forma: true,
        agendamento: { select: { pet: { select: { nome: true, cliente: { select: { nome: true } } } } } },
      },
    }),
    prisma.servico.findMany({ orderBy: { nome: "asc" } }),
  ]);

  cabecalho("RESUMO");
  console.log(`Clientes ................ ${clientes.length}`);
  console.log(`Pets .................... ${pets.length}`);
  console.log(`Agendamentos ............ ${agendamentos.length}`);
  console.log(`Atendimentos (histórico)  ${atendimentos.length}`);
  console.log(`Serviços ................ ${servicos.length}  (não serão tocados)`);

  cabecalho(`CLIENTES (${clientes.length})`);
  for (const c of clientes) {
    console.log(
      `${c.id}  ${c.nome} · ${c.telefone} ·${c._count.pets} pet(s) · cadastrado em ${formatDataCurta(c.criadoEm)}`,
    );
  }
  if (clientes.length === 0) console.log("(nenhum)");

  cabecalho(`PETS (${pets.length})`);
  for (const p of pets) {
    console.log(
      `${p.id}  ${p.nome} (${p.especie === "CAO" ? "cão" : "gato"}) · tutor: ${p.cliente.nome} · ${p._count.agendamentos} agendamento(s)`,
    );
  }
  if (pets.length === 0) console.log("(nenhum)");

  cabecalho(`AGENDAMENTOS (${agendamentos.length})`);
  for (const a of agendamentos) {
    const servs = a.servicos.map((s) => s.servico.nome).join(" + ") || "sem serviços";
    const valor = a.valorTotal === null ? "valor a definir" : formatCentavos(a.valorTotal);
    console.log(
      `${a.id}  ${formatDataCurta(a.dataHora)} ${formatHora(a.dataHora)} · ${a.pet.nome} (${a.pet.cliente.nome}) · ${a.status} · ${servs} · ${valor}${a.atendimento ? " · tem histórico" : ""}`,
    );
  }
  if (agendamentos.length === 0) console.log("(nenhum)");

  cabecalho(`ATENDIMENTOS FINALIZADOS (${atendimentos.length})`);
  for (const at of atendimentos) {
    const valor = at.valorTotal === null ? "valor a definir" : formatCentavos(at.valorTotal);
    console.log(
      `${at.id}  ${formatDataCurta(at.data)} · ${at.agendamento.pet.nome} (${at.agendamento.pet.cliente.nome}) · ${at.servicosRealizados} · ${valor} · ${at.forma?.nome ?? "a receber"} · por ${at.responsavel}`,
    );
  }
  if (atendimentos.length === 0) console.log("(nenhum)");

  cabecalho(`SERVIÇOS (${servicos.length}) — apenas conferência, não serão tocados`);
  for (const s of servicos) {
    console.log(`${s.id}  ${s.nome}${s.ativo ? "" : "  (desativado)"}`);
  }

  console.log(`\n${LINHA}`);
  console.log("Nada foi alterado — este script só lê.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

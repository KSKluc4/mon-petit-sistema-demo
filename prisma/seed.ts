import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { descreverBanco, ehDevDeclarado, ehProducao } from "../lib/ambiente";

// O seed abre o banco direto pela DATABASE_URL, sem passar pela Prisma CLI, então
// a trava do prisma.config.ts não o alcança — a checagem precisa estar aqui.
// Rodar isto contra a loja recriaria serviços desativados e, num banco sem os
// usuários, criaria "dono"/"vice" com a senha temporária pública deste arquivo.
function protegerProducao(): void {
  if (!ehProducao() && ehDevDeclarado()) return;
  if (process.env["PERMITIR_SEED_PRODUCAO"] === "1") {
    console.warn(`\n  ATENÇÃO: seed liberado manualmente em ${descreverBanco()}\n`);
    return;
  }
  console.error(
    [
      "",
      "  BLOQUEADO: seed fora de um ambiente de dev.",
      "",
      `  Banco alvo : ${descreverBanco()}`,
      "",
      "  Aponte o .env para uma branch de dev da Neon (com AMBIENTE=dev).",
      "  Se for mesmo a primeira carga de um banco novo de produção, rode:",
      "    PERMITIR_SEED_PRODUCAO=1 npx prisma db seed",
      "",
      '  Detalhes em CLAUDE.md → "Ambientes de banco".',
      "",
    ].join("\n")
  );
  process.exit(1);
}

protegerProducao();

// Serviço não tem preço: o valor é livre e definido em cada atendimento.
const SERVICOS = [
  "Banho",
  "Tosa Corpo",
  "Tosa Higiênica",
  "Tosa na Tesoura",
  "Hidratação",
  "Corte de Unhas",
  "Desembolo",
];

// Senha temporária para os 2 únicos usuários do sistema — trocar depois.
// Vem do ambiente (SEED_SENHA) para nunca ficar escrita no repositório.
const SENHA_TEMPORARIA = process.env["SEED_SENHA"] ?? "";
if (SENHA_TEMPORARIA.length < 8) {
  console.error("Defina SEED_SENHA (mínimo 8 caracteres) para rodar o seed.");
  process.exit(1);
}

async function main() {
  for (const nome of SERVICOS) {
    await prisma.servico.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  const senhaHash = await bcrypt.hash(SENHA_TEMPORARIA, 10);

  await prisma.usuario.upsert({
    where: { login: "dono" },
    update: {},
    create: { nome: "Dono", login: "dono", senhaHash },
  });

  await prisma.usuario.upsert({
    where: { login: "vice" },
    update: {},
    create: { nome: "Vice-dona", login: "vice", senhaHash },
  });

  console.log(`Seed concluído: ${SERVICOS.length} serviços e 2 usuários.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

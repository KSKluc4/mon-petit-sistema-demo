// Script de emergência: redefine a senha de um usuário direto no banco,
// sem passar pela tela de login. Uso:
//   npx tsx scripts/reset-senha.ts <login> <novaSenha> [--producao]
//
// Este script abre o banco direto pela DATABASE_URL, sem passar pela Prisma CLI,
// então a trava do prisma.config.ts não o alcança.
//
// Diferente do seed, aqui a PRODUÇÃO é um alvo legítimo: o script existe
// justamente para o caso de os dois usuários perderem a senha ao mesmo tempo, e
// nesse cenário o único banco que importa é o da loja. Por isso a produção não é
// bloqueada — é exigida por escrito, com `--producao`. Assim uma rodada por
// engano (com o .env ainda apontando para a loja) falha antes de trocar a senha
// da dona, mas o procedimento de emergência documentado continua possível.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { descreverBanco, ehDevDeclarado, ehProducao } from "../lib/ambiente";

async function main() {
  const args = process.argv.slice(2);
  const confirmouProducao = args.includes("--producao");
  const [login, novaSenha] = args.filter((a) => !a.startsWith("--"));

  if (!login || !novaSenha) {
    console.error("Uso: npx tsx scripts/reset-senha.ts <login> <novaSenha> [--producao]");
    process.exit(1);
  }

  // Duas camadas, como no prisma.config.ts. A primeira pega o .env que declara
  // AMBIENTE=dev mas aponta para a loja mesmo assim; a segunda fecha por padrão
  // em qualquer banco não declarado como dev — inclusive um endpoint de produção
  // novo, que a comparação por endpoint sozinha não reconheceria.
  console.log(`Banco alvo: ${descreverBanco()}`);
  if ((ehProducao() || !ehDevDeclarado()) && !confirmouProducao) {
    console.error(
      [
        "",
        "  BLOQUEADO: este não é um ambiente de dev declarado.",
        "",
        "  Se a intenção é MESMO redefinir a senha na loja, repita o comando",
        "  com --producao no fim:",
        `    npx tsx scripts/reset-senha.ts ${login} <novaSenha> --producao`,
        "",
        "  Se não era, aponte o .env para uma branch de dev (com AMBIENTE=dev).",
        "",
        '  Detalhes em CLAUDE.md → "Ambientes de banco".',
        "",
      ].join("\n")
    );
    process.exit(1);
  }
  if (novaSenha.length < 8) {
    console.error("A nova senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const usuario = await prisma.usuario.findUnique({ where: { login } });
  if (!usuario) {
    console.error(`Nenhum usuário encontrado com login "${login}".`);
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });

  console.log(`Senha de "${login}" (${usuario.nome}) redefinida com sucesso.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

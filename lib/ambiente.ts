// Fonte única da verdade sobre "que banco é este?".
//
// Existe porque dev e produção compartilharam o mesmo Postgres Neon até
// 31/07/2026 — e foi assim que a produção quebrou (ver CLAUDE.md → "Regras
// permanentes"). Hoje os ambientes são branches separadas da Neon, e este
// módulo é o que impede uma DATABASE_URL apontada para a loja de receber
// comando destrutivo por engano.
//
// Usado em três lugares que abrem o banco por caminhos diferentes:
//   - prisma.config.ts     → trava a Prisma CLI (migrate dev/reset, db push)
//   - prisma/seed.ts       → trava o seed
//   - scripts/reset-senha.ts → exige confirmação explícita
//
// Sem dependência de código do app de propósito: a Prisma CLI carrega o
// prisma.config.ts fora do bundle do Next, então este arquivo tem que ser
// importável sozinho.

/**
 * Endpoint da branch de PRODUÇÃO na Neon (a loja).
 * Comparado sem o sufixo `-pooler` para pegar tanto a URL pooled quanto a direta.
 * Se a produção um dia mudar de endpoint, é aqui que se atualiza.
 */
export const ENDPOINT_PRODUCAO = "ep-seu-endpoint-producao";

/** A URL aponta para o banco da loja? */
export function ehProducao(url = process.env["DATABASE_URL"] ?? ""): boolean {
  return url.includes(ENDPOINT_PRODUCAO);
}

/**
 * O `.env` declara explicitamente que este é um ambiente de desenvolvimento?
 * A Vercel nunca define `AMBIENTE`, então produção é sempre `false` — é isso
 * que faz a checagem fechar por padrão em vez de depender só do endpoint.
 */
export function ehDevDeclarado(): boolean {
  return process.env["AMBIENTE"] === "dev";
}

/** Host + banco, sem usuário nem senha — seguro para log e mensagem de erro. */
export function descreverBanco(url = process.env["DATABASE_URL"] ?? ""): string {
  const m = /^\w+:\/\/[^:]+:[^@]+@([^/]+)\/([^?]+)/.exec(url);
  if (!m) return "(DATABASE_URL ausente ou em formato inesperado)";
  const rotulo = ehProducao(url) ? "PRODUÇÃO — a loja" : "dev";
  return `${m[1]}/${m[2]}  [${rotulo}]`;
}

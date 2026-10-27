// Regera `lib/paises.ts` — a lista congelada de nomes de país em PT-BR.
//
// Os nomes NÃO são calculados em tempo de execução de propósito: a tabela ICU
// do Node e a do Chrome divergem (o servidor dizia "Hong Kong, RAE da China" e
// o navegador "Hong Kong"), o que estourava erro de hidratação do React em toda
// tela com o campo de telefone. Congelar em arquivo faz servidor e cliente
// renderizarem exatamente o mesmo texto.
//
// Rode só quando quiser atualizar a lista (país novo, nome mudou):
//   node scripts/gerar-nomes-paises.mjs
//
// Depois confira o diff antes de commitar: uma atualização de ICU pode mexer em
// nomes que já estavam bons.
import { writeFileSync } from "node:fs";
import { getCountries } from "libphonenumber-js/min";

const nomes = new Intl.DisplayNames(["pt-BR"], { type: "region" });

const linhas = getCountries()
  .sort()
  .map((codigo) => `  ${codigo}: ${JSON.stringify(nomes.of(codigo) ?? codigo)},`);

const conteudo = `// GERADO — não editar à mão.
//
// Nomes de país em PT-BR congelados em arquivo em vez de calculados com
// \`Intl.DisplayNames\` em tempo de execução. Motivo concreto: a tabela ICU do
// Node e a do Chrome não batem — o servidor renderizava "Hong Kong, RAE da
// China" e o navegador "Hong Kong", e isso estourava erro de hidratação do
// React em toda tela com o campo de telefone, fazendo a árvore ser recriada no
// cliente.
//
// Congelado com o ICU do Node em 02/08/2026. Para atualizar, rode:
//   node scripts/gerar-nomes-paises.mjs
export const NOMES_PAISES: Record<string, string> = {
${linhas.join("\n")}
};
`;

writeFileSync("lib/paises.ts", conteudo);
console.log(`lib/paises.ts gerado com ${linhas.length} países`);

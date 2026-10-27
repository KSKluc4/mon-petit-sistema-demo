import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import { NOMES_PAISES } from "./paises";

/**
 * Telefone do sistema: guardado em E.164 (`+5541999990000`), exibido bonito.
 *
 * Até 02/08/2026 o telefone era gravado como o atendente digitasse e o link do
 * WhatsApp prefixava `55` fixo — um número do Canadá virava link inválido.
 * Agora o país faz parte do dado.
 *
 * Sem "server-only": o formulário de cliente (componente de cliente) e a busca
 * usam as mesmas funções que as telas de servidor.
 *
 * Usa `libphonenumber-js/min` — o bundle de metadata menor, suficiente para
 * parsear, validar e formatar qualquer país.
 */

// Reexportado com nome próprio para o resto do sistema não importar tipo da
// biblioteca direto — trocar de biblioteca um dia mexe só neste arquivo.
export type CodigoPais = CountryCode;

export const PAIS_PADRAO: CountryCode = "BR";

/**
 * Formatação brasileira feita AQUI, não pelo `formatNational()` da biblioteca.
 *
 * Motivo concreto: `+552833334444` (DDD 28, número antigo de 8 dígitos, de
 * antes do 9º dígito) é aceito como válido pela biblioteca, mas o
 * `formatNational()` devolve `"2833334444"` — sem agrupamento nenhum. Como já
 * existe número assim no cadastro, deixar a biblioteca formatar seria uma
 * regressão visível: hoje a ficha mostra "(28) 3333-4444" e passaria a mostrar
 * a tira de dígitos.
 *
 * A regra local é incondicional (não é "usa a biblioteca e cai aqui se falhar")
 * porque previsível vale mais que esperto: todo número brasileiro sai daqui.
 */
function formatarNacionalBR(nacional: string): string {
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  // Fragmento fora do padrão: devolve como está em vez de inventar grupos.
  return nacional;
}

/**
 * Máscara enquanto se digita — vai agrupando aos poucos, ao contrário da de
 * exibição, que só formata número completo. É a mesma regra que o campo já
 * tinha antes do suporte internacional, mantida igual de propósito: digitar
 * telefone brasileiro tem que continuar exatamente como era.
 */
function mascaraProgressivaBR(texto: string): string {
  // Tira a máscara ANTES de remascarar. O campo é controlado, então o que chega
  // aqui a cada tecla já vem formatado da vez anterior — sem esta linha os
  // parênteses se acumulam e "41999990000" vira "((() () ()-".
  const d = texto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * O texto digitado + o país escolhido viram E.164, ou `null` se não der para
 * entender. Nunca lança.
 *
 * É a ÚNICA conversão do sistema: o formulário manda o texto cru e o país, e o
 * servidor chama isto. Assim cliente e servidor não podem discordar.
 */
export function paraE164(bruto: string, pais: CountryCode = PAIS_PADRAO): string | null {
  const texto = bruto.trim();
  if (!texto) return null;
  // Com "+" o próprio texto manda no país; sem "+", vale o país selecionado.
  const parsed = parsePhoneNumberFromString(texto, texto.startsWith("+") ? undefined : pais);
  if (!parsed) return null;
  // `isPossible()` (comprimento plausível para o país), e não `isValid()`
  // (prefixo existe de verdade): validade é assunto do aviso, não da gravação —
  // número atípico tem que poder ser salvo.
  //
  // Sem esta checagem a biblioteca aceita fragmento: "3333" viraria
  // "+553333", inventando um país que ninguém informou. Quando devolve null,
  // quem chama guarda o texto como foi digitado — o mesmo princípio de não
  // transformar valor nulo em R$ 0,00.
  return parsed.isPossible() ? parsed.number : null;
}

/**
 * Exibição legível. Tolerante de propósito: valor que não parseia volta como
 * veio, em vez de sumir ou virar erro — cobre linha legada e banco restaurado
 * de dump anterior à migration.
 */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return "";
  const parsed = parsePhoneNumberFromString(valor);
  if (!parsed) return valor;
  if (parsed.country === "BR") return formatarNacionalBR(parsed.nationalNumber);
  return parsed.formatInternational();
}

/** Só avisa; nunca bloqueia o cadastro (a dona pode ter um número atípico). */
export function telefoneValido(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return parsePhoneNumberFromString(valor)?.isValid() ?? false;
}

export function paisDoTelefone(valor: string | null | undefined): CountryCode | null {
  if (!valor) return null;
  return parsePhoneNumberFromString(valor)?.country ?? null;
}

/**
 * O que o campo de edição precisa mostrar: o número SEM o código do país, já
 * que o país vive no seletor ao lado.
 */
export function partesParaEdicao(valor: string | null | undefined): {
  pais: CountryCode;
  nacional: string;
} {
  const parsed = valor ? parsePhoneNumberFromString(valor) : null;
  if (!parsed?.country) {
    // Sem país reconhecido, devolve o texto cru para não perder o que já estava
    // gravado — o atendente corrige por cima.
    return { pais: PAIS_PADRAO, nacional: valor ?? "" };
  }
  return { pais: parsed.country, nacional: parsed.nationalNumber };
}

/**
 * Máscara ao vivo enquanto digita, no padrão do país escolhido.
 * Para o Brasil usa a regra local (mesmo motivo de `formatarNacionalBR`);
 * para os outros, o `AsYouType` da biblioteca.
 */
export function mascaraAoDigitar(texto: string, pais: CountryCode): string {
  if (texto.startsWith("+")) return new AsYouType().input(texto);
  if (pais === "BR") return mascaraProgressivaBR(texto);
  return new AsYouType(pais).input(texto);
}

/**
 * Dígitos usados na busca por telefone. Devolve os dois recortes porque quem
 * procura digita o número LOCAL ("99999"), não o E.164 — e sem o recorte
 * nacional uma busca por "41" passaria a competir com o "55" do país.
 */
export function digitosDeBusca(valor: string | null | undefined): string[] {
  if (!valor) return [];
  const completo = valor.replace(/\D/g, "");
  const nacional = parsePhoneNumberFromString(valor)?.nationalNumber ?? "";
  return nacional && nacional !== completo ? [completo, nacional] : [completo];
}

// --- Lista de países do seletor ---

// Sem bandeira: emoji não entra na interface (CLAUDE.md → Design). O rótulo é
// "+55 Brasil", que também é o que o leitor de tela anuncia.
//
// Os nomes vêm de `lib/paises.ts`, um arquivo GERADO, e não de
// `Intl.DisplayNames` em tempo de execução: o ICU do Node e o do Chrome
// divergem ("Hong Kong, RAE da China" contra "Hong Kong") e isso quebrava a
// hidratação do React em toda tela com este campo. Ver scripts/gerar-nomes-paises.mjs.

// Os que aparecem no balcão de verdade, no topo da lista para não obrigar a
// rolar 200 países no caso comum.
const FREQUENTES: CountryCode[] = ["BR", "US", "CA", "PT", "AR", "PY", "UY", "ES", "IT", "JP"];

export type OpcaoPais = { codigo: CountryCode; nome: string; ddi: string };

function montarOpcao(codigo: CountryCode): OpcaoPais {
  return {
    codigo,
    nome: NOMES_PAISES[codigo] ?? codigo,
    ddi: `+${getCountryCallingCode(codigo)}`,
  };
}

export const PAISES_FREQUENTES: OpcaoPais[] = FREQUENTES.map(montarOpcao);

export const PAISES_TODOS: OpcaoPais[] = getCountries()
  .map(montarOpcao)
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

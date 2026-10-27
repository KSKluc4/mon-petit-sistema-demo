// Normalização de texto para busca: ignora acentos e maiúsculas/minúsculas.
// A faixa de diacríticos (U+0300–U+036F) é montada a partir dos codepoints,
// em vez de caracteres combinantes literais no arquivo, para não depender
// da codificação com que o arquivo é salvo/lido.
const INICIO_DIACRITICOS = String.fromCharCode(0x0300);
const FIM_DIACRITICOS = String.fromCharCode(0x036f);
const DIACRITICOS = new RegExp(`[${INICIO_DIACRITICOS}-${FIM_DIACRITICOS}]`, "g");

export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

// Só os dígitos de um telefone, para comparar ignorando máscara/formatação.
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

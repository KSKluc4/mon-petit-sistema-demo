// Valida um caminho de retorno interno (evita open redirect): precisa começar
// com "/" e não pode ser protocolo-relativo ("//host").
export function voltarSeguro(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

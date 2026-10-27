// Helpers de data/hora fixados no fuso da loja (Campo Largo/PR).
// O Brasil não tem horário de verão desde 2019, então o offset é estável.
export const TIMEZONE = "America/Sao_Paulo";
const OFFSET = "-03:00";

const ISO_DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function dataISOValida(data: string): boolean {
  return ISO_DATA_REGEX.test(data) && !Number.isNaN(Date.parse(`${data}T12:00:00${OFFSET}`));
}

export function horaValida(hora: string): boolean {
  return HORA_REGEX.test(hora);
}

// Data de hoje no fuso da loja, como "YYYY-MM-DD" (en-CA formata nesse padrão).
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

// Constrói o Date (UTC) correspondente a uma data+hora locais da loja.
export function dataHoraLocal(dataISO: string, hora: string): Date {
  return new Date(`${dataISO}T${hora}:00${OFFSET}`);
}

export function intervaloDoDia(dataISO: string): { inicio: Date; fim: Date } {
  const inicio = new Date(`${dataISO}T00:00:00${OFFSET}`);
  return { inicio, fim: new Date(inicio.getTime() + 24 * 60 * 60 * 1000) };
}

// Semana da loja: segunda a domingo. getUTCDay() no Date construído às 12:00
// locais é seguro porque 12:00-03:00 = 15:00 UTC, mesmo dia da semana.
export function intervaloDaSemana(dataISO: string): { inicio: Date; fim: Date } {
  const diaSemana = new Date(`${dataISO}T12:00:00${OFFSET}`).getUTCDay();
  // Domingo (0) fecha a semana que começou na segunda 6 dias antes.
  const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
  const segunda = addDias(dataISO, -diasDesdeSegunda);
  const inicio = new Date(`${segunda}T00:00:00${OFFSET}`);
  return { inicio, fim: new Date(`${addDias(segunda, 7)}T00:00:00${OFFSET}`) };
}

// Do dia 1 do mês até o fim do dia informado.
export function intervaloDoMes(dataISO: string): { inicio: Date; fim: Date } {
  const primeiroDia = `${dataISO.slice(0, 7)}-01`;
  return {
    inicio: new Date(`${primeiroDia}T00:00:00${OFFSET}`),
    fim: new Date(`${addDias(dataISO, 1)}T00:00:00${OFFSET}`),
  };
}

// A data (YYYY-MM-DD) de um Date no fuso da loja. O servidor roda em UTC na
// Vercel, então um atendimento das 22h do dia 31 é dia 1 em UTC e cairia no mês
// errado se alguém formatasse sem fixar o fuso.
export function dataISODe(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
}

// Dias inteiros entre duas datas ISO. Ancorado ao meio-dia dos dois lados, então
// não existe borda de horário de verão nem erro de arredondamento.
export function diasEntre(deISO: string, ateISO: string): number {
  const de = new Date(`${deISO}T12:00:00${OFFSET}`).getTime();
  const ate = new Date(`${ateISO}T12:00:00${OFFSET}`).getTime();
  return Math.round((ate - de) / (24 * 60 * 60 * 1000));
}

// Primeiro dia do mês de uma data ("2026-08-14" -> "2026-08-01").
export function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

// Soma (ou subtrai) meses, sempre devolvendo o DIA 1 do mês resultante. Só
// opera em primeiro-de-mês de propósito: assim não existe o problema clássico
// de "31 de janeiro + 1 mês" cair num 31 de fevereiro inexistente.
export function addMeses(dataISO: string, meses: number): string {
  const ano = Number(dataISO.slice(0, 4));
  const indiceMes = Number(dataISO.slice(5, 7)) - 1 + meses;
  const anoFinal = ano + Math.floor(indiceMes / 12);
  const mesFinal = ((indiceMes % 12) + 12) % 12;
  return `${String(anoFinal).padStart(4, "0")}-${String(mesFinal + 1).padStart(2, "0")}-01`;
}

// Último dia do mês da data informada ("2026-02-10" -> "2026-02-28").
export function ultimoDiaDoMes(dataISO: string): string {
  return addDias(addMeses(dataISO, 1), -1);
}

// Intervalo [início, fim) cobrindo os dois dias informados por inteiro — o fim
// é exclusivo (00:00 do dia seguinte), igual aos outros intervalos do arquivo.
export function intervaloEntre(inicioISO: string, fimISO: string): { inicio: Date; fim: Date } {
  return {
    inicio: new Date(`${inicioISO}T00:00:00${OFFSET}`),
    fim: new Date(`${addDias(fimISO, 1)}T00:00:00${OFFSET}`),
  };
}

// "14/08/2026" a partir de uma data ISO, sem depender do fuso: é só remontar a
// string. Usar `formatDataCurta` aqui exigiria criar um Date só pra formatar.
export function formatDataISO(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// "ago/26" — rótulo curto das barras do gráfico de evolução.
export function formatMesAnoCurto(dataISO: string): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    month: "short",
    year: "2-digit",
  }).format(new Date(`${dataISO}T12:00:00${OFFSET}`));
  return texto.replace(" de ", "/").replace(".", "");
}

// "agosto de 2026" — título por extenso do mês.
export function formatMesAnoExtenso(dataISO: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(`${dataISO}T12:00:00${OFFSET}`));
}

export function addDias(dataISO: string, dias: number): string {
  const d = new Date(new Date(`${dataISO}T12:00:00${OFFSET}`).getTime() + dias * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
}

export function formatHora(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDataExtenso(dataISO: string): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dataISO}T12:00:00${OFFSET}`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatDataCurta(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

// "Bom dia"/"Boa tarde"/"Boa noite" conforme o horário de Brasília.
export function saudacaoAtual(): string {
  const hora = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(
      new Date(),
    ),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// "12/07" — usado no botão de sugestão de último valor.
export function formatDiaMes(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit" }).format(d);
}

export function formatCentavos(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

// Valor de tela sem o "R$" ("95,00", "1.250,00") — o prefixo fica fora do campo
// nos inputs de valor. Nulo vira string vazia (campo em branco).
export function formatValorEditavel(centavos: number | null): string {
  if (centavos === null) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
}

// Máscara R$ 0,00: considera só os dígitos digitados e trata os 2 últimos como
// centavos, então digitar "9500" vira 95,00 sem o usuário mexer na vírgula.
export function digitosParaCentavos(texto: string): number | null {
  const digitos = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digitos) return null;
  return Number(digitos);
}


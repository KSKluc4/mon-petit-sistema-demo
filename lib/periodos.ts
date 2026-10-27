import {
  addMeses,
  dataISOValida,
  formatDataISO,
  formatMesAnoExtenso,
  hojeISO,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
} from "./datas";

// Sem "server-only": a tela de Relatórios (servidor), o route handler de
// exportação e o seletor de período (cliente) resolvem o mesmo período com
// estas funções, então o arquivo precisa rodar dos dois lados.

export const ATALHOS = [
  { id: "mes", label: "Este mês" },
  { id: "mes-passado", label: "Mês passado" },
  { id: "3-meses", label: "Últimos 3 meses" },
  { id: "ano", label: "Este ano" },
] as const;

export type AtalhoPeriodo = (typeof ATALHOS)[number]["id"];

export type Periodo = {
  inicioISO: string;
  fimISO: string;
  // Qual atalho está ativo, ou null quando o intervalo é personalizado.
  atalho: AtalhoPeriodo | null;
  // Texto por extenso do que está sendo mostrado, usado na tela e no PDF.
  rotulo: string;
};

function periodoDoAtalho(atalho: AtalhoPeriodo, hoje: string): { inicioISO: string; fimISO: string } {
  switch (atalho) {
    case "mes":
      return { inicioISO: primeiroDiaDoMes(hoje), fimISO: hoje };
    case "mes-passado": {
      const mesPassado = addMeses(primeiroDiaDoMes(hoje), -1);
      return { inicioISO: mesPassado, fimISO: ultimoDiaDoMes(mesPassado) };
    }
    case "3-meses":
      // Os 3 meses correntes: mês atual + os 2 anteriores, até hoje.
      return { inicioISO: addMeses(primeiroDiaDoMes(hoje), -2), fimISO: hoje };
    case "ano":
      return { inicioISO: `${hoje.slice(0, 4)}-01-01`, fimISO: hoje };
  }
}

function rotularPeriodo(
  atalho: AtalhoPeriodo | null,
  inicioISO: string,
  fimISO: string,
): string {
  if (atalho === "mes-passado" || (atalho === "mes" && inicioISO === primeiroDiaDoMes(fimISO))) {
    const mes = formatMesAnoExtenso(inicioISO);
    const nome = mes.charAt(0).toUpperCase() + mes.slice(1);
    // Mês em curso: dizer "até hoje" evita que ela compare um mês pela metade
    // com um mês fechado sem perceber.
    return atalho === "mes" ? `${nome} (até ${formatDataISO(fimISO)})` : nome;
  }
  return `${formatDataISO(inicioISO)} a ${formatDataISO(fimISO)}`;
}

/**
 * Resolve o período a partir dos parâmetros da URL.
 *
 * Precedência: um intervalo personalizado válido (`de`+`ate`) ganha do atalho;
 * senão vale o atalho; sem nada, o padrão é o mês atual. Datas inválidas ou
 * invertidas caem no padrão em vez de estourar — é uma tela de leitura, e a URL
 * pode ser editada à mão ou vir de um link antigo.
 */
export function resolverPeriodo(params: {
  atalho?: string;
  de?: string;
  ate?: string;
  hoje?: string;
}): Periodo {
  const hoje = params.hoje ?? hojeISO();

  if (params.de && params.ate && dataISOValida(params.de) && dataISOValida(params.ate)) {
    // Intervalo invertido é quase sempre erro de digitação: desinverte em vez
    // de devolver um período vazio que pareceria "nenhum atendimento".
    const [inicioISO, fimISO] = params.de <= params.ate ? [params.de, params.ate] : [params.ate, params.de];
    return { inicioISO, fimISO, atalho: null, rotulo: rotularPeriodo(null, inicioISO, fimISO) };
  }

  const atalho = ATALHOS.some((a) => a.id === params.atalho)
    ? (params.atalho as AtalhoPeriodo)
    : "mes";
  const { inicioISO, fimISO } = periodoDoAtalho(atalho, hoje);
  return { inicioISO, fimISO, atalho, rotulo: rotularPeriodo(atalho, inicioISO, fimISO) };
}

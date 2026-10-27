import type { StatusAgendamento } from "@/app/generated/prisma/client";

// Cores por status (spec do CLAUDE.md): verde=agendado, amarelo=pronto,
// azul=finalizado, vermelho=cancelado — significado operacional, não é livre
// pra trocar. Tons refinados (esmeralda/âmbar/céu/coral) pra combinar com a
// paleta da marca. Fundo suave + borda lateral forte + dot na badge.
export const STATUS_INFO: Record<
  StatusAgendamento,
  { label: string; card: string; badge: string; dot: string }
> = {
  AGENDADO: {
    label: "Agendado",
    card: "bg-emerald-50 border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  PRONTO: {
    label: "Pronto",
    card: "bg-amber-50 border-l-amber-500",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  FINALIZADO: {
    label: "Finalizado",
    card: "bg-sky-50 border-l-sky-500",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
  },
  CANCELADO: {
    label: "Cancelado",
    card: "bg-rose-50 border-l-rose-500",
    badge: "bg-rose-100 text-rose-800",
    dot: "bg-rose-500",
  },
  // Fluxo antigo: nenhum agendamento fica mais neste status (a migration
  // `simplifica_fluxo_atendimento` converteu todos para AGENDADO). A entrada
  // sobrevive enquanto o valor existir no enum para que uma linha perdida
  // apareça como agendada em vez de quebrar a agenda com `info` undefined.
  EM_ATENDIMENTO: {
    label: "Agendado",
    card: "bg-emerald-50 border-l-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
};

// Status que a interface mostra, na ordem do fluxo. Deliberadamente uma lista
// explícita, e não `Object.keys(STATUS_INFO)`: o enum ainda carrega
// EM_ATENDIMENTO, que não deve virar card nem contador em tela nenhuma.
export const STATUS_VISIVEIS = [
  "AGENDADO",
  "PRONTO",
  "FINALIZADO",
  "CANCELADO",
] as const satisfies readonly StatusAgendamento[];

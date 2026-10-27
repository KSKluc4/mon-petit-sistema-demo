import type { StatusAgendamento } from "@/app/generated/prisma/client";

// Posição no fluxo, derivada só do status — não existe mais etapa intermediária
// desde a simplificação de 01/08/2026.
// 0 = agendado (ou cancelado) · 1 = pronto para retirada · 2 = entregue
export function calcularRank(status: StatusAgendamento): number {
  if (status === "FINALIZADO") return 2;
  if (status === "PRONTO") return 1;
  return 0; // AGENDADO, CANCELADO ou o legado EM_ATENDIMENTO
}

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { WhatsappButton } from "@/components/ui/WhatsappButton";
import { formatCentavos, formatDataCurta } from "@/lib/datas";
import { mensagemCobranca } from "@/lib/whatsapp";
import type { Pendencia } from "@/lib/faturamento";
import type { FormaSelecionavel } from "@/lib/pagamento";
import { ReceberForm } from "./ReceberForm";

// Faixas de cor por idade da dívida. Uma conta de uma semana não é a mesma
// coisa que uma de dois meses, e a cor é o que faz a diferença ser notada sem
// ninguém ler número nenhum.
function faixaDeAtraso(dias: number): { texto: string; classe: string } {
  // Atendimento com data futura existe (agendamento adiantado, relógio fora de
  // hora) e renderizava "há -11 dias". Nada em aberto pode ter atraso negativo.
  const texto = dias <= 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`;
  if (dias >= 30) return { texto, classe: "bg-rose-100 text-rose-800" };
  if (dias >= 7) return { texto, classe: "bg-amber-100 text-amber-800" };
  return { texto, classe: "bg-neutral-100 text-neutral-600" };
}

export function PendenciaCard({
  pendencia,
  formas,
}: {
  pendencia: Pendencia;
  formas: FormaSelecionavel[];
}) {
  const atraso = faixaDeAtraso(pendencia.diasEmAberto);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {formatDataCurta(pendencia.data)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${atraso.classe}`}>
              {atraso.texto}
            </span>
          </div>
          <Link
            href={`/agendamentos/${pendencia.agendamentoId}`}
            className="mt-0.5 block truncate font-semibold text-neutral-900 hover:underline"
          >
            {pendencia.petNome}
          </Link>
          <p className="truncate text-sm text-neutral-500">{pendencia.tutorNome}</p>
          <p className="text-sm text-neutral-600">{pendencia.servicos}</p>
        </div>
        {pendencia.valorTotal === null ? (
          // Valor nulo é "a definir", nunca R$ 0,00 — some do total e é dito
          // com todas as letras.
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            Valor a definir
          </span>
        ) : (
          <span className="shrink-0 font-display font-bold tabular-nums text-neutral-900">
            {formatCentavos(pendencia.valorTotal)}
          </span>
        )}
      </div>

      <ReceberForm
        atendimentoId={pendencia.atendimentoId}
        valorAtual={pendencia.valorTotal}
        formas={formas}
      >
        <WhatsappButton
          compacto
          telefone={pendencia.telefone}
          mensagem={mensagemCobranca(
            pendencia.tutorNome,
            pendencia.petNome,
            pendencia.petSexo,
            formatDataCurta(pendencia.data),
            pendencia.valorTotal,
          )}
        >
          Cobrar
        </WhatsappButton>
      </ReceberForm>
    </Card>
  );
}

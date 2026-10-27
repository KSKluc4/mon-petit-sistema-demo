import { XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cancelarAgendamentoAction } from "@/app/(app)/agendamentos/actions";
import { deArtigo } from "@/lib/genero";
import type { Sexo } from "@/app/generated/prisma/client";

/**
 * Painel de confirmação do cancelamento, aberto por `?cancelar=1` na própria
 * ficha — mesmo padrão do fechamento de atendimento (`?fechar=1`).
 *
 * É um painel, e não um `confirm()` do navegador, por dois motivos: dá para
 * mostrar pet e horário por extenso (evita cancelar o agendamento errado no
 * celular) e dá para coletar o motivo, que um `confirm()` não coleta.
 */
export function CancelarAgendamentoForm({
  agendamentoId,
  nomePet,
  sexoPet,
  hora,
}: {
  agendamentoId: string;
  nomePet: string;
  sexoPet: Sexo | null;
  hora: string;
}) {
  return (
    <form
      action={cancelarAgendamentoAction.bind(null, agendamentoId)}
      className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
    >
      <h2 className="font-display font-bold text-rose-900 flex items-center gap-2">
        <XCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
        Cancelar o atendimento {deArtigo(nomePet, sexoPet)} às {hora}?
      </h2>

      <Textarea
        name="motivo"
        label="Motivo (opcional)"
        placeholder='ex: "Cliente remarcou para sexta"'
        rows={2}
      />

      <p className="text-sm text-rose-800">
        O horário fica livre para outro pet e o atendimento não entra no caixa. Dá para reativar
        depois, se o cliente remarcar.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" variant="danger" className="w-full sm:w-auto">
          Confirmar cancelamento
        </Button>
        <ButtonLink
          href={`/agendamentos/${agendamentoId}`}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Voltar
        </ButtonLink>
      </div>
    </form>
  );
}

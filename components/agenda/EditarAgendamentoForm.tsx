"use client";

import { useActionState } from "react";
import { AlertTriangle, Scissors } from "lucide-react";
import {
  updateAgendamentoAction,
  type AgendamentoFormState,
} from "@/app/(app)/agendamentos/actions";
import { ButtonLink } from "@/components/ui/Button";
import { CamposAgendamento, type ServicoOpcao } from "./CamposAgendamento";
import { EspecieIcon } from "./EspecieIcon";

const initialState: AgendamentoFormState = {};

interface EditarAgendamentoFormProps {
  agendamentoId: string;
  servicos: ServicoOpcao[];
  pet: {
    id: string;
    nome: string;
    especie: string;
    fotoUrl: string | null;
    observacoes: string | null;
    padraoPet: string | null;
    tutor: string;
  };
  dataInicial: string;
  horaInicial: string;
  servicosIniciais: string[];
  valorInicial: number | null;
  observacoesInicial: string;
  horariosOcupadosIniciais: string[];
}

export function EditarAgendamentoForm({
  agendamentoId,
  servicos,
  pet,
  dataInicial,
  horaInicial,
  servicosIniciais,
  valorInicial,
  observacoesInicial,
  horariosOcupadosIniciais,
}: EditarAgendamentoFormProps) {
  const action = updateAgendamentoAction.bind(null, agendamentoId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5 pb-44">
      {/* O pet é fixo: trocar o pet de um agendamento existente não é permitido
          — nesse caso cancela-se este e cria-se outro. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-900">Pet</h2>
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          {pet.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pet.fotoUrl}
              alt={pet.nome}
              className="w-12 h-12 rounded-full object-cover border border-white shadow-sm"
            />
          ) : (
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-brand-600 shrink-0">
              <EspecieIcon especie={pet.especie} className="w-6 h-6" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-neutral-900">{pet.nome}</p>
            <p className="text-sm text-neutral-600 truncate">{pet.tutor}</p>
          </div>
        </div>
        <p className="text-sm text-neutral-500">
          Para atender outro pet, cancele este agendamento e crie um novo.
        </p>
        {pet.observacoes && (
          <div className="rounded-2xl bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-900 font-medium flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            {pet.observacoes}
          </div>
        )}
        {pet.padraoPet && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex gap-2">
            <Scissors className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            Padrão do pet: {pet.padraoPet}
          </div>
        )}
      </section>

      <CamposAgendamento
        petId={pet.id}
        servicos={servicos}
        dataInicial={dataInicial}
        horaInicial={horaInicial}
        servicosIniciais={servicosIniciais}
        valorInicial={valorInicial}
        observacoesInicial={observacoesInicial}
        horariosOcupadosIniciais={horariosOcupadosIniciais}
        ignorarId={agendamentoId}
        rotuloSubmit="Salvar"
        rotuloSubmitPendente="Salvando..."
        pending={pending}
      />

      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}

      <ButtonLink href={`/agendamentos/${agendamentoId}`} variant="secondary">
        Cancelar edição
      </ButtonLink>
    </form>
  );
}

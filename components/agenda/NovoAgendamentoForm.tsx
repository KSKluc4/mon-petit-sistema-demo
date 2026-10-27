"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Scissors, Ticket } from "lucide-react";
import {
  createAgendamentoAction,
  type AgendamentoFormState,
} from "@/app/(app)/agendamentos/actions";
import { normalizarTexto } from "@/lib/texto";
import { CamposAgendamento, type ServicoOpcao } from "./CamposAgendamento";
import { EspecieIcon } from "./EspecieIcon";

export type { ServicoOpcao };

export type PetBusca = {
  id: string;
  nome: string;
  especie: string;
  fotoUrl: string | null;
  observacoes: string | null;
  padraoPet: string | null;
  tutor: string;
  /** Pacote ativo do pet (o mais antigo), ou null. */
  pacote: { restantes: number; banhosTotal: number } | null;
};

const initialState: AgendamentoFormState = {};

interface NovoAgendamentoFormProps {
  pets: PetBusca[];
  servicos: ServicoOpcao[];
  dataPadrao: string;
  horariosOcupadosIniciais: string[];
  petIdInicial?: string;
}

export function NovoAgendamentoForm({
  pets,
  servicos,
  dataPadrao,
  horariosOcupadosIniciais,
  petIdInicial,
}: NovoAgendamentoFormProps) {
  const [state, formAction, pending] = useActionState(createAgendamentoAction, initialState);

  const [busca, setBusca] = useState("");
  const [petId, setPetId] = useState<string | null>(
    petIdInicial && pets.some((p) => p.id === petIdInicial) ? petIdInicial : null,
  );
  // Só para montar o link "+ Novo cliente/pet", que volta para esta mesma data.
  const [data, setData] = useState(dataPadrao);

  const petSelecionado = pets.find((p) => p.id === petId) ?? null;

  const resultados = useMemo(() => {
    if (petSelecionado) return [];
    const q = normalizarTexto(busca.trim());
    const lista = q
      ? pets.filter((p) => normalizarTexto(p.nome).includes(q) || normalizarTexto(p.tutor).includes(q))
      : pets;
    return lista.slice(0, 8);
  }, [busca, pets, petSelecionado]);

  const voltar = encodeURIComponent(`/agenda/novo?data=${data}`);

  return (
    <form action={formAction} className="flex flex-col gap-5 pb-44">
      {/* 1. Pet — só existe no cadastro. Trocar o pet de um agendamento já
          criado não é permitido: nesse caso cancela-se e cria-se outro. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-900">Pet</h2>
        {petSelecionado ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-brand-500 bg-brand-50 px-4 py-3">
              {petSelecionado.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={petSelecionado.fotoUrl}
                  alt={petSelecionado.nome}
                  className="w-12 h-12 rounded-full object-cover border border-white shadow-sm"
                />
              ) : (
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-brand-600 shrink-0">
                  <EspecieIcon especie={petSelecionado.especie} className="w-6 h-6" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900">{petSelecionado.nome}</p>
                <p className="text-sm text-neutral-600 truncate">{petSelecionado.tutor}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPetId(null);
                  setBusca("");
                }}
                className="text-sm font-semibold text-brand-700 min-h-[44px] px-3 rounded-xl hover:bg-brand-100"
              >
                Trocar
              </button>
            </div>
            {petSelecionado.observacoes && (
              <div className="rounded-2xl bg-amber-100 border border-amber-300 px-4 py-3 text-sm text-amber-900 font-medium flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {petSelecionado.observacoes}
              </div>
            )}
            {petSelecionado.padraoPet && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex gap-2">
                <Scissors className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                Padrão do pet: {petSelecionado.padraoPet}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome do pet ou do tutor..."
              autoFocus
              className="min-h-[48px] rounded-2xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <div className="flex flex-col gap-1.5">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPetId(p.id)}
                  className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left hover:border-brand-300 active:bg-brand-50 transition-colors min-h-[60px]"
                >
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.fotoUrl}
                      alt={p.nome}
                      className="w-11 h-11 rounded-full object-cover border border-neutral-200"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-11 h-11 rounded-full bg-brand-50 text-brand-600 shrink-0">
                      <EspecieIcon especie={p.especie} className="w-5 h-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">{p.nome}</p>
                    <p className="text-sm text-neutral-500 truncate">{p.tutor}</p>
                  </div>
                </button>
              ))}
              {resultados.length === 0 && (
                <p className="text-sm text-neutral-500 px-1 py-2">
                  Nenhum pet encontrado{busca ? ` para “${busca}”` : ""}.
                </p>
              )}
              <Link
                href={`/clientes/novo?voltar=${voltar}`}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800 px-1 py-2 min-h-[44px] flex items-center"
              >
                + Novo cliente/pet
              </Link>
            </div>
          </div>
        )}
        {petId && <input type="hidden" name="petId" value={petId} />}
      </section>

      {/* Oferece o pacote assim que o pet é escolhido. É INTENÇÃO: quem confere
          o saldo de verdade é o fechamento, na hora de entregar. */}
      {petSelecionado?.pacote && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <input
            type="checkbox"
            name="usarPacote"
            value="1"
            defaultChecked
            className="mt-1 h-5 w-5 shrink-0 accent-brand-600"
          />
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 font-semibold text-brand-900">
              <Ticket className="h-4 w-4" aria-hidden="true" />
              Usar o pacote de {petSelecionado.nome}
            </span>
            <span className="text-sm text-brand-800">
              {petSelecionado.pacote.restantes} de {petSelecionado.pacote.banhosTotal} banhos
              ainda por usar. Deixe o valor em branco — o banho já está pago.
            </span>
          </span>
        </label>
      )}

      <CamposAgendamento
        petId={petId}
        servicos={servicos}
        dataInicial={dataPadrao}
        horariosOcupadosIniciais={horariosOcupadosIniciais}
        onDataChange={setData}
        rotuloSubmit="Agendar"
        rotuloSubmitPendente="Agendando..."
        pending={pending}
      />

      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

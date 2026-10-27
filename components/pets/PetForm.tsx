"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { RadioPills } from "@/components/ui/RadioPills";
import type { PetFormState } from "@/app/(app)/pets/actions";

const initialState: PetFormState = {};

interface PetFormProps {
  action: (prevState: PetFormState, formData: FormData) => Promise<PetFormState>;
  defaultValues?: {
    nome: string;
    especie: string;
    raca: string;
    sexo: string;
    dataNascimento?: string;
    pesoKg?: string;
    observacoes: string;
    fotoUrl?: string | null;
  };
  submitLabel?: string;
  voltar?: string;
}

export function PetForm({ action, defaultValues, submitLabel = "Salvar", voltar }: PetFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [modoIdade, setModoIdade] = useState<"data" | "aproximada">("data");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {voltar && <input type="hidden" name="voltar" value={voltar} />}
      <Input name="nome" label="Nome *" defaultValue={defaultValues?.nome} required autoFocus />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="foto" className="text-sm font-medium text-neutral-700">
          Foto
        </label>
        {defaultValues?.fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={defaultValues.fotoUrl}
            alt="Foto atual"
            className="w-20 h-20 rounded-2xl object-cover border border-neutral-200"
          />
        )}
        <input
          id="foto"
          name="foto"
          type="file"
          accept="image/*"
          className="text-sm file:mr-3 file:min-h-[44px] file:rounded-2xl file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700"
        />
        {defaultValues?.fotoUrl && (
          <span className="text-xs text-neutral-500">Envie uma nova foto para substituir a atual.</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">Espécie *</span>
        <RadioPills
          name="especie"
          defaultValue={defaultValues?.especie}
          options={[
            { value: "CAO", label: "Cão" },
            { value: "GATO", label: "Gato" },
          ]}
        />
      </div>

      <Input name="raca" label="Raça *" defaultValue={defaultValues?.raca} required />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">Sexo *</span>
        <RadioPills
          name="sexo"
          defaultValue={defaultValues?.sexo}
          options={[
            { value: "MACHO", label: "Macho" },
            { value: "FEMEA", label: "Fêmea" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">Idade</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModoIdade("data")}
            className={`flex-1 min-h-[40px] rounded-xl text-sm font-semibold transition-colors ${
              modoIdade === "data" ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Sei a data
          </button>
          <button
            type="button"
            onClick={() => setModoIdade("aproximada")}
            className={`flex-1 min-h-[40px] rounded-xl text-sm font-semibold transition-colors ${
              modoIdade === "aproximada" ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Idade aproximada
          </button>
        </div>
        <input type="hidden" name="modoIdade" value={modoIdade} />
        {modoIdade === "data" ? (
          <Input name="dataNascimento" type="date" label="Data de nascimento" defaultValue={defaultValues?.dataNascimento} />
        ) : (
          <Input
            name="idadeAnos"
            type="number"
            step="0.1"
            min="0"
            label="Idade aproximada (anos)"
            placeholder="ex: 1.5"
          />
        )}
      </div>

      <Input name="pesoKg" type="number" step="0.1" min="0" label="Peso (kg)" defaultValue={defaultValues?.pesoKg} />

      <Textarea
        name="observacoes"
        label="Observações"
        placeholder='ex: "muito bravo", "alergia a perfume"...'
        defaultValue={defaultValues?.observacoes ?? ""}
      />

      {state.error && (
        <p className="text-sm text-red-600 font-medium" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full mt-2">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ValorInput } from "@/components/ui/ValorInput";
import {
  getHorariosOcupadosAction,
  getSugestaoValorAction,
  type SugestaoValor,
} from "@/app/(app)/agendamentos/actions";
import { formatCentavos } from "@/lib/datas";

export type ServicoOpcao = {
  id: string;
  nome: string;
};

const HORARIOS_PADRAO: string[] = [];
for (let h = 8; h <= 18; h++) {
  HORARIOS_PADRAO.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 18) HORARIOS_PADRAO.push(`${String(h).padStart(2, "0")}:30`);
}

interface CamposAgendamentoProps {
  /** Só para buscar a sugestão de valor no histórico do pet. */
  petId: string | null;
  servicos: ServicoOpcao[];
  dataInicial: string;
  horaInicial?: string;
  servicosIniciais?: string[];
  valorInicial?: number | null;
  observacoesInicial?: string;
  horariosOcupadosIniciais: string[];
  /**
   * Ao editar, o próprio agendamento não conta como horário ocupado — senão o
   * formulário avisaria que o horário dele mesmo está tomado.
   */
  ignorarId?: string;
  /** O formulário de criação usa a data no link "+ Novo cliente/pet". */
  onDataChange?: (dataISO: string) => void;
  rotuloSubmit: string;
  rotuloSubmitPendente: string;
  pending: boolean;
}

/**
 * Campos comuns a criar e editar agendamento: data, horário, serviços, valor e
 * observações, mais o rodapé fixo com o total e o botão de enviar.
 *
 * Fica fora do formulário de criação porque editar mexe exatamente nos mesmos
 * campos — só não deixa trocar o pet (para isso, cancela-se e cria-se outro).
 */
export function CamposAgendamento({
  petId,
  servicos,
  dataInicial,
  horaInicial = "",
  servicosIniciais = [],
  valorInicial = null,
  observacoesInicial = "",
  horariosOcupadosIniciais,
  ignorarId,
  onDataChange,
  rotuloSubmit,
  rotuloSubmitPendente,
  pending,
}: CamposAgendamentoProps) {
  const [data, setData] = useState(dataInicial);
  const [hora, setHora] = useState(horaInicial);
  // Horário fora da grade de 30 em 30 (ex: 09:15) abre já no campo livre.
  const [horaCustom, setHoraCustom] = useState(
    Boolean(horaInicial) && !HORARIOS_PADRAO.includes(horaInicial),
  );
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(servicosIniciais));
  // Valor livre: no cadastro começa em branco; ao editar, começa no valor já
  // salvo. Em nenhum dos dois a sugestão preenche sozinha — só o toque no botão.
  const [valor, setValor] = useState<number | null>(valorInicial);
  const [ocupados, setOcupados] = useState<string[]>(horariosOcupadosIniciais);
  // Guarda a chave (pet + serviços) junto do resultado: enquanto a busca da
  // combinação atual não volta, a sugestão anterior não aparece.
  const [sugestao, setSugestao] = useState<{ chave: string; dados: SugestaoValor | null } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  // Recarrega horários ocupados quando a data muda (aviso leve de conflito).
  function mudarData(novaData: string) {
    setData(novaData);
    onDataChange?.(novaData);
    if (novaData === dataInicial) {
      setOcupados(horariosOcupadosIniciais);
      return;
    }
    startTransition(async () => {
      setOcupados(await getHorariosOcupadosAction(novaData, ignorarId));
    });
  }

  const servicosSelecionados = useMemo(() => [...selecionados].sort(), [selecionados]);
  const chaveServicos = servicosSelecionados.join("|");
  const chaveSugestao = petId ? `${petId}#${chaveServicos}` : "";

  // Busca no histórico do pet quanto foi cobrado da última vez. Só sugere —
  // preencher o campo é sempre um toque do usuário.
  useEffect(() => {
    if (!petId) return;
    const chave = `${petId}#${chaveServicos}`;
    const ids = chaveServicos ? chaveServicos.split("|") : [];
    getSugestaoValorAction(petId, ids)
      .then((dados) => setSugestao({ chave, dados }))
      .catch(() => {});
  }, [petId, chaveServicos]);

  // Só mostra a sugestão que corresponde ao que está selecionado agora.
  const sugestaoAtual = sugestao?.chave === chaveSugestao ? sugestao.dados : null;

  function toggleServico(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const conflito = hora && ocupados.includes(hora);

  return (
    <>
      {/* Data e horário */}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-900">Data e horário</h2>
        <input
          type="date"
          name="data"
          value={data}
          onChange={(e) => e.target.value && mudarData(e.target.value)}
          className="min-h-[48px] rounded-2xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          aria-label="Data"
        />
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {HORARIOS_PADRAO.map((h) => {
            const ativo = !horaCustom && hora === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setHora(h);
                  setHoraCustom(false);
                }}
                className={`min-h-[44px] rounded-xl text-sm font-semibold tabular-nums transition-colors ${
                  ativo
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-neutral-200 text-neutral-700 hover:border-brand-300"
                }`}
              >
                {h}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setHoraCustom(true);
              setHora("");
            }}
            className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
              horaCustom
                ? "bg-brand-600 text-white"
                : "bg-white border border-neutral-200 text-neutral-700 hover:border-brand-300"
            }`}
          >
            Outro
          </button>
        </div>
        {horaCustom && (
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="min-h-[48px] rounded-2xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="Horário personalizado"
          />
        )}
        <input type="hidden" name="hora" value={hora} />
        {conflito && (
          <p className="text-sm text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Já existe agendamento às {hora} — sem problema, é só um aviso.
          </p>
        )}
      </section>

      {/* Serviços */}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-900">Serviços</h2>
        <div className="grid grid-cols-2 gap-2">
          {servicos.map((s) => {
            const ativo = selecionados.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleServico(s.id)}
                className={`flex items-center justify-center text-center min-h-[60px] rounded-2xl border-2 px-3 py-2 font-semibold transition-colors ${
                  ativo
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300"
                }`}
              >
                {s.nome}
              </button>
            );
          })}
        </div>
        {Array.from(selecionados).map((id) => (
          <input key={id} type="hidden" name="servicoIds" value={id} />
        ))}
      </section>

      {/* Valor — livre por atendimento, pode ficar em branco. */}
      <section className="flex flex-col gap-2">
        <h2 className="font-bold text-neutral-900">Valor</h2>
        <ValorInput name="valorTotal" label="Valor (R$)" value={valor} onChange={setValor} />
        {sugestaoAtual && (
          <button
            type="button"
            onClick={() => setValor(sugestaoAtual.valor)}
            className="flex items-center gap-2 min-h-[52px] rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 text-left text-brand-800 hover:bg-brand-100 active:bg-brand-100 transition-colors"
          >
            <History className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="font-semibold">
              {sugestaoAtual.mesmaCombinacao ? (
                <>
                  Última vez: {formatCentavos(sugestaoAtual.valor)} · {sugestaoAtual.diaMes}
                </>
              ) : (
                <>
                  Último: {sugestaoAtual.servicos} · {formatCentavos(sugestaoAtual.valor)} ·{" "}
                  {sugestaoAtual.diaMes}
                </>
              )}
            </span>
          </button>
        )}
        <p className="text-sm text-neutral-500">Pode deixar em branco e preencher na entrega.</p>
      </section>

      {/* Observações */}
      <Textarea
        name="observacoes"
        label="Observações"
        placeholder="Alguma observação para este atendimento? (opcional)"
        defaultValue={observacoesInicial}
      />

      {/* Rodapé fixo: total + enviar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-100 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(23,20,16,0.06)]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-500">Total</p>
            {valor === null ? (
              <p className="text-lg font-display font-bold text-neutral-400">Valor a definir</p>
            ) : (
              <p className="text-2xl font-display font-bold text-neutral-900 tabular-nums">
                {formatCentavos(valor)}
              </p>
            )}
          </div>
          <Button type="submit" variant="accent" disabled={pending} className="px-8">
            {pending ? rotuloSubmitPendente : rotuloSubmit}
          </Button>
        </div>
      </div>
    </>
  );
}

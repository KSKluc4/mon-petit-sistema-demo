"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { formatCentavos } from "@/lib/datas";
import {
  ORDEM_TIPOS,
  PARCELAS_MAXIMAS,
  TIPO_LABEL,
  formatarTaxa,
  taxaDaForma,
  valoresDoPagamento,
  type FormaSelecionavel,
} from "@/lib/pagamento";
import type { TipoPagamento } from "@/app/generated/prisma/client";

/**
 * Seletor de forma de pagamento em dois níveis.
 *
 * São 12 formas. Uma fileira única de pílulas viraria sete linhas num celular,
 * justo no fluxo que precisa ser rápido — então primeiro escolhe-se o TIPO
 * (Dinheiro · Pix · Débito · Crédito) e só então a bandeira/conta.
 *
 * Custo em toques: Dinheiro = 1 (só existe uma forma, o tipo já resolve),
 * Pix e cartão = 2, crédito parcelado = 3. O parcelamento **só aparece no
 * crédito** — some do DOM nos outros, para não pesar o fluxo comum.
 *
 * Emite `formaId` e `parcelas` em campos escondidos; quem resolve a taxa de
 * verdade é o servidor (`registrarRecebimento`), nunca este componente. O que
 * aparece aqui é só a prévia do líquido.
 */
export function FormaPagamentoPicker({
  formas,
  valor,
  formaInicial,
  onSelecionar,
}: {
  formas: FormaSelecionavel[];
  /** Centavos digitados, para a prévia do líquido. */
  valor: number | null;
  formaInicial?: string;
  /** Avisa quem está de fora qual forma está escolhida (para habilitar o botão). */
  onSelecionar?: (formaId: string | null) => void;
}) {
  const inicial = formas.find((f) => f.id === formaInicial);
  const [tipo, setTipo] = useState<TipoPagamento | null>(inicial?.tipo ?? null);
  const [formaId, setFormaId] = useState<string | null>(inicial?.id ?? null);
  const [parcelas, setParcelas] = useState(1);

  const tiposDisponiveis = ORDEM_TIPOS.filter((t) => formas.some((f) => f.tipo === t));
  const doTipo = tipo ? formas.filter((f) => f.tipo === tipo) : [];
  const forma = formas.find((f) => f.id === formaId) ?? null;

  function escolher(id: string | null) {
    setFormaId(id);
    onSelecionar?.(id);
  }

  function escolherTipo(novo: TipoPagamento) {
    setTipo(novo);
    setParcelas(1);
    const opcoes = formas.filter((f) => f.tipo === novo);
    // Tipo com uma forma só (Dinheiro) já resolve a escolha — seria um toque
    // desperdiçado pedir para confirmar a única opção.
    escolher(opcoes.length === 1 ? opcoes[0].id : null);
  }

  const taxaBps = forma ? taxaDaForma(forma, parcelas) : null;
  const previa = forma && valor !== null ? valoresDoPagamento(valor, taxaBps) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">Forma de pagamento</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiposDisponiveis.map((t) => (
            <Pilula key={t} selecionada={tipo === t} onClick={() => escolherTipo(t)}>
              {TIPO_LABEL[t]}
            </Pilula>
          ))}
        </div>
      </div>

      {/* Segundo nível: só quando o tipo tem mais de uma forma. */}
      {doTipo.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">
            {tipo === "PIX" ? "Em qual conta" : "Bandeira"}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {doTipo.map((f) => (
              <Pilula key={f.id} selecionada={formaId === f.id} onClick={() => escolher(f.id)}>
                {f.rotulo}
              </Pilula>
            ))}
          </div>
        </div>
      )}

      {/* Parcelamento: só no crédito, e some do DOM no resto. */}
      {forma?.tipo === "CREDITO" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">Parcelamento</span>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: PARCELAS_MAXIMAS }, (_, i) => i + 1).map((n) => (
              <Pilula key={n} selecionada={parcelas === n} onClick={() => setParcelas(n)}>
                {n === 1 ? "À vista" : `${n}x`}
              </Pilula>
            ))}
          </div>
        </div>
      )}

      {/* Prévia do líquido, discreta, antes de confirmar. */}
      {previa && (
        <p className="text-sm text-neutral-600">
          {previa.taxaDesconhecida ? (
            <span className="flex items-start gap-1.5 text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>{formatCentavos(previa.bruto)}</strong> — taxa desta forma ainda não
                cadastrada, então o líquido não dá para calcular. Dá para salvar assim mesmo.
              </span>
            </span>
          ) : (
            <>
              <strong className="text-neutral-900">{formatCentavos(previa.bruto)}</strong> · líquido{" "}
              <strong className="text-neutral-900">{formatCentavos(previa.liquido)}</strong>{" "}
              <span className="text-neutral-500">({formatarTaxa(taxaBps)})</span>
            </>
          )}
        </p>
      )}

      <input type="hidden" name="formaId" value={formaId ?? ""} />
      <input type="hidden" name="parcelas" value={parcelas} />
    </div>
  );
}

function Pilula({
  selecionada,
  onClick,
  children,
}: {
  selecionada: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionada}
      className={`flex min-h-[44px] items-center justify-center rounded-2xl border-2 px-3 text-center text-sm font-semibold transition-all ${
        selecionada
          ? "border-brand-500 bg-brand-50 text-brand-800"
          : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

import { AlertTriangle, Ticket } from "lucide-react";
import { comAutor } from "@/lib/autoria";
import { formatCentavos, formatDataCurta } from "@/lib/datas";
import { STATUS_PACOTE_LABEL, type PacoteComSaldo } from "@/lib/pacotes";
import { CancelarPacoteForm } from "./CancelarPacoteForm";

const ESTILO_STATUS: Record<string, string> = {
  ATIVO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ENCERRADO: "bg-neutral-100 text-neutral-600 border-neutral-200",
  EXPIRADO: "bg-rose-50 text-rose-700 border-rose-200",
  CANCELADO: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

/** Bolinhas de banho usado/restante — dá o saldo num relance. */
function Bolinhas({ usados, total }: { usados: number; total: number }) {
  return (
    <span className="flex gap-1" aria-label={`${usados} de ${total} banhos usados`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i < usados ? "bg-brand-600" : "bg-neutral-200"}`}
        />
      ))}
    </span>
  );
}

export function PacotesDoPet({ pacotes, petId }: { pacotes: PacoteComSaldo[]; petId: string }) {
  if (pacotes.length === 0) return null;

  const ativos = pacotes.filter((p) => p.status === "ATIVO");

  return (
    <div className="flex flex-col gap-3">
      {/* Mais de um pacote ativo é situação normal — a dona pode vender o novo
          antes de o antigo acabar. O banho sai sempre do MAIS ANTIGO, e a tela
          precisa dizer isso, senão o saldo parece errado. */}
      {ativos.length > 1 && (
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <strong>{ativos.length} pacotes ativos.</strong> O próximo banho sai do mais antigo
          (comprado em {formatDataCurta(ativos[0].dataCompra)}), que é o que vence primeiro.
        </p>
      )}

      {pacotes.map((p) => {
        const podeCancelar = p.status === "ATIVO" && p.usados === 0;
        return (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Ticket className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="font-semibold text-neutral-900">
                  Pacote de {p.banhosTotal} banhos
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  ESTILO_STATUS[p.status]
                }`}
              >
                {STATUS_PACOTE_LABEL[p.status]}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Bolinhas usados={p.usados} total={p.banhosTotal} />
              <span className="text-sm text-neutral-600">
                {p.usados} usado{p.usados === 1 ? "" : "s"} ·{" "}
                <strong className="text-neutral-900">{p.restantes} restante{p.restantes === 1 ? "" : "s"}</strong>
              </span>
            </div>

            <p className="text-sm text-neutral-500">
              {formatCentavos(p.valorTotal)}
              {p.formaNome && ` · ${p.formaNome}`} · comprado em {formatDataCurta(p.dataCompra)}
            </p>
            {/* `vendidoPor` era gravado desde 03/08/2026 e não aparecia em tela
                nenhuma — dado de autoria que existia e ninguém conseguia ver. */}
            <p className="text-sm text-neutral-500">{comAutor("Vendido por", p.vendidoPor)}</p>

            {p.status === "ATIVO" && (
              <p className={`text-sm ${p.vencendo ? "font-semibold text-amber-700" : "text-neutral-500"}`}>
                {p.vencendo && (
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                )}
                Vale até {formatDataCurta(p.validadeAte)}
                {p.diasParaVencer <= 0
                  ? " — vence hoje"
                  : ` — ${p.diasParaVencer} dia${p.diasParaVencer === 1 ? "" : "s"}`}
              </p>
            )}
            {p.status === "EXPIRADO" && (
              <p className="text-sm text-rose-700">
                Venceu em {formatDataCurta(p.validadeAte)} com {p.restantes} banho
                {p.restantes === 1 ? "" : "s"} sem usar.
              </p>
            )}

            {podeCancelar && (
              <CancelarPacoteForm
                pacoteId={p.id}
                petId={petId}
                dataVenda={formatDataCurta(p.dataCompra)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

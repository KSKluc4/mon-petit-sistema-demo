import { formatCentavos } from "@/lib/datas";
import type { PontoEvolucao } from "@/lib/relatorios";

/**
 * Faturamento mês a mês, 12 meses. Barras em CSS puro — nenhuma biblioteca de
 * gráfico: são 12 valores e uma escala linear, e uma dependência a mais só para
 * isso não se paga (nem no bundle nem na manutenção).
 *
 * Rola na horizontal no celular, com largura mínima por barra para os rótulos
 * não se espremerem.
 */
export function GraficoEvolucao({ pontos }: { pontos: PontoEvolucao[] }) {
  const maximo = Math.max(...pontos.map((p) => p.faturamento), 0);
  const vazio = maximo === 0;

  return (
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
      {vazio ? (
        <p className="py-8 text-center text-sm text-neutral-500">
          Nenhum faturamento registrado nestes 12 meses.
        </p>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <div className="flex min-w-max items-end gap-2 px-1" style={{ height: "180px" }}>
            {pontos.map((p) => {
              // 2% de altura mínima só para o mês com movimento não sumir; mês
              // zerado fica sem barra mesmo, para não fingir faturamento.
              const altura = p.faturamento === 0 ? 0 : Math.max(2, (p.faturamento / maximo) * 100);
              return (
                <div key={p.mesISO} className="flex w-14 flex-col items-center gap-1.5 sm:w-16">
                  <span className="text-[10px] font-semibold tabular-nums text-neutral-600">
                    {p.faturamento > 0 ? formatCentavos(p.faturamento).replace("R$ ", "") : ""}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                      style={{ height: `${altura}%` }}
                      title={`${p.rotulo}: ${formatCentavos(p.faturamento)}`}
                    />
                  </div>
                  <span className="text-[11px] text-neutral-500">{p.rotulo}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

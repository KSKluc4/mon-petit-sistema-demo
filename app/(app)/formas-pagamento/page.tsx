import { Info } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIPO_LABEL, permiteParcelamento } from "@/lib/pagamento";
import { TaxasForm } from "@/components/configuracoes/TaxasForm";

export const metadata = { title: "Formas de pagamento" };

export default async function FormasPagamentoPage() {
  await requireSession();

  // Só as formas em uso: as legadas existem apenas para segurar o histórico e
  // não têm taxa para configurar.
  const formas = await prisma.formaPagamento.findMany({
    where: { legado: false },
    include: { taxas: true },
    orderBy: { ordem: "asc" },
  });

  const grupos = formas.map((f) => ({
    formaId: f.id,
    nome: f.nome,
    parcelavel: permiteParcelamento(f.tipo),
    taxas: f.taxas.map((t) => ({ id: t.id, parcelas: t.parcelas, taxaBps: t.taxaBps })),
  }));

  const semTaxa = formas.filter((f) => f.taxas.every((t) => t.taxaBps === null));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Formas de pagamento</h1>
        <p className="text-neutral-500">
          Percentuais da maquininha. Ajuste aqui quando a operadora mudar a tabela.
        </p>
      </div>

      <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p>
            <strong>Mudar uma taxa aqui não mexe em pagamento já registrado.</strong> Cada venda
            guarda a taxa que valia no dia, então o fechamento de um mês anterior continua com os
            mesmos números depois de enviado à contabilidade.
          </p>
          <p>
            Campo <strong>em branco</strong> significa taxa <strong>não cadastrada</strong> — o
            sistema mostra o líquido igual ao bruto e avisa. Não é o mesmo que 0%: dinheiro e Pix
            entre contas têm 0% de verdade, e ficam preenchidos com zero.
          </p>
        </div>
      </div>

      {semTaxa.length > 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Sem percentual cadastrado:{" "}
          <strong>{semTaxa.map((f) => f.nome).join(", ")}</strong>. Dá para vender nessas formas — o
          líquido é que fica sem calcular até os valores serem preenchidos.
        </p>
      )}

      <TaxasForm grupos={grupos} />

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-900">Formas disponíveis</p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {(["DINHEIRO", "PIX", "DEBITO", "CREDITO"] as const).map((tipo) => {
            const doTipo = formas.filter((f) => f.tipo === tipo);
            if (doTipo.length === 0) return null;
            return (
              <li key={tipo}>
                <strong>{TIPO_LABEL[tipo]}:</strong> {doTipo.map((f) => f.rotulo).join(" · ")}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs">
          Pix Conta 1 e Pix Conta 2 são separados de propósito: as duas contas não têm taxa, mas a
          distinção diz em qual conta o dinheiro entrou.
        </p>
      </div>
    </div>
  );
}

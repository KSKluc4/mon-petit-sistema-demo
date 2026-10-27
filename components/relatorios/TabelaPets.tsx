"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FIXA_TD, FIXA_TH, TD, TD_NUM, TH, TH_NUM, THEAD, TabelaScroll } from "./Tabela";

export type LinhaPetTabela = {
  petId: string;
  petNome: string;
  tutorNome: string;
  visitas: number;
  total: number;
  totalTexto: string;
  ultimaVisitaTexto: string;
  // Timestamp cru só para ordenar: formatar no cliente correria o risco de usar
  // o fuso do aparelho em vez do da loja.
  ultimaVisitaMs: number;
};

type Coluna = "petNome" | "tutorNome" | "visitas" | "total" | "ultimaVisita";

const COLUNAS: { id: Coluna; label: string; numerica: boolean }[] = [
  { id: "petNome", label: "Pet", numerica: false },
  { id: "tutorNome", label: "Tutor", numerica: false },
  { id: "visitas", label: "Visitas", numerica: true },
  { id: "total", label: "Total gasto", numerica: true },
  { id: "ultimaVisita", label: "Última visita", numerica: true },
];

export function TabelaPets({ linhas }: { linhas: LinhaPetTabela[] }) {
  const [coluna, setColuna] = useState<Coluna>("total");
  const [desc, setDesc] = useState(true);

  const ordenadas = useMemo(() => {
    const fator = desc ? -1 : 1;
    return [...linhas].sort((a, b) => {
      switch (coluna) {
        case "petNome":
          return fator * a.petNome.localeCompare(b.petNome, "pt-BR");
        case "tutorNome":
          return fator * a.tutorNome.localeCompare(b.tutorNome, "pt-BR");
        case "visitas":
          return fator * (a.visitas - b.visitas);
        case "total":
          return fator * (a.total - b.total);
        case "ultimaVisita":
          return fator * (a.ultimaVisitaMs - b.ultimaVisitaMs);
      }
    });
  }, [linhas, coluna, desc]);

  function alternar(id: Coluna) {
    if (id === coluna) {
      setDesc((v) => !v);
      return;
    }
    setColuna(id);
    // Texto começa de A–Z; número e data começam do maior, que é o que
    // interessa olhar primeiro num relatório.
    setDesc(id !== "petNome" && id !== "tutorNome");
  }

  return (
    <TabelaScroll>
      <thead className={THEAD}>
        <tr className="border-b border-neutral-200 bg-neutral-50">
          {COLUNAS.map(({ id, label, numerica }, i) => {
            const ativa = coluna === id;
            const Icone = desc ? ArrowDown : ArrowUp;
            return (
              <th
                key={id}
                className={i === 0 ? FIXA_TH : numerica ? TH_NUM : TH}
                scope="col"
                aria-sort={ativa ? (desc ? "descending" : "ascending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => alternar(id)}
                  className={`inline-flex min-h-[44px] items-center gap-1 font-semibold uppercase tracking-wide transition-colors hover:text-brand-700 ${
                    ativa ? "text-brand-700" : "text-neutral-500"
                  }`}
                >
                  {label}
                  {ativa && <Icone className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {ordenadas.map((l) => (
          <tr key={l.petId} className="group/linha border-b border-neutral-100 last:border-0 even:bg-neutral-50/60">
            <td className={`${FIXA_TD} font-semibold`}>{l.petNome}</td>
            <td className={TD}>{l.tutorNome}</td>
            <td className={TD_NUM}>{l.visitas}</td>
            <td className={`${TD_NUM} font-semibold`}>{l.totalTexto}</td>
            <td className={TD_NUM}>{l.ultimaVisitaTexto}</td>
          </tr>
        ))}
      </tbody>
    </TabelaScroll>
  );
}

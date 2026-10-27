"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ATALHOS, type Periodo } from "@/lib/periodos";

/**
 * Filtro de período: 4 atalhos + intervalo personalizado.
 *
 * O período mora na URL (`?atalho=` ou `?de=&ate=`), não em estado local — o
 * relatório é renderizado no servidor, e assim o link pode ser recarregado,
 * salvo nos favoritos ou mandado para a contadora e continuar mostrando
 * exatamente o mesmo recorte. É também o que os botões de exportar reaproveitam.
 */
export function PeriodoFiltro({
  periodo,
  // Duas telas usam o mesmo filtro (Relatórios e Atividade). O destino é
  // parâmetro para o componente não conhecer a rota de quem o usa.
  basePath = "/relatorios",
}: {
  periodo: Periodo;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aberto, setAberto] = useState(periodo.atalho === null);
  const [de, setDe] = useState(periodo.inicioISO);
  const [ate, setAte] = useState(periodo.fimISO);

  function aplicarAtalho(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("atalho", id);
    params.delete("de");
    params.delete("ate");
    setAberto(false);
    router.push(`${basePath}?${params}`);
  }

  function aplicarPersonalizado(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("de", de);
    params.set("ate", ate);
    params.delete("atalho");
    router.push(`${basePath}?${params}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {ATALHOS.map(({ id, label }) => {
          const ativo = periodo.atalho === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => aplicarAtalho(id)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors ${
                ativo
                  ? "bg-brand-600 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            periodo.atalho === null
              ? "bg-brand-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-brand-50 hover:text-brand-700"
          }`}
          aria-expanded={aberto}
        >
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
          Personalizado
        </button>
      </div>

      {aberto && (
        <form onSubmit={aplicarPersonalizado} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-neutral-700">De</span>
            <input
              type="date"
              value={de}
              max={ate}
              onChange={(e) => setDe(e.target.value)}
              required
              className="min-h-[44px] w-full rounded-xl border border-neutral-200 px-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Até</span>
            <input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => setAte(e.target.value)}
              required
              className="min-h-[44px] w-full rounded-xl border border-neutral-200 px-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <Button type="submit" variant="primary" className="sm:w-auto">
            Aplicar
          </Button>
        </form>
      )}

      <p className="text-sm text-neutral-500">
        Mostrando: <span className="font-semibold text-neutral-900">{periodo.rotulo}</span>
      </p>
    </div>
  );
}

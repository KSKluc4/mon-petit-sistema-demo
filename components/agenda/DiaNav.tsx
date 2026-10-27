"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDias, hojeISO } from "@/lib/datas";

const navBtn =
  "flex items-center justify-center min-h-[44px] min-w-[44px] rounded-2xl bg-white border border-neutral-200 font-semibold text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 active:bg-neutral-100 transition-colors shadow-sm";

export function DiaNav({ dataISO, basePath = "/agenda" }: { dataISO: string; basePath?: string }) {
  const router = useRouter();

  return (
    <div className="flex items-stretch gap-2">
      <Link href={`${basePath}?data=${addDias(dataISO, -1)}`} className={navBtn} aria-label="Dia anterior">
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </Link>
      <Link
        href={`${basePath}?data=${hojeISO()}`}
        className={`${navBtn} px-4 ${dataISO === hojeISO() ? "border-brand-500 text-brand-700 bg-brand-50" : ""}`}
      >
        Hoje
      </Link>
      <Link href={`${basePath}?data=${addDias(dataISO, 1)}`} className={navBtn} aria-label="Próximo dia">
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </Link>
      <input
        type="date"
        value={dataISO}
        onChange={(e) => {
          if (e.target.value) router.push(`${basePath}?data=${e.target.value}`);
        }}
        className="flex-1 min-h-[44px] rounded-2xl border border-neutral-200 bg-white px-3 text-base text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        aria-label="Escolher data"
      />
    </div>
  );
}

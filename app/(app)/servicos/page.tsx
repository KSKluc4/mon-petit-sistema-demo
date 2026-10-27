import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Servico } from "@/app/generated/prisma/client";
import { toggleAtivoServicoAction } from "./actions";

export const metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const servicos = await prisma.servico.findMany({ orderBy: { nome: "asc" } });
  const ativos = servicos.filter((s) => s.ativo);
  const inativos = servicos.filter((s) => !s.ativo);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Serviços</h1>

      <ButtonLink href="/servicos/novo" variant="accent" className="w-full">
        + Novo serviço
      </ButtonLink>

      {servicos.length === 0 ? (
        <EmptyState message="Nenhum serviço cadastrado ainda." />
      ) : (
        <div className="flex flex-col gap-2">
          {ativos.map((s) => (
            <ServicoRow key={s.id} servico={s} />
          ))}
        </div>
      )}

      {inativos.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-sm font-semibold text-neutral-500">Desativados</p>
          {inativos.map((s) => (
            <ServicoRow key={s.id} servico={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServicoRow({ servico }: { servico: Servico }) {
  return (
    <Card className={`flex items-center justify-between gap-3 ${!servico.ativo ? "opacity-60" : ""}`}>
      <div className="min-w-0">
        <p className="font-semibold text-neutral-900 truncate">{servico.nome}</p>
        <p className="text-sm text-neutral-500">
          {servico.ativo ? "Valor definido no atendimento" : "Desativado"}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/servicos/${servico.id}/editar`}
          className="min-h-[44px] flex items-center rounded-xl px-3 text-sm font-medium text-neutral-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
        >
          Editar
        </Link>
        <form action={toggleAtivoServicoAction.bind(null, servico.id, servico.ativo)}>
          <button
            type="submit"
            className={`min-h-[44px] rounded-xl px-3 text-sm font-medium transition-colors ${
              servico.ativo
                ? "text-neutral-500 hover:bg-red-50 hover:text-red-600"
                : "text-neutral-500 hover:bg-green-50 hover:text-green-700"
            }`}
          >
            {servico.ativo ? "Desativar" : "Reativar"}
          </button>
        </form>
      </div>
    </Card>
  );
}

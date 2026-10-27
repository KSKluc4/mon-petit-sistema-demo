import Link from "next/link";
import { ChevronRight, History, Percent } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EditarNomeForm } from "./EditarNomeForm";
import { AlterarSenhaForm } from "./AlterarSenhaForm";
import { ResetarSenhaOutroForm } from "./ResetarSenhaOutroForm";
import { redefinirSenhaOutroAction } from "./actions";

export const metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const session = await getSession();

  const outroUsuario = session
    ? await prisma.usuario.findFirst({ where: { id: { not: session.sub } } })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Minha conta</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-700">Nome</h2>
        <Card>
          <EditarNomeForm nomeAtual={session?.nome ?? ""} />
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-700">Alterar senha</h2>
        <Card>
          <AlterarSenhaForm />
        </Card>
      </div>

      {/* Configuração da LOJA, não da conta — mora aqui porque o header já está
          no teto de 5 destinos (CLAUDE.md → Design) e um sexto item quebraria a
          largura medida. É mexida raramente (quando a operadora muda a tabela),
          então não precisa de atalho na navegação. */}
      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-neutral-700">Configurações da loja</h2>
        <Card>
          <Link
            href="/formas-pagamento"
            className="flex items-center gap-3 min-h-[44px] -m-1 p-1 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 text-brand-700 shrink-0">
              <Percent className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="font-semibold text-neutral-900">Formas de pagamento</span>
              <span className="text-sm text-neutral-500">
                Taxas da maquininha por bandeira e parcelamento
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0 ml-auto" aria-hidden="true" />
          </Link>
        </Card>
        <Card>
          <Link
            href="/atividade"
            className="flex items-center gap-3 min-h-[44px] -m-1 p-1 rounded-xl hover:bg-neutral-50 transition-colors"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 text-brand-700 shrink-0">
              <History className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="font-semibold text-neutral-900">Atividade</span>
              <span className="text-sm text-neutral-500">
                Quem apagou, corrigiu ou devolveu — e quando
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0 ml-auto" aria-hidden="true" />
          </Link>
        </Card>
      </div>

      {outroUsuario && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-neutral-700">Redefinir senha do outro usuário</h2>
          <Card>
            <ResetarSenhaOutroForm
              action={redefinirSenhaOutroAction.bind(null, outroUsuario.id)}
              nomeOutro={outroUsuario.nome}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

import { FlaskConical } from "lucide-react";
import { EH_AMBIENTE_TESTE } from "@/lib/ambienteCliente";

/**
 * Tarja do ambiente de teste. Some sozinha na produção (a variável não existe
 * lá), então não há como esquecê-la ligada.
 *
 * Fica no layout RAIZ, e não no `(app)`, de propósito: a primeira tela que a
 * cliente vê é o `/login`, que está fora do grupo `(app)`. Sem isso, ela
 * digitaria a senha sem nenhum aviso de onde está.
 *
 * O aviso também vai no TÍTULO da aba (ver `app/layout.tsx`): a tarja rola para
 * fora da tela quando a página é longa, e o título não. São duas camadas para o
 * mesmo risco — confundir teste com produção e fazer atendimento de verdade
 * aqui, que some no primeiro `branches reset`.
 */
export function TarjaAmbienteTeste() {
  if (!EH_AMBIENTE_TESTE) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-display font-extrabold uppercase tracking-wide text-amber-950
                 [background-image:repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.07)_10px,rgba(0,0,0,0.07)_20px)]"
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Ambiente de teste — nada aqui é de verdade
      </span>
    </div>
  );
}

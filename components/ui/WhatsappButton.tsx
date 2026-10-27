"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { linkWhatsapp } from "@/lib/whatsapp";
import { formatarTelefone } from "@/lib/telefone";
import { EH_AMBIENTE_TESTE } from "@/lib/ambienteCliente";

interface WhatsappButtonProps {
  telefone: string | null | undefined;
  mensagem: string;
  children: string;
  // Versão de dentro de card (lista de pendências do Caixa): mesmo verde e mesmo
  // comportamento, só menor, para dividir a linha com outro botão. Continua com
  // 44px de altura — o alvo de toque não encolhe.
  compacto?: boolean;
}

export function WhatsappButton({ telefone, mensagem, children, compacto }: WhatsappButtonProps) {
  const link = linkWhatsapp(telefone, mensagem);
  const [previa, setPrevia] = useState(false);

  const tamanho = compacto
    ? "min-h-[44px] px-4 text-sm w-full sm:w-auto"
    : "min-h-[52px] px-5 text-base w-full";
  const icone = compacto ? "w-4 h-4" : "w-5 h-5";
  const verde =
    "flex items-center justify-center gap-2 rounded-2xl font-display font-bold bg-[#25D366] text-white shadow-sm hover:bg-[#1fbd5a] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:bg-[#1aa650] transition-all";

  if (!link) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          disabled
          className={`flex items-center justify-center gap-2 rounded-2xl font-display font-bold bg-neutral-200 text-neutral-400 cursor-not-allowed select-none ${tamanho}`}
        >
          <MessageCircle className={icone} aria-hidden="true" />
          {children}
        </button>
        <span className="text-xs text-red-600">Cliente sem telefone válido para WhatsApp.</span>
      </div>
    );
  }

  /**
   * AMBIENTE DE TESTE: o botão continua verde, no mesmo lugar e clicável — mas
   * abre a PRÉVIA da mensagem em vez do wa.me.
   *
   * O staging isola o banco, não o mundo lá fora: o telefone vem de uma cópia
   * da produção, então um toque aqui mandaria mensagem de teste para um cliente
   * de verdade. Desabilitar o botão resolveria o risco mas esconderia o que ele
   * faz; trocar por um número fixo ainda abre o WhatsApp e depende de alguém
   * manter esse número certo. Mostrar o texto exato e o destinatário responde
   * "o que este botão faria?" melhor que as duas — é justamente a mensagem que
   * se quer conferir (a concordância de gênero, o nome do pet, o valor).
   */
  if (EH_AMBIENTE_TESTE) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setPrevia((v) => !v)} className={`${verde} ${tamanho}`}>
          <MessageCircle className={icone} aria-hidden="true" />
          {children}
        </button>

        {previa && (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-amber-900">
                Ambiente de teste — a mensagem NÃO foi enviada
              </p>
              <button
                type="button"
                onClick={() => setPrevia(false)}
                aria-label="Fechar prévia"
                className="-m-1 shrink-0 rounded-full p-1 text-amber-700 hover:bg-amber-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-amber-900">
              Na versão de verdade, o WhatsApp abriria para{" "}
              <strong>{formatarTelefone(telefone ?? "")}</strong> com este texto:
            </p>
            <p className="whitespace-pre-wrap rounded-xl bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm">
              {mensagem}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={`${verde} ${tamanho}`}>
      <MessageCircle className={icone} aria-hidden="true" />
      {children}
    </a>
  );
}

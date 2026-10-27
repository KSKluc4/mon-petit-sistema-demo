"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  PAISES_FREQUENTES,
  PAISES_TODOS,
  mascaraAoDigitar,
  paisDoTelefone,
  paraE164,
  partesParaEdicao,
  telefoneValido,
  type CodigoPais,
} from "@/lib/telefone";

interface PhoneInputProps {
  name: string;
  label: string;
  /** E.164 vindo do banco ("+5541999990000"), ou texto legado. */
  defaultValue?: string;
  required?: boolean;
}

/**
 * Telefone com país. Brasil vem selecionado, então o caso comum — digitar
 * "41 99999-0000" — continua sendo um campo só e nenhum passo a mais.
 *
 * O formulário manda o texto CRU e o país escolhido; quem converte para E.164 é
 * o servidor (`lib/telefone.ts` → `paraE164`). Assim existe uma conversão só, e
 * cliente e servidor não têm como discordar.
 *
 * Sem bandeira: emoji não entra na interface (CLAUDE.md → Design). O rótulo é
 * "+55 Brasil", com o código na frente de propósito — em tela estreita o select
 * corta o fim do texto, e o que não pode sumir é o código.
 */
export function PhoneInput({ name, label, defaultValue, required }: PhoneInputProps) {
  const inicial = partesParaEdicao(defaultValue);
  const [pais, setPais] = useState<CodigoPais>(inicial.pais);
  const [texto, setTexto] = useState(() => mascaraAoDigitar(inicial.nacional, inicial.pais));

  function aoDigitar(valor: string) {
    // Digitou "+1 416..." com Brasil selecionado: o número manda no país, e o
    // seletor acompanha — quem já sabe o código não precisa achar o país na lista.
    if (valor.startsWith("+")) {
      const detectado = paisDoTelefone(paraE164(valor, pais) ?? valor);
      if (detectado && detectado !== pais) setPais(detectado);
    }
    setTexto(mascaraAoDigitar(valor, pais));
  }

  function aoTrocarPais(novo: CodigoPais) {
    setPais(novo);
    // Remascara o que já estava digitado no padrão do país novo.
    setTexto(mascaraAoDigitar(texto.replace(/\D/g, ""), novo));
  }

  const e164 = paraE164(texto, pais);
  // Avisa, nunca bloqueia: cadastro rápido é prioridade e o número pode ser
  // atípico. Só aparece depois de o campo ter conteúdo de sobra, para não
  // piscar a cada tecla.
  const avisar = texto.replace(/\D/g, "").length >= 8 && !telefoneValido(e164);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-neutral-700">
        {label}
      </label>

      <div className="flex gap-2">
        <select
          aria-label="Código do país"
          value={pais}
          onChange={(e) => aoTrocarPais(e.target.value as CodigoPais)}
          className="min-h-[44px] w-[7.5rem] shrink-0 rounded-2xl border border-neutral-200 bg-white px-2 text-base text-neutral-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <optgroup label="Mais usados">
            {PAISES_FREQUENTES.map((p) => (
              <option key={`f-${p.codigo}`} value={p.codigo}>
                {p.ddi} {p.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Todos os países">
            {PAISES_TODOS.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.ddi} {p.nome}
              </option>
            ))}
          </optgroup>
        </select>

        <input
          id={name}
          name={name}
          type="tel"
          inputMode="tel"
          placeholder={pais === "BR" ? "(41) 99999-9999" : "Número"}
          value={texto}
          onChange={(e) => aoDigitar(e.target.value)}
          required={required}
          className="min-h-[44px] w-full min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {/* O país vai junto para o servidor poder refazer o parse sozinho. */}
      <input type="hidden" name={`${name}Pais`} value={pais} />

      {avisar && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Esse número não parece válido para o país escolhido. Dá para salvar assim mesmo — só
          confira se o WhatsApp vai funcionar.
        </p>
      )}
    </div>
  );
}

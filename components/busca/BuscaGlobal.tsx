"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EspecieIcon } from "@/components/agenda/EspecieIcon";
import { normalizarTexto, somenteDigitos } from "@/lib/texto";
import { digitosDeBusca, formatarTelefone } from "@/lib/telefone";

export type PetResultado = {
  id: string;
  nome: string;
  especie: string;
  fotoUrl: string | null;
  tutor: string;
  telefoneTutor: string;
};

export type ClienteResultado = {
  id: string;
  nome: string;
  telefone: string;
  pets: string[];
};

export function BuscaGlobal({ pets, clientes }: { pets: PetResultado[]; clientes: ClienteResultado[] }) {
  const [busca, setBusca] = useState("");

  const { petsFiltrados, clientesFiltrados } = useMemo(() => {
    const q = normalizarTexto(busca.trim());
    const digitos = somenteDigitos(busca);

    if (!q && !digitos) return { petsFiltrados: [], clientesFiltrados: [] };

    const combinaTexto = (texto: string) => q.length > 0 && normalizarTexto(texto).includes(q);
    // Exige um trecho mínimo de dígitos — um único dígito bateria com quase
    // todos os telefones e faria a lista "piscar" enquanto o usuário digita.
    //
    // Compara contra o E.164 completo E contra o número sem o código do país
    // (`digitosDeBusca`): quem procura digita o número local, "99999", não
    // "5541999990000". Sem o recorte nacional, buscar "41" passaria a competir
    // com o "55" que hoje está na frente de todo telefone brasileiro.
    const combinaTelefone = (telefone: string) =>
      digitos.length >= 3 && digitosDeBusca(telefone).some((d) => d.includes(digitos));

    return {
      petsFiltrados: pets.filter(
        (p) => combinaTexto(p.nome) || combinaTexto(p.tutor) || combinaTelefone(p.telefoneTutor),
      ),
      clientesFiltrados: clientes.filter(
        (c) => combinaTexto(c.nome) || combinaTelefone(c.telefone),
      ),
    };
  }, [busca, pets, clientes]);

  const buscando = busca.trim().length > 0;
  const semResultados = buscando && petsFiltrados.length === 0 && clientesFiltrados.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome do pet, do tutor ou telefone..."
          autoFocus
          className="w-full min-h-[52px] rounded-2xl border border-neutral-200 bg-white pl-12 pr-4 text-base text-neutral-900 placeholder:text-neutral-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {!buscando && (
        <div className="flex flex-col items-center gap-2 py-14 text-center text-neutral-400">
          <Search className="w-10 h-10" aria-hidden="true" />
          <p className="text-sm">Digite para buscar.</p>
        </div>
      )}

      {semResultados && <EmptyState message={`Nenhum resultado para "${busca}".`} />}

      {petsFiltrados.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-500">Pets</h2>
          {petsFiltrados.map((p) => (
            <Link key={p.id} href={`/pets/${p.id}`}>
              <Card className="flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                {p.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.fotoUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border border-neutral-200 shrink-0"
                  />
                ) : (
                  <span className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 text-brand-600 shrink-0">
                    <EspecieIcon especie={p.especie} className="w-6 h-6" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900 truncate">{p.nome}</p>
                  <p className="text-sm text-neutral-500 truncate">{p.tutor}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {clientesFiltrados.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-500">Clientes</h2>
          {clientesFiltrados.map((c) => (
            <Link key={c.id} href={`/clientes/${c.id}`}>
              <Card className="flex flex-col gap-0.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <p className="font-semibold text-neutral-900">{c.nome}</p>
                <p className="text-sm text-neutral-500">{formatarTelefone(c.telefone)}</p>
                <p className="text-sm text-neutral-500">
                  {c.pets.length === 0 ? "Sem pets cadastrados" : c.pets.join(", ")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

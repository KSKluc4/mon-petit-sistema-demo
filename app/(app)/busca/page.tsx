import { prisma } from "@/lib/prisma";
import { BuscaGlobal, type ClienteResultado, type PetResultado } from "@/components/busca/BuscaGlobal";

export const metadata = { title: "Busca" };

export default async function BuscaPage() {
  const [petsDb, clientesDb] = await Promise.all([
    prisma.pet.findMany({
      orderBy: { nome: "asc" },
      include: { cliente: { select: { nome: true, telefone: true } } },
    }),
    prisma.cliente.findMany({
      orderBy: { nome: "asc" },
      include: { pets: { select: { nome: true }, orderBy: { nome: "asc" } } },
    }),
  ]);

  const pets: PetResultado[] = petsDb.map((p) => ({
    id: p.id,
    nome: p.nome,
    especie: p.especie,
    fotoUrl: p.fotoUrl,
    tutor: p.cliente.nome,
    telefoneTutor: p.cliente.telefone,
  }));

  const clientes: ClienteResultado[] = clientesDb.map((c) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    pets: c.pets.map((p) => p.nome),
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-neutral-900">Busca</h1>
      <BuscaGlobal pets={pets} clientes={clientes} />
    </div>
  );
}

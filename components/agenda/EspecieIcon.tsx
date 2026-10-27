import { Dog, Cat } from "lucide-react";
import type { Especie } from "@/app/generated/prisma/client";

export function EspecieIcon({ especie, className = "w-4 h-4" }: { especie: Especie | string; className?: string }) {
  const Icon = especie === "GATO" ? Cat : Dog;
  return <Icon className={className} aria-hidden="true" />;
}

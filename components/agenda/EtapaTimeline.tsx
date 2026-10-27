import { CalendarCheck, PackageCheck, Check } from "lucide-react";

const ETAPAS = [
  { label: "Agendado", Icon: CalendarCheck },
  { label: "Pronto", Icon: PackageCheck },
  { label: "Entregue", Icon: Check },
];

// Linha do tempo simples e só leitura — bolinhas conectadas, sem JS.
// Três degraus desde a simplificação do fluxo: o agendamento existir já cumpre
// o primeiro, então ele nasce concluído e o `rank` governa os outros dois.
export function EtapaTimeline({ rank }: { rank: number }) {
  const concluidos = [true, rank >= 1, rank >= 2];
  // Etapa atual = o primeiro degrau ainda não concluído (o que está em andamento
  // agora). Puramente visual — não influencia a lógica de conclusão acima.
  const atual = concluidos.findIndex((c) => !c);

  return (
    <div className="flex items-start">
      {ETAPAS.map(({ label, Icon }, i) => {
        const concluido = concluidos[i];
        const emAndamento = i === atual;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`relative flex ${emAndamento ? "h-8 w-8" : "h-7 w-7"} items-center justify-center`}>
                {emAndamento && (
                  <span className="absolute inset-0 rounded-full bg-accent-400 animate-ping opacity-50" />
                )}
                <div
                  className={`relative flex h-full w-full items-center justify-center rounded-full transition-colors ${
                    concluido
                      ? "bg-brand-600 text-white"
                      : emAndamento
                        ? "bg-accent-600 text-white shadow-sm"
                        : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  <Icon className={emAndamento ? "w-4 h-4" : "w-3.5 h-3.5"} strokeWidth={2.5} aria-hidden="true" />
                </div>
              </div>
              <span
                className={`text-[11px] text-center whitespace-nowrap ${
                  concluido || emAndamento ? "font-semibold text-neutral-900" : "text-neutral-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div
                className={`mx-1 mb-4 h-0.5 flex-1 transition-colors ${
                  concluidos[i + 1] ? "bg-brand-600" : "bg-neutral-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import {
  CalendarCheck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Wallet,
  Search,
  PartyPopper,
  HandCoins,
  Ticket,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EspecieIcon } from "@/components/agenda/EspecieIcon";
import {
  formatCentavos,
  formatDataExtenso,
  formatHora,
  hojeISO,
  intervaloDoDia,
  saudacaoAtual,
} from "@/lib/datas";
import {
  faturamentoDaSemana,
  faturamentoDoDia,
  faturamentoDoMes,
  resumoPendencias,
} from "@/lib/faturamento";
import { pacotesVencendo } from "@/lib/pacotes";
import { STATUS_VISIVEIS } from "@/components/agenda/statusInfo";
import type { StatusAgendamento } from "@/app/generated/prisma/client";

type StatusVisivel = (typeof STATUS_VISIVEIS)[number];

// O enum ainda carrega o legado EM_ATENDIMENTO. Nenhuma linha deveria estar
// nele (a migration `simplifica_fluxo_atendimento` converteu todas), mas se
// alguma sobrar ela conta como agendada — igualzinho ao que a agenda mostra.
function normalizar(status: StatusAgendamento): StatusVisivel {
  return status === "EM_ATENDIMENTO" ? "AGENDADO" : status;
}

// Só os status visíveis do fluxo: o enum ainda carrega o legado
// EM_ATENDIMENTO, que não vira card. Por isso a chave é STATUS_VISIVEIS[number]
// e não StatusAgendamento — assim o `Object.keys` de antes não pode ressuscitar
// um quinto card sem querer.
const CARD_INFO: Record<
  StatusVisivel,
  { label: string; icon: typeof CalendarCheck; bg: string; text: string; iconBg: string }
> = {
  AGENDADO: {
    label: "Agendados",
    icon: CalendarCheck,
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    iconBg: "bg-emerald-500",
  },
  // Pets prontos esperando a retirada — a informação que importa no balcão.
  PRONTO: {
    label: "Prontos",
    icon: PackageCheck,
    bg: "bg-amber-50",
    text: "text-amber-800",
    iconBg: "bg-amber-500",
  },
  FINALIZADO: {
    label: "Finalizados",
    icon: CheckCircle2,
    bg: "bg-sky-50",
    text: "text-sky-800",
    iconBg: "bg-sky-500",
  },
  CANCELADO: {
    label: "Cancelados",
    icon: XCircle,
    bg: "bg-rose-50",
    text: "text-rose-800",
    iconBg: "bg-rose-500",
  },
};

export default async function DashboardPage() {
  const session = await getSession();
  const hoje = hojeISO();
  const { inicio, fim } = intervaloDoDia(hoje);

  const [agendamentosHoje, dia, semana, mes, pendencias, vencendo] = await Promise.all([
    prisma.agendamento.findMany({
      where: { dataHora: { gte: inicio, lt: fim } },
      orderBy: { dataHora: "asc" },
      include: { pet: { include: { cliente: true } }, servicos: { include: { servico: true } } },
    }),
    faturamentoDoDia(hoje),
    faturamentoDaSemana(hoje),
    faturamentoDoMes(hoje),
    // Sem recorte de data: uma conta em aberto desde julho tem que aparecer no
    // dashboard de hoje. É o ponto do indicador.
    resumoPendencias(),
    // Pacote com saldo prestes a vencer: banho já pago que o cliente perde se
    // ninguém avisar. Fica FORA do bloco condicional de "tem agendamento hoje"
    // pelo mesmo motivo do banner de pendências — num dia parado é justamente
    // quando dá para ligar para o cliente.
    pacotesVencendo(),
  ]);

  const temPendencia = pendencias.qtdAReceber > 0 || pendencias.qtdSemValor > 0;

  const contagem: Record<StatusVisivel, number> = {
    AGENDADO: 0,
    PRONTO: 0,
    FINALIZADO: 0,
    CANCELADO: 0,
  };
  for (const ag of agendamentosHoje) contagem[normalizar(ag.status)]++;

  // Pendente = ainda não entregue. Pet pronto esperando retirada continua
  // pendente: é justamente o que o balcão precisa ver.
  const proximos = agendamentosHoje
    .filter((ag) => {
      const s = normalizar(ag.status);
      return s === "AGENDADO" || s === "PRONTO";
    })
    .slice(0, 5);

  const semNadaHoje = agendamentosHoje.length === 0;
  const agendaHoje = `/agenda?data=${hoje}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-900">
          {saudacaoAtual()}, {session?.nome}!
        </h1>
        <p className="text-neutral-500">{formatDataExtenso(hoje)}</p>
      </div>

      {/* Faturamento: dia em destaque, semana e mês menores. Lado a lado a
          partir do tablet, empilhados no celular. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/caixa"
          className="block rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white px-5 py-6 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-brand-100 font-medium">Bruto do dia</p>
            <Wallet className="w-5 h-5 text-brand-200" aria-hidden="true" />
          </div>
          <p className="text-4xl font-display font-extrabold tabular-nums mt-1">{formatCentavos(dia.bruto)}</p>
          {/* Bruto e líquido nomeados desde que existem taxas: "faturamento"
              sozinho virou ambíguo. Os três cards contam pelo dia em que o
              dinheiro ENTROU (regime de caixa), então o que está em aberto não
              aparece aqui — tem banner próprio logo abaixo. */}
          <p className="text-sm text-brand-100 mt-1 font-medium">
            líquido {formatCentavos(dia.liquido)}
          </p>
          <p className="text-xs text-brand-200 mt-0.5">pelo dia do recebimento</p>
        </Link>

        <div className="rounded-2xl bg-white border border-neutral-100 px-5 py-4 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-neutral-500 font-medium">Esta semana</p>
          <p className="text-2xl font-display font-bold text-neutral-900 tabular-nums mt-0.5">
            {formatCentavos(semana.bruto)}
          </p>
          <p className="text-xs text-neutral-400">segunda a domingo</p>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-100 px-5 py-4 shadow-sm flex flex-col justify-center">
          <p className="text-sm text-neutral-500 font-medium">Este mês</p>
          <p className="text-2xl font-display font-bold text-neutral-900 tabular-nums mt-0.5">
            {formatCentavos(mes.bruto)}
          </p>
          <p className="text-xs text-neutral-400">do dia 1 até hoje</p>
        </div>
      </div>

      {/* Valores em aberto, de QUALQUER data. Fica fora do bloco condicional de
          "tem agendamento hoje" de propósito: num dia parado é justamente
          quando dá para cobrar, e some da vista se depender do movimento. */}
      {temPendencia && (
        <Link
          href="/caixa"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <HandCoins className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-amber-900">
              {formatCentavos(pendencias.totalAReceber)} a receber
            </p>
            <p className="text-sm text-amber-800">
              {pendencias.qtdAReceber > 0 && (
                <>
                  {pendencias.qtdAReceber} atendimento
                  {pendencias.qtdAReceber === 1 ? "" : "s"} em aberto
                </>
              )}
              {pendencias.qtdAReceber > 0 && pendencias.qtdSemValor > 0 && " · "}
              {pendencias.qtdSemValor > 0 && (
                <>
                  {pendencias.qtdSemValor} sem valor definido
                </>
              )}
              {pendencias.diasMaisAntiga >= 7 && ` · mais antigo há ${pendencias.diasMaisAntiga} dias`}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-amber-800">Ver</span>
        </Link>
      )}

      {vencendo.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 font-display font-bold text-amber-900">
            <Ticket className="h-4 w-4 shrink-0" aria-hidden="true" />
            {vencendo.length === 1
              ? "1 pacote vence em breve com banho sobrando"
              : `${vencendo.length} pacotes vencem em breve com banho sobrando`}
          </p>
          <ul className="flex flex-col gap-1">
            {vencendo.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pets/${p.petId}?tab=pacotes`}
                  className="flex items-baseline justify-between gap-2 text-sm text-amber-900 hover:underline"
                >
                  <span className="truncate font-semibold">{p.petNome}</span>
                  <span className="shrink-0 text-amber-800">
                    {p.restantes} banho{p.restantes === 1 ? "" : "s"} ·{" "}
                    {p.diasParaVencer <= 0
                      ? "vence hoje"
                      : `${p.diasParaVencer} dia${p.diasParaVencer === 1 ? "" : "s"}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {semNadaHoje ? (
        <EmptyState message="Nenhum agendamento hoje." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {STATUS_VISIVEIS.map((status) => {
              const info = CARD_INFO[status];
              const Icon = info.icon;
              return (
                <Link
                  key={status}
                  href={agendaHoje}
                  className={`rounded-2xl ${info.bg} px-4 py-4 flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
                >
                  <span className={`flex items-center justify-center w-9 h-9 rounded-xl ${info.iconBg} text-white`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className={`text-3xl font-display font-extrabold tabular-nums ${info.text}`}>
                    {contagem[status]}
                  </span>
                  <span className={`text-sm font-semibold ${info.text}`}>{info.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-neutral-900">Pendentes de hoje</h2>
              <Link
                href={agendaHoje}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800 min-h-[44px] flex items-center"
              >
                Ver agenda completa
              </Link>
            </div>
            {proximos.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-4 flex items-center justify-center gap-2">
                <PartyPopper className="w-4 h-4 text-accent-500" aria-hidden="true" />
                Tudo certo por aqui — nenhum pendente.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {proximos.map((ag) => (
                  <Link key={ag.id} href={`/agendamentos/${ag.id}`}>
                    <Card className="flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
                      <span className="text-lg font-display font-bold text-neutral-900 tabular-nums shrink-0">
                        {formatHora(ag.dataHora)}
                      </span>
                      {ag.pet.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ag.pet.fotoUrl}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 text-brand-600 shrink-0">
                          <EspecieIcon especie={ag.pet.especie} className="w-4 h-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900 truncate">{ag.pet.nome}</p>
                        <p className="text-sm text-neutral-500 truncate">
                          {ag.servicos.map((s) => s.servico.nome).join(" + ") || "Sem serviços"}
                        </p>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <ButtonLink href="/agenda/novo" variant="accent" className="w-full">
          + Novo agendamento
        </ButtonLink>
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href="/busca" variant="secondary">
            <Search className="w-4 h-4" aria-hidden="true" /> Buscar
          </ButtonLink>
          <ButtonLink href="/caixa" variant="secondary">
            <Wallet className="w-4 h-4" aria-hidden="true" /> Caixa
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

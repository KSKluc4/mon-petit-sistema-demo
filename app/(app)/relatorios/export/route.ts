import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { resolverPeriodo } from "@/lib/periodos";
import { gerarRelatorio } from "@/lib/relatorios";
import { montarXlsx } from "@/lib/exportacao/xlsx";
import { montarPdf } from "@/lib/exportacao/pdf";

// exceljs e jspdf são bibliotecas de Node (Buffer, streams) — o runtime edge
// não serve.
export const runtime = "nodejs";
// O relatório muda a cada atendimento fechado; nada aqui pode ser cacheado.
export const dynamic = "force-dynamic";

const TIPOS = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export async function GET(request: NextRequest) {
  // O middleware (`proxy.ts`) só confere a ASSINATURA do JWT, não se a sessão
  // continua válida no banco. A checagem funda é aqui — sem ela, um cookie de
  // sessão já invalidada ainda baixaria o relatório inteiro da loja. Ver
  // CLAUDE.md → "Invalidação de sessão".
  //
  // `getSession()` e não `requireSession()`: este último lança, e numa rota de
  // download isso viraria um 500 no meio do clique. Como os botões de exportar
  // são links de verdade, mandar para o login é o que o navegador sabe tratar.
  if (!(await getSession())) {
    return NextResponse.redirect(new URL("/login?redirect=/relatorios", request.url));
  }

  const { searchParams } = request.nextUrl;
  const formato = searchParams.get("formato") === "pdf" ? "pdf" : "xlsx";

  const periodo = resolverPeriodo({
    atalho: searchParams.get("atalho") ?? undefined,
    de: searchParams.get("de") ?? undefined,
    ate: searchParams.get("ate") ?? undefined,
  });
  const relatorio = await gerarRelatorio(periodo.inicioISO, periodo.fimISO);

  const corpo =
    formato === "xlsx" ? await montarXlsx(relatorio, periodo) : await montarPdf(relatorio, periodo);

  const nome = `mon-petit-relatorio-${periodo.inicioISO}-a-${periodo.fimISO}.${formato}`;

  return new NextResponse(corpo as BodyInit, {
    headers: {
      "Content-Type": TIPOS[formato],
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

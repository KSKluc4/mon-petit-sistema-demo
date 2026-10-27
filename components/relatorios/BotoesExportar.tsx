import { FileSpreadsheet, FileText } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

/**
 * Links diretos para o route handler de exportação, carregando o mesmo período
 * que está na tela. São `<a>` comuns (e não fetch + blob) de propósito: o
 * navegador cuida do download, e o arquivo continua acessível colando a URL —
 * útil quando ela quiser só reenviar a planilha do mês para a contabilidade.
 */
export function BotoesExportar({ query }: { query: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <a href={`/relatorios/export?formato=xlsx&${query}`} className={buttonClass("primary", "flex-1")}>
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        Exportar Excel
      </a>
      <a href={`/relatorios/export?formato=pdf&${query}`} className={buttonClass("secondary", "flex-1")}>
        <FileText className="h-4 w-4" aria-hidden="true" />
        Exportar PDF
      </a>
    </div>
  );
}

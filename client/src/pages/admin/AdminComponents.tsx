import type { ElementType, ReactNode, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function StatCard({ label, value, sub, icon: Icon, color = "text-foreground" }: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ElementType;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value ?? "—"}</div>
      {sub && <div className="text-muted-foreground text-xs">{sub}</div>}
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const { t } = useTranslation("axisAdmin");
  const pages = Math.ceil(total / limit) || 1;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
      <Button variant="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span>{t("common.page")} {page} {t("common.of")} {pages}</span>
      <Button variant="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold text-foreground mb-4">{children}</h2>;
}

export function SubTitle({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{children}</div>;
}

export function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <th
      className={`text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border ${onClick ? "cursor-pointer select-none hover:text-foreground transition-colors" : ""} ${className}`}
      onClick={onClick}
    >{children}</th>
  );
}

export function Td({ children, className = "", colSpan, onClick }: { children: ReactNode; className?: string; colSpan?: number; onClick?: (e: MouseEvent) => void }) {
  return <td colSpan={colSpan} onClick={onClick} className={`px-4 py-3 border-b border-border/40 ${className}`}>{children}</td>;
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><Td colSpan={colSpan} className="text-center text-muted-foreground py-8">{label}</Td></tr>;
}

export function SortIcon({ field, sort, dir }: { field: string; sort: string; dir: "asc" | "desc" }) {
  if (sort !== field) return <span className="ml-1 opacity-30">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

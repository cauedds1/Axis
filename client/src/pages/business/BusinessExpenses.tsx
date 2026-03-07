import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, FileSpreadsheet, Printer, Filter, ReceiptText, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BLUE = "#2563EB";
const BLUE_LIGHT = "#3B82F6";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="text-[10px] font-semibold" style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}>Aprovado</Badge>;
  if (status === "rejected") return <Badge className="text-[10px] font-semibold" style={{ background: "#EF444415", color: "#EF4444", border: "1px solid #EF444430" }}>Rejeitado</Badge>;
  return <Badge className="text-[10px] font-semibold" style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>Pendente</Badge>;
}

function ReceiptModal({ expense, onClose }: { expense: any; onClose: () => void }) {
  return (
    <Dialog open={!!expense} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4" style={{ color: BLUE_LIGHT }} />
            {expense?.establishment || expense?.description}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {(expense?.receiptImageUrl || expense?.receiptImageBase64) && (
            <div className="rounded-xl overflow-hidden border border-border/40">
              <img
                src={
                  expense.receiptImageUrl
                    ? expense.receiptImageUrl
                    : `data:image/jpeg;base64,${expense.receiptImageBase64}`
                }
                alt="Foto do recibo"
                className="w-full object-contain max-h-80"
                data-testid="img-receipt"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs text-muted-foreground mb-1">Valor</p>
              <p className="font-bold text-foreground" data-testid="text-expense-amount">{formatBRL(expense?.amount ?? 0)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs text-muted-foreground mb-1">Data</p>
              <p className="font-medium text-foreground">{expense?.date ? format(new Date(expense.date), "dd/MM/yyyy") : "—"}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs text-muted-foreground mb-1">Colaborador</p>
              <p className="font-medium text-foreground truncate">{expense?.userName || expense?.userEmail || "—"}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
              <p className="font-medium text-foreground">{expense?.paymentMethod || "—"}</p>
            </div>
            {expense?.categoryName && (
              <div className="rounded-xl p-3 col-span-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs text-muted-foreground mb-1">Categoria</p>
                <p className="font-medium text-foreground">{expense.categoryName}</p>
              </div>
            )}
            {expense?.notes && (
              <div className="rounded-xl p-3 col-span-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm text-foreground">{expense.notes}</p>
              </div>
            )}
            <div className="col-span-2 flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Status:</p>
              {statusBadge(expense?.status ?? "pending_review")}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessExpenses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations"],
  });

  const activeOrg = selectedOrgId ? orgs?.find(o => o.id === selectedOrgId) : orgs?.[0];
  const isAdmin = activeOrg?.adminUserId === user?.id;

  const expenseParams = new URLSearchParams();
  if (filterStatus !== "all") expenseParams.set("status", filterStatus);
  if (filterUser !== "all") expenseParams.set("userId", filterUser);
  if (startDate) expenseParams.set("startDate", startDate);
  if (endDate) expenseParams.set("endDate", endDate);

  const { data: expenses, isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses", filterStatus, filterUser, startDate, endDate],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses?${expenseParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar despesas");
      return res.json();
    },
    enabled: !!activeOrg?.id,
  });

  const { data: members } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/business/organizations/${activeOrg!.id}/expenses/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "expenses"] });
      toast({ title: "Despesa atualizada!" });
    },
    onError: () => toast({ title: "Erro ao atualizar despesa", variant: "destructive" }),
  });

  const grouped = (expenses ?? []).reduce((acc: Record<string, any[]>, e) => {
    const dateKey = e.date ? format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR }) : "Sem data";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(e);
    return acc;
  }, {});

  const totalApproved = (expenses ?? []).filter(e => e.status !== "rejected").reduce((s, e) => s + e.amount, 0);

  const handleExportExcel = useCallback(async () => {
    if (!activeOrg?.id) return;
    const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses/export-excel?${expenseParams.toString()}`, { credentials: "include" });
    if (!res.ok) { toast({ title: "Erro ao exportar", variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despesas-${activeOrg.name}-${format(new Date(), "yyyy-MM")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeOrg, expenseParams]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (orgsLoading) return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  if (!orgs || orgs.length === 0) return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-20 text-center gap-4">
      <ReceiptText className="w-12 h-12 text-muted-foreground" />
      <p className="text-muted-foreground">Crie uma empresa primeiro na página <strong>Minha Empresa</strong>.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto print:p-0">
      <ReceiptModal expense={selectedExpense} onClose={() => setSelectedExpense(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie e exporte as despesas da equipe</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs" data-testid="button-print">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir / PDF
          </Button>
          <Button size="sm" onClick={handleExportExcel} className="text-xs border-0" style={{ background: BLUE, color: "white" }} data-testid="button-export-excel">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {orgs.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4 print:hidden">
          {orgs.map((org: any) => (
            <button
              key={org.id}
              onClick={() => setSelectedOrgId(org.id)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
              style={{
                background: activeOrg?.id === org.id ? BLUE : "transparent",
                color: activeOrg?.id === org.id ? "white" : "rgba(255,255,255,0.5)",
                borderColor: activeOrg?.id === org.id ? BLUE : "rgba(255,255,255,0.12)",
              }}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}

      <div className="print:hidden">
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          data-testid="button-toggle-filters"
        >
          <Filter className="w-4 h-4" />
          Filtros
          {showFilters ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {showFilters && (
          <div className="rounded-2xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending_review">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Colaborador</label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-filter-user">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {members?.map((m: any) => (
                    <SelectItem key={m.userId} value={m.userId}>{m.userName || m.userEmail}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data início</label>
              <Input type="date" className="h-8 text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-start-date" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data fim</label>
              <Input type="date" className="h-8 text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-end-date" />
            </div>
          </div>
        )}
      </div>

      {activeOrg && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{expenses?.length ?? 0} despesas encontradas</p>
          <p className="text-sm font-semibold text-foreground">
            Total aprovado: <span style={{ color: BLUE_LIGHT }}>{formatBRL(totalApproved)}</span>
          </p>
        </div>
      )}

      {expLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <ReceiptText className="w-10 h-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhuma despesa encontrada.</p>
          <p className="text-xs text-muted-foreground">Os colaboradores podem enviar fotos pelo WhatsApp para registrar despesas aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([date, dayExpenses]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
                <span className="text-xs font-semibold text-muted-foreground px-2">{date}</span>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>
              <div className="flex flex-col gap-2">
                {(dayExpenses as any[]).map((expense: any) => (
                  <div
                    key={expense.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all hover:border-white/15"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                    onClick={() => setSelectedExpense(expense)}
                    data-testid={`row-expense-${expense.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{expense.establishment || expense.description}</p>
                        {expense.categoryName && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${BLUE}15`, color: BLUE_LIGHT }}>
                            {expense.categoryName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{expense.userName || expense.userEmail || "—"}</span>
                        {expense.paymentMethod && (
                          <>
                            <span className="text-muted-foreground/30 text-xs">·</span>
                            <span className="text-xs text-muted-foreground">{expense.paymentMethod}</span>
                          </>
                        )}
                        {expense.receiptImageBase64 && (
                          <>
                            <span className="text-muted-foreground/30 text-xs">·</span>
                            <span className="text-xs" style={{ color: BLUE_LIGHT }}>📷 recibo</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatBRL(expense.amount)}</p>
                      {statusBadge(expense.status)}
                      {isAdmin && expense.status === "pending_review" && (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => approveMutation.mutate({ id: expense.id, status: "approved" })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                            style={{ background: "#10B98115", border: "1px solid #10B98130" }}
                            title="Aprovar"
                            data-testid={`button-approve-${expense.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          </button>
                          <button
                            onClick={() => approveMutation.mutate({ id: expense.id, status: "rejected" })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                            style={{ background: "#EF444415", border: "1px solid #EF444430" }}
                            title="Rejeitar"
                            data-testid={`button-reject-${expense.id}`}
                          >
                            <XCircle className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

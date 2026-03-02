import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2, ChevronRight, X, Loader2, Eye, Calendar, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getInvoiceMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysUntilClosing(closingDay: number): number {
  const now = new Date();
  const today = now.getDate();
  if (today < closingDay) return closingDay - today;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, closingDay);
  const diff = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

const CARD_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706", "#DB2777", "#0891B2", "#374151",
];

interface CardFormData {
  name: string;
  bank: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  color: string;
}

const EMPTY_FORM: CardFormData = { name: "", bank: "", limit: "", closingDay: "", dueDay: "", color: "#7C3AED" };

export function CreditCardsTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CardFormData>(EMPTY_FORM);
  const [invoiceCardId, setInvoiceCardId] = useState<string | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/credit-cards"] });
  const { data: invoiceData, isLoading: invoiceLoading } = useQuery<any>({
    queryKey: ["/api/credit-cards", invoiceCardId, "invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/credit-cards/${invoiceCardId}/invoices`, { credentials: "include" });
      return res.json();
    },
    enabled: !!invoiceCardId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/credit-cards", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      toast({ title: "Cartão adicionado" });
    },
    onError: () => toast({ title: "Erro ao adicionar cartão", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/credit-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      setDeleteCardId(null);
      toast({ title: "Cartão removido" });
    },
    onError: () => toast({ title: "Erro ao remover cartão", variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const limitNum = parseFloat(form.limit);
    const closingNum = parseInt(form.closingDay);
    const dueNum = parseInt(form.dueDay);
    if (!form.name || !form.bank || isNaN(limitNum) || isNaN(closingNum) || isNaN(dueNum)) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name: form.name, bank: form.bank, limit: limitNum, closingDay: closingNum, dueDay: dueNum, color: form.color });
  }

  const activeCard = invoiceCardId ? cards.find((c: any) => c.id === invoiceCardId) : null;
  const currentMonthKey = getInvoiceMonthKey();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Seus cartões de crédito</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-credit-card">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && cards.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-sm">Nenhum cartão cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione seus cartões de crédito para controlar o limite e as faturas</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} data-testid="button-add-credit-card-empty">
              <Plus className="h-4 w-4 mr-1" /> Adicionar cartão
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {cards.map((card: any) => {
          const usedKey = currentMonthKey;
          const pct = Math.min(100, (card.usedThisMonth ?? 0) / Math.max(card.limit, 1) * 100);
          const isHigh = pct > 80;
          const daysLeft = daysUntilClosing(card.closingDay);
          const available = Math.max(0, card.limit - (card.usedThisMonth ?? 0));

          return (
            <Card key={card.id} className="overflow-hidden border-border" data-testid={`card-credit-${card.id}`}>
              <div className="h-1 w-full" style={{ background: card.color || "#7C3AED" }} />
              <CardContent className="py-4 px-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{card.name}</p>
                    <p className="text-xs text-muted-foreground">{card.bank}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setInvoiceCardId(card.id)}
                      data-testid={`button-view-invoice-${card.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteCardId(card.id)}
                      data-testid={`button-delete-credit-card-${card.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Limite</p>
                    <p className="text-sm font-semibold">R$ {fmtBRL(card.limit)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Usado</p>
                    <p className={`text-sm font-semibold ${isHigh ? "text-destructive" : ""}`}>R$ {fmtBRL(card.usedThisMonth ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Disponível</p>
                    <p className="text-sm font-semibold text-green-500">R$ {fmtBRL(available)}</p>
                  </div>
                </div>

                <div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: isHigh ? "#DC2626" : (card.color || "#7C3AED") }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(0)}% do limite usado</p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Fecha dia {card.closingDay} · Vence dia {card.dueDay}
                  </span>
                  {isHigh && (
                    <span className="flex items-center gap-1 text-destructive font-medium">
                      <AlertCircle className="h-3 w-3" /> Limite alto
                    </span>
                  )}
                  {!isHigh && (
                    <span>Fecha em {daysLeft} dia{daysLeft !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add card dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cartão de crédito</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="form-add-credit-card">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Nome do cartão *</label>
                <Input
                  placeholder="Ex: Nubank, Itaú Platinum..."
                  value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                  data-testid="input-card-name"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Banco *</label>
                <Input
                  placeholder="Ex: Nubank, Itaú..."
                  value={form.bank}
                  onChange={(e) => setForm(p => ({ ...p, bank: e.target.value }))}
                  required
                  data-testid="input-card-bank"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Limite (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="5000.00"
                  value={form.limit}
                  onChange={(e) => setForm(p => ({ ...p, limit: e.target.value }))}
                  required
                  data-testid="input-card-limit"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dia de fechamento *</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="15"
                  value={form.closingDay}
                  onChange={(e) => setForm(p => ({ ...p, closingDay: e.target.value }))}
                  required
                  data-testid="input-card-closing-day"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dia de vencimento *</label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="22"
                  value={form.dueDay}
                  onChange={(e) => setForm(p => ({ ...p, dueDay: e.target.value }))}
                  required
                  data-testid="input-card-due-day"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Cor do cartão</label>
              <div className="flex gap-2 flex-wrap">
                {CARD_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{ background: color, borderColor: form.color === color ? "white" : "transparent" }}
                    onClick={() => setForm(p => ({ ...p, color }))}
                    data-testid={`button-card-color-${color}`}
                  />
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-credit-card">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar cartão
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice sheet */}
      <Sheet open={!!invoiceCardId} onOpenChange={(o) => { if (!o) setInvoiceCardId(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ background: activeCard?.color || "#7C3AED" }} />
              {activeCard?.name || "Fatura"}
            </SheetTitle>
          </SheetHeader>

          {invoiceLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!invoiceLoading && invoiceData && (
            <div className="mt-4 space-y-4">
              {(invoiceData.invoices || []).map((invoice: any) => {
                const isCurrent = invoice.monthKey === currentMonthKey;
                const [y, m] = invoice.monthKey.split("-");
                const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

                return (
                  <div key={invoice.id} className="rounded-xl border border-border overflow-hidden" data-testid={`invoice-${invoice.monthKey}`}>
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div>
                        <p className="text-sm font-semibold capitalize">{monthLabel}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {invoice.status === "open" ? (
                            <span className="text-yellow-500">Aberta · fecha dia {activeCard?.closingDay}</span>
                          ) : invoice.status === "closed" ? (
                            <span className="text-blue-400">Fechada · vence dia {activeCard?.dueDay}</span>
                          ) : (
                            <span className="text-green-500">Paga</span>
                          )}
                        </p>
                      </div>
                      <p className="text-lg font-bold">R$ {fmtBRL(invoice.total)}</p>
                    </div>

                    {invoice.transactions && invoice.transactions.length > 0 && (
                      <div className="divide-y divide-border/40">
                        {invoice.transactions.map((tx: any) => {
                          let installmentBadge = null;
                          if (tx.installmentInfo) {
                            try {
                              const info = JSON.parse(tx.installmentInfo);
                              installmentBadge = `${info.current}/${info.total}`;
                            } catch {}
                          }
                          return (
                            <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 text-sm" data-testid={`invoice-tx-${tx.id}`}>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-sm">{tx.description}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(tx.date).toLocaleDateString("pt-BR")}
                                  {tx.categoryName && ` · ${tx.categoryName}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {installmentBadge && (
                                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">
                                    {installmentBadge}
                                  </span>
                                )}
                                <span className="font-semibold text-destructive">R$ {fmtBRL(tx.amount)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(!invoice.transactions || invoice.transactions.length === 0) && (
                      <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                        Nenhuma transação neste período
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteCardId} onOpenChange={(o) => { if (!o) setDeleteCardId(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-delete-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              O cartão e suas faturas serão removidos. As transações vinculadas continuarão no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-card">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteCardId) deleteMutation.mutate(deleteCardId); }}
              data-testid="button-confirm-delete-card"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

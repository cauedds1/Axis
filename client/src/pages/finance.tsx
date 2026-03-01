import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Trash2, Upload, Camera, TrendingUp, TrendingDown, Loader2, X, Check, CreditCard, Smartphone, Banknote, Wallet, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CaptureButton } from "@/components/capture-button";
import { BillsTab } from "@/components/bills-tab";
import type { Transaction, FinancialGoal } from "@shared/schema";

const PAYMENT_METHODS = [
  { value: "debit", label: "Débito", icon: CreditCard },
  { value: "credit", label: "Crédito", icon: CreditCard },
  { value: "pix", label: "Pix", icon: Smartphone },
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "other", label: "Outro", icon: Wallet },
] as const;

type PaymentMethodValue = typeof PAYMENT_METHODS[number]["value"];

function paymentLabel(method: string | null | undefined): string {
  if (!method) return "";
  const found = PAYMENT_METHODS.find(m => m.value === method);
  return found ? found.label : method;
}

export default function Finance() {
  const [activeTab, setActiveTab] = useState<"transactions" | "bills">("transactions");
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [txForm, setTxForm] = useState({
    amount: "",
    description: "",
    type: "expense",
    categoryName: "",
    paymentMethod: "" as PaymentMethodValue | "",
    paymentMethodOther: "",
  });
  const [goalForm, setGoalForm] = useState({ title: "", targetAmount: "" });
  const [photoPreview, setPhotoPreview] = useState<any>(null);
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: goals = [] } = useQuery<FinancialGoal[]>({ queryKey: ["/api/goals"] });

  const resetTxForm = () => setTxForm({ amount: "", description: "", type: "expense", categoryName: "", paymentMethod: "", paymentMethodOther: "" });

  const createTxMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/transactions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowAddTx(false);
      resetTxForm();
    },
    onError: () => toast({ title: "Erro ao salvar transação", variant: "destructive" }),
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/transactions/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setShowAddGoal(false);
      setGoalForm({ title: "", targetAmount: "" });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/finance/photo", { method: "POST", body: formData, credentials: "include" });
      return res.json();
    },
    onSuccess: (data) => setPhotoPreview(data),
  });

  const confirmPhotoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/photo/confirm", photoPreview);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPhotoPreview(null);
      toast({ title: "Transações registradas" });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/finance/pdf", { method: "POST", body: formData, credentials: "include" });
      return res.json();
    },
    onSuccess: (data) => setPdfPreview(data),
  });

  const confirmPdfMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/pdf/confirm", pdfPreview);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPdfPreview(null);
      toast({ title: "Extrato importado" });
    },
  });

  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

  function handleSubmitTx(e: React.FormEvent) {
    e.preventDefault();
    if (!txForm.categoryName.trim()) {
      toast({ title: "Categoria obrigatória", description: "Informe uma categoria para classificar a transação.", variant: "destructive" });
      return;
    }
    const resolvedPayment = txForm.paymentMethod === "other" ? txForm.paymentMethodOther || "Outro" : txForm.paymentMethod;
    createTxMutation.mutate({
      amount: parseFloat(txForm.amount),
      description: txForm.description,
      type: txForm.type,
      categoryName: txForm.categoryName.trim(),
      paymentMethod: resolvedPayment || null,
    });
  }

  const PM_ICONS: Record<string, any> = { debit: CreditCard, credit: CreditCard, pix: Smartphone, cash: Banknote, other: Wallet };

  return (
    <div className="px-6 py-6 pb-28 space-y-5">
      <title>AXIS - Finanças</title>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-finance-title">Finanças</h1>
        {activeTab === "transactions" && (
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPhotoMutation.mutate(e.target.files[0]); }} />
            <input ref={pdfInputRef} type="file" accept=".pdf,.txt,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadPdfMutation.mutate(e.target.files[0]); }} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadPhotoMutation.isPending} data-testid="button-upload-photo">
              {uploadPhotoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => pdfInputRef.current?.click()} disabled={uploadPdfMutation.isPending} data-testid="button-upload-pdf">
              {uploadPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
            <Button size="sm" onClick={() => setShowAddTx(true)} data-testid="button-add-transaction">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {([
          { id: "transactions", label: "Transações", icon: DollarSign },
          { id: "bills", label: "Contas", icon: Receipt },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{
              background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
              color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.35)",
            }}
            data-testid={`tab-finance-${tab.id}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "bills" && <BillsTab />}

      {activeTab === "transactions" && <>

      <CaptureButton variant="inline" />

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border" data-testid="card-total-expenses">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive" /> Gastos</p>
            <p className="text-xl font-bold mt-1">R$ {totalExpenses.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border" data-testid="card-total-income">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> Receitas</p>
            <p className="text-xl font-bold mt-1">R$ {totalIncome.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border" data-testid="card-balance">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-xl font-bold mt-1 ${totalIncome - totalExpenses >= 0 ? "text-green-500" : "text-destructive"}`}>
              R$ {(totalIncome - totalExpenses).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2-column layout: transactions left, goals right ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* Left col (2/3): previews + transactions */}
        <div className="xl:col-span-2 space-y-4">
          {photoPreview && (
            <Card className="border-primary" data-testid="card-photo-preview">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Nota fiscal detectada</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPhotoPreview(null)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {photoPreview.establishment && <p className="text-sm"><strong>Local:</strong> {photoPreview.establishment}</p>}
                {photoPreview.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.description}</span>
                    <span>R$ {item.amount?.toFixed(2)}</span>
                  </div>
                ))}
                {photoPreview.totalAmount && <p className="text-sm font-bold border-t pt-2">Total: R$ {photoPreview.totalAmount.toFixed(2)}</p>}
                <Button onClick={() => confirmPhotoMutation.mutate()} disabled={confirmPhotoMutation.isPending} className="w-full" data-testid="button-confirm-photo">
                  {confirmPhotoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Confirmar
                </Button>
              </CardContent>
            </Card>
          )}

          {pdfPreview && (
            <Card className="border-primary" data-testid="card-pdf-preview">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Extrato detectado — {pdfPreview.transactions?.length || 0} transações</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPdfPreview(null)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 max-h-60 overflow-auto">
                {pdfPreview.transactions?.map((t: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50">
                    <span className="truncate flex-1">{t.description}</span>
                    <span className={`ml-2 ${t.type === "income" ? "text-green-500" : "text-destructive"}`}>R$ {t.amount?.toFixed(2)}</span>
                  </div>
                ))}
                <Button onClick={() => confirmPdfMutation.mutate()} disabled={confirmPdfMutation.isPending} className="w-full mt-2" data-testid="button-confirm-pdf">
                  {confirmPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Importar tudo
                </Button>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Transações recentes</h2>
            {txLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação ainda</p>
            ) : (
              <div className="space-y-1">
                {transactions.slice(0, 30).map((tx) => {
                  const pmLabel = paymentLabel((tx as any).paymentMethod);
                  const PMIcon = pmLabel ? (PM_ICONS[(tx as any).paymentMethod] || Wallet) : null;
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group" data-testid={`row-transaction-${tx.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${tx.type === "income" ? "bg-green-500" : "bg-destructive"}`} />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{tx.description}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                            <span>{tx.categoryName || "Sem categoria"}</span>
                            {tx.establishment && <><span>·</span><span>{tx.establishment}</span></>}
                            {pmLabel && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-0.5">
                                  {PMIcon && <PMIcon className="h-3 w-3" />}
                                  {pmLabel}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-medium ${tx.type === "income" ? "text-green-500" : ""}`}>
                          {tx.type === "income" ? "+" : "-"}R$ {tx.amount.toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteTxMutation.mutate(tx.id)} data-testid={`button-delete-tx-${tx.id}`}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right col (1/3): goals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Metas financeiras</h2>
            {goals.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddGoal(true)} data-testid="button-add-goal">
                <Plus className="h-3 w-3 mr-1" /> Nova meta
              </Button>
            )}
          </div>
          {goals.length > 0 ? (
            <div className="space-y-2">
              {goals.map((g) => {
                const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                return (
                  <Card key={g.id} className="border-border" data-testid={`card-goal-${g.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{g.title}</span>
                        <span className="text-muted-foreground">R$ {g.currentAmount.toFixed(0)} / {g.targetAmount.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddGoal(true)} className="w-full" data-testid="button-add-first-goal">
              <Plus className="h-4 w-4 mr-1" /> Criar primeira meta financeira
            </Button>
          )}
        </div>
      </div>

      {/* ── Dialog: Nova Transação ── */}
      <Dialog open={showAddTx} onOpenChange={(open) => { setShowAddTx(open); if (!open) resetTxForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova transação</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitTx} className="space-y-3" data-testid="form-add-transaction">

            {/* Tipo */}
            <Select value={txForm.type} onValueChange={(v) => setTxForm(p => ({ ...p, type: v }))}>
              <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Gasto</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
              </SelectContent>
            </Select>

            {/* Valor */}
            <Input
              type="number"
              step="0.01"
              placeholder="Valor"
              value={txForm.amount}
              onChange={(e) => setTxForm(p => ({ ...p, amount: e.target.value }))}
              required
              data-testid="input-tx-amount"
            />

            {/* Descrição */}
            <Input
              placeholder="Descrição"
              value={txForm.description}
              onChange={(e) => setTxForm(p => ({ ...p, description: e.target.value }))}
              required
              data-testid="input-tx-description"
            />

            {/* Categoria — OBRIGATÓRIA */}
            <div>
              <Input
                placeholder="Categoria *"
                value={txForm.categoryName}
                onChange={(e) => setTxForm(p => ({ ...p, categoryName: e.target.value }))}
                data-testid="input-tx-category"
                className={txForm.categoryName === "" && createTxMutation.isError ? "border-destructive" : ""}
              />
              <p className="text-[11px] text-muted-foreground mt-1 ml-1">Ex: Alimentação, Transporte, Saúde…</p>
            </div>

            {/* Forma de pagamento */}
            <div>
              <Select value={txForm.paymentMethod} onValueChange={(v) => setTxForm(p => ({ ...p, paymentMethod: v as PaymentMethodValue, paymentMethodOther: "" }))}>
                <SelectTrigger data-testid="select-tx-payment-method">
                  <SelectValue placeholder="Forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        <m.icon className="h-4 w-4 text-muted-foreground" />
                        {m.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo "Outro" quando selecionado */}
            {txForm.paymentMethod === "other" && (
              <Input
                placeholder="Especifique a forma de pagamento"
                value={txForm.paymentMethodOther}
                onChange={(e) => setTxForm(p => ({ ...p, paymentMethodOther: e.target.value }))}
                data-testid="input-tx-payment-other"
                autoFocus
              />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={createTxMutation.isPending}
              data-testid="button-submit-transaction"
            >
              {createTxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Meta ── */}
      <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova meta financeira</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createGoalMutation.mutate({ title: goalForm.title, targetAmount: parseFloat(goalForm.targetAmount) }); }} className="space-y-4" data-testid="form-add-goal">
            <Input placeholder="Nome da meta" value={goalForm.title} onChange={(e) => setGoalForm(p => ({ ...p, title: e.target.value }))} required data-testid="input-goal-title" />
            <Input type="number" step="0.01" placeholder="Valor alvo (R$)" value={goalForm.targetAmount} onChange={(e) => setGoalForm(p => ({ ...p, targetAmount: e.target.value }))} required data-testid="input-goal-amount" />
            <Button type="submit" className="w-full" disabled={createGoalMutation.isPending} data-testid="button-submit-goal">
              {createGoalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Criar meta
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      </>}
    </div>
  );
}

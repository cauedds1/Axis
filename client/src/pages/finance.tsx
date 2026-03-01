import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Trash2, Upload, Camera, TrendingUp, TrendingDown, Loader2, X, Check, CreditCard, Smartphone, Banknote, Wallet, Receipt, PlusCircle, Calendar, CalendarDays, Clock, MapPin, Tag, Store, ArrowDownCircle, ArrowUpCircle, MessageCircle, Mic, FileText, Image, Hash, Package, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CaptureButton } from "@/components/capture-button";
import { BillsTab } from "@/components/bills-tab";
import { ManageBillsSheet } from "@/components/manage-bills-sheet";
import type { Transaction, FinancialGoal } from "@shared/schema";

const PAYMENT_METHODS = [
  { value: "debit", label: "Débito", icon: CreditCard },
  { value: "credit", label: "Crédito", icon: CreditCard },
  { value: "pix", label: "Pix", icon: Smartphone },
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "other", label: "Outro", icon: Wallet },
] as const;

type PaymentMethodValue = typeof PAYMENT_METHODS[number]["value"];

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paymentLabel(method: string | null | undefined): string {
  if (!method) return "";
  const found = PAYMENT_METHODS.find(m => m.value === method);
  return found ? found.label : method;
}

type TxPeriodFilter = "current" | "last" | "last3" | "last6" | "custom";

const TX_PERIOD_OPTS: { id: TxPeriodFilter; label: string }[] = [
  { id: "current", label: "Mês atual" },
  { id: "last", label: "Mês passado" },
  { id: "last3", label: "3 meses" },
  { id: "last6", label: "6 meses" },
  { id: "custom", label: "Personalizado" },
];

function getTxDateRange(period: TxPeriodFilter, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  if (period === "current") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
  if (period === "last") {
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
  }
  if (period === "last3") {
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
  if (period === "last6") {
    return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
  if (period === "custom" && customStart && customEnd) {
    return { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
}

function getTxPeriodLabel(period: TxPeriodFilter, range: { start: Date; end: Date }): string {
  if (period === "current" || period === "last") {
    return range.start.toLocaleString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  const f = range.start.toLocaleString("pt-BR", { month: "short", year: "numeric" });
  const l = range.end.toLocaleString("pt-BR", { month: "short", year: "numeric" });
  return `${f} — ${l}`;
}

export default function Finance() {
  const [activeTab, setActiveTab] = useState<"transactions" | "bills">("transactions");
  const [showManageBills, setShowManageBills] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [expandedItemsTxId, setExpandedItemsTxId] = useState<string | null>(null);
  const [showDetailItems, setShowDetailItems] = useState(false);
  const [txPeriod, setTxPeriod] = useState<TxPeriodFilter>("current");
  const [txShowCustom, setTxShowCustom] = useState(false);
  const [txCustomStart, setTxCustomStart] = useState("");
  const [txCustomEnd, setTxCustomEnd] = useState("");
  const [txForm, setTxForm] = useState({
    amount: "",
    description: "",
    type: "expense",
    categoryName: "",
    paymentMethod: "" as PaymentMethodValue | "",
    paymentMethodOther: "",
  });
  const [goalForm, setGoalForm] = useState({ title: "", targetAmount: "" });
  const [photoResults, setPhotoResults] = useState<any[] | null>(null);
  const [expandedReceiptIdx, setExpandedReceiptIdx] = useState<number | null>(null);
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const [billForm, setBillForm] = useState({ title: "", amount: "", type: "expense", dueDay: "", recurrenceType: "this_month", categoryName: "", notes: "" });
  const [identityNeeded, setIdentityNeeded] = useState(false);
  const [identityChoice, setIdentityChoice] = useState<string | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: goals = [] } = useQuery<FinancialGoal[]>({ queryKey: ["/api/goals"] });
  const { data: profileData } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const initialBalance: number = profileData?.profile?.initialBalance ?? 0;

  const setInitialBalanceMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest("POST", "/api/user/initial-balance", { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowBalanceDialog(false);
      setBalanceInput("");
      toast({ title: "Saldo atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar saldo", variant: "destructive" }),
  });

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
    onSuccess: (data: { count: number; receipts: any[] }) => {
      const receipts = data.receipts?.filter((r: any) => r.totalAmount) ?? [];
      if (receipts.length === 0) {
        toast({ title: "Nenhum comprovante identificado", description: "Tente uma foto mais nítida.", variant: "destructive" });
      } else {
        setPhotoResults(receipts);
        setExpandedReceiptIdx(receipts.length === 1 ? 0 : null);
      }
    },
  });

  const confirmPhotoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/finance/photo/confirm", { receipts: photoResults });
      return res.json();
    },
    onSuccess: (data: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPhotoResults(null);
      setExpandedReceiptIdx(null);
      const count = Array.isArray(data) ? data.length : 1;
      toast({ title: count > 1 ? `${count} comprovantes registrados` : "Comprovante registrado" });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/finance/pdf", { method: "POST", body: formData, credentials: "include" });
      return res.json();
    },
    onSuccess: async (data) => {
      setPdfPreview(data);
      setIdentityNeeded(false);
      setIdentityChoice(null);
      if (data?.docType === "bill") {
        const notesParts: string[] = [];
        if (data.description) notesParts.push(`Descrição: ${data.description}`);
        if (data.issuer) notesParts.push(`Emissor: ${data.issuer}${data.issuerCnpj ? ` (${data.issuerCnpj})` : ""}`);
        if (data.recipient) notesParts.push(`Destinatário: ${data.recipient}${data.recipientCnpj ? ` (${data.recipientCnpj})` : ""}`);
        if (data.paymentInfo) notesParts.push(`Pagamento: ${data.paymentInfo}`);

        let resolvedType = data.type || "expense";
        let needsIdentity = false;

        if (data.issuerCnpj && data.recipientCnpj) {
          try {
            const idRes = await fetch("/api/user/identity", { credentials: "include" });
            const idData = await idRes.json();
            const entities: Array<{ name: string; cnpj: string }> = idData.entities || [];
            const normCnpj = (c: string) => (c || "").replace(/[^0-9]/g, "");
            const issuerNorm = normCnpj(data.issuerCnpj);
            const recipientNorm = normCnpj(data.recipientCnpj);
            const match = entities.find(e => {
              const n = normCnpj(e.cnpj);
              return (issuerNorm && n === issuerNorm) || (recipientNorm && n === recipientNorm);
            });
            if (match) {
              resolvedType = normCnpj(match.cnpj) === issuerNorm ? "income" : "expense";
            } else {
              needsIdentity = true;
            }
          } catch {}
        }

        setIdentityNeeded(needsIdentity);
        setBillForm({
          title: data.title || "",
          amount: data.amount != null ? String(data.amount) : "",
          type: resolvedType,
          dueDay: data.dueDay != null ? String(data.dueDay) : "",
          recurrenceType: "this_month",
          categoryName: data.categoryName || "",
          notes: notesParts.join("\n"),
        });
      }
    },
  });

  const confirmPdfMutation = useMutation({
    mutationFn: async (payload?: any) => {
      const body = payload || pdfPreview;
      const res = await apiRequest("POST", "/api/finance/pdf/confirm", body);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const docType = variables?.docType || pdfPreview?.docType;
      if (docType === "bill") {
        queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        setPdfPreview(null);
        setBillForm({ title: "", amount: "", type: "expense", dueDay: "", recurrenceType: "this_month", categoryName: "", notes: "" });
        toast({ title: "Conta registrada" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        setPdfPreview(null);
        toast({ title: "Extrato importado" });
      }
    },
  });

  const txDateRange = getTxDateRange(txPeriod, txCustomStart, txCustomEnd);
  const filteredTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= txDateRange.start && d <= txDateRange.end;
  });
  const totalExpenses = filteredTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalIncome = filteredTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const allExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const allIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

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
        <div className="flex gap-2">
          {activeTab === "transactions" && (<>
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
          </>)}
          <Button variant="outline" size="sm" onClick={() => setShowManageBills(true)} data-testid="button-manage-bills">
            <Settings2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Contas Fixas</span>
          </Button>
        </div>
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

      {/* Period filter */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {TX_PERIOD_OPTS.map(opt => {
            const isActive = txPeriod === opt.id;
            return (
              <button
                key={opt.id}
                data-testid={`filter-tx-period-${opt.id}`}
                onClick={() => {
                  setTxPeriod(opt.id);
                  setTxShowCustom(opt.id === "custom");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200"
                style={isActive
                  ? { background: "rgba(0,230,255,0.09)", color: "#00E6FF", borderColor: "rgba(0,230,255,0.25)" }
                  : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.07)" }
                }
              >
                <CalendarDays className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
        {txShowCustom && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
            <span className="text-xs text-white/40 font-medium">De</span>
            <input
              type="date"
              data-testid="input-tx-custom-start"
              value={txCustomStart}
              onChange={e => setTxCustomStart(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
            <span className="text-xs text-white/40 font-medium">até</span>
            <input
              type="date"
              data-testid="input-tx-custom-end"
              value={txCustomEnd}
              onChange={e => setTxCustomEnd(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        )}
        <p className="text-xs text-white/35">{getTxPeriodLabel(txPeriod, txDateRange)}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border" data-testid="card-total-expenses">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive" /> Gastos</p>
            <p className="text-xl font-bold mt-1">R$ {fmtBRL(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="border-border" data-testid="card-total-income">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> Receitas</p>
            <p className="text-xl font-bold mt-1">R$ {fmtBRL(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-border relative" data-testid="card-balance">
          <CardContent className="pt-4 pb-10">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-xl font-bold mt-1 ${initialBalance + allIncome - allExpenses >= 0 ? "text-green-500" : "text-destructive"}`}>
              R$ {fmtBRL(initialBalance + allIncome - allExpenses)}
            </p>
          </CardContent>
          <button
            onClick={() => { setBalanceInput(initialBalance > 0 ? String(initialBalance) : ""); setShowBalanceDialog(true); }}
            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 rounded-md px-2 py-1 transition-colors"
            data-testid="button-add-balance"
          >
            <PlusCircle className="h-3 w-3" />
            Adicionar saldo
          </button>
        </Card>
      </div>

      {/* ── 2-column layout: transactions left, goals right ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* Left col (2/3): previews + transactions */}
        <div className="xl:col-span-2 space-y-4">
          {photoResults && photoResults.length > 0 && (
            <Card className="border-primary" data-testid="card-photo-preview">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {photoResults.length === 1
                      ? "Comprovante detectado"
                      : `${photoResults.length} comprovantes detectados`}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setPhotoResults(null); setExpandedReceiptIdx(null); }}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {photoResults.map((r: any, idx: number) => {
                  const isExpanded = expandedReceiptIdx === idx || photoResults.length === 1;
                  const label = r.establishment || r.description || `Comprovante ${idx + 1}`;
                  const typeColor = r.transactionType === "income" ? "text-green-500" : "text-destructive";
                  return (
                    <div key={idx} className="rounded-lg border border-border/60 overflow-hidden" data-testid={`card-receipt-${idx}`}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedReceiptIdx(isExpanded && photoResults.length > 1 ? null : idx)}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${typeColor}`} />
                          <span className="truncate font-medium">{label}</span>
                          {r.categoryName && <span className="text-xs text-muted-foreground hidden sm:inline">· {r.categoryName}</span>}
                        </span>
                        <span className={`ml-2 font-bold flex-shrink-0 flex items-center gap-1 ${typeColor}`}>
                          R$ {fmtBRL(r.totalAmount ?? 0)}
                          {photoResults.length > 1 && (isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-1 border-t border-border/40 pt-2">
                          {r.date && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(r.date).toLocaleDateString("pt-BR")}{r.time ? ` às ${r.time}` : ""}</p>}
                          {r.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.location}</p>}
                          {r.paymentMethod && <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> {r.paymentMethod}</p>}
                          {r.items && r.items.length > 1 && (
                            <div className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                              {r.items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs py-0.5">
                                  <span className="truncate">{item.description}</span>
                                  <span className="ml-2 flex-shrink-0">R$ {fmtBRL(item.amount ?? 0)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button onClick={() => confirmPhotoMutation.mutate()} disabled={confirmPhotoMutation.isPending} className="w-full" data-testid="button-confirm-photo">
                  {confirmPhotoMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <Check className="h-4 w-4 mr-2" />}
                  {photoResults.length > 1 ? `Confirmar todos (${photoResults.length})` : "Confirmar"}
                </Button>
              </CardContent>
            </Card>
          )}

          {pdfPreview && pdfPreview.docType === "bill" && (
            <Card className="border-primary" data-testid="card-bill-preview">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Conta detectada
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setPdfPreview(null)} data-testid="button-close-bill-preview"><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(pdfPreview.issuer || pdfPreview.recipient || pdfPreview.description) && (
                  <div className="rounded-lg border p-3 space-y-1.5 text-sm bg-muted/30" data-testid="bill-info-summary">
                    {pdfPreview.issuer && (
                      <div className="flex gap-2" data-testid="text-bill-issuer">
                        <Store className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">Emissor</span>
                          <p className="font-medium">{pdfPreview.issuer}{pdfPreview.issuerCnpj ? <span className="text-muted-foreground font-normal"> ({pdfPreview.issuerCnpj})</span> : ""}</p>
                        </div>
                      </div>
                    )}
                    {pdfPreview.recipient && (
                      <div className="flex gap-2" data-testid="text-bill-recipient">
                        <ArrowDownCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">Destinatário</span>
                          <p className="font-medium">{pdfPreview.recipient}{pdfPreview.recipientCnpj ? <span className="text-muted-foreground font-normal"> ({pdfPreview.recipientCnpj})</span> : ""}</p>
                        </div>
                      </div>
                    )}
                    {pdfPreview.description && (
                      <div className="flex gap-2" data-testid="text-bill-description">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">Serviço/Produto</span>
                          <p>{pdfPreview.description}</p>
                        </div>
                      </div>
                    )}
                    {pdfPreview.paymentInfo && (
                      <div className="flex gap-2" data-testid="text-bill-payment">
                        <CreditCard className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">Dados de pagamento</span>
                          <p>{pdfPreview.paymentInfo}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {identityNeeded && pdfPreview.issuerCnpj && pdfPreview.recipientCnpj && (
                  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2" data-testid="identity-picker">
                    <p className="text-sm font-medium">Quem é você nessa nota?</p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        className={`flex items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors ${identityChoice === "issuer" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                        onClick={() => {
                          setIdentityChoice("issuer");
                          setBillForm(p => ({ ...p, type: "income" }));
                        }}
                        data-testid="button-identity-issuer"
                      >
                        <Store className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{pdfPreview.issuer || "Emissor"}</p>
                          <p className="text-xs text-muted-foreground">{pdfPreview.issuerCnpj}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`flex items-start gap-2 rounded-md border p-2 text-left text-sm transition-colors ${identityChoice === "recipient" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                        onClick={() => {
                          setIdentityChoice("recipient");
                          setBillForm(p => ({ ...p, type: "expense" }));
                        }}
                        data-testid="button-identity-recipient"
                      >
                        <ArrowDownCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">{pdfPreview.recipient || "Destinatário"}</p>
                          <p className="text-xs text-muted-foreground">{pdfPreview.recipientCnpj}</p>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Vou lembrar sua escolha para as próximas notas.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                    <Input
                      value={billForm.title}
                      onChange={(e) => setBillForm(p => ({ ...p, title: e.target.value }))}
                      data-testid="input-bill-title"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={billForm.amount}
                      onChange={(e) => setBillForm(p => ({ ...p, amount: e.target.value }))}
                      data-testid="input-bill-amount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                    <Select value={billForm.type} onValueChange={(v) => setBillForm(p => ({ ...p, type: v }))}>
                      <SelectTrigger data-testid="select-bill-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">A Pagar</SelectItem>
                        <SelectItem value="income">A Receber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Vencimento (dia)</label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={billForm.dueDay}
                      onChange={(e) => setBillForm(p => ({ ...p, dueDay: e.target.value }))}
                      data-testid="input-bill-due-day"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Recorrência</label>
                    <Select value={billForm.recurrenceType} onValueChange={(v) => setBillForm(p => ({ ...p, recurrenceType: v }))}>
                      <SelectTrigger data-testid="select-bill-recurrence"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this_month">Este mês</SelectItem>
                        <SelectItem value="permanent">Permanente</SelectItem>
                        <SelectItem value="three_months">3 meses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Observações</label>
                  <Textarea
                    value={billForm.notes}
                    onChange={(e) => setBillForm(p => ({ ...p, notes: e.target.value }))}
                    className="resize-none text-sm"
                    rows={4}
                    data-testid="textarea-bill-notes"
                  />
                </div>
                <Button
                  onClick={() => {
                    const payload: any = {
                      docType: "bill",
                      title: billForm.title,
                      amount: parseFloat(billForm.amount) || 0,
                      type: billForm.type,
                      dueDay: parseInt(billForm.dueDay) || 1,
                      recurrenceType: billForm.recurrenceType,
                      categoryName: billForm.categoryName || pdfPreview.categoryName || "outros",
                      notes: billForm.notes,
                    };
                    if (identityNeeded && identityChoice) {
                      payload.identityName = identityChoice === "issuer" ? pdfPreview.issuer : pdfPreview.recipient;
                      payload.identityCnpj = identityChoice === "issuer" ? pdfPreview.issuerCnpj : pdfPreview.recipientCnpj;
                    }
                    confirmPdfMutation.mutate(payload);
                  }}
                  disabled={confirmPdfMutation.isPending || (identityNeeded && !identityChoice)}
                  className="w-full"
                  data-testid="button-confirm-bill"
                >
                  {confirmPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Registrar Conta
                </Button>
              </CardContent>
            </Card>
          )}

          {pdfPreview && pdfPreview.docType !== "bill" && (
            <Card className="border-primary" data-testid="card-pdf-preview">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Extrato detectado — {pdfPreview.transactions?.length || 0} transações</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setPdfPreview(null)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 max-h-60 overflow-auto">
                {pdfPreview.transactions?.map((t: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50">
                    <span className="truncate flex-1">{t.description}</span>
                    <span className={`ml-2 ${t.type === "income" ? "text-green-500" : "text-destructive"}`}>R$ {fmtBRL(t.amount ?? 0)}</span>
                  </div>
                ))}
                <Button onClick={() => confirmPdfMutation.mutate(pdfPreview)} disabled={confirmPdfMutation.isPending} className="w-full mt-2" data-testid="button-confirm-pdf">
                  {confirmPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Importar tudo
                </Button>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Transações recentes</h2>
            {txLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredTx.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação neste período</p>
            ) : (
              <div className="space-y-1">
                {filteredTx.slice(0, 50).map((tx) => {
                  const pmLabel = paymentLabel((tx as any).paymentMethod);
                  const PMIcon = pmLabel ? (PM_ICONS[(tx as any).paymentMethod] || Wallet) : null;
                  const rawItems = (tx as any).receiptItems;
                  const parsedItems: { description: string; amount: number }[] | null = (() => {
                    if (!rawItems) return null;
                    try { const arr = JSON.parse(rawItems); return Array.isArray(arr) && arr.length > 0 ? arr : null; } catch { return null; }
                  })();
                  const isExpanded = expandedItemsTxId === tx.id;
                  return (
                    <div key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group cursor-pointer" onClick={() => { setShowDetailItems(false); setSelectedTx(tx); }}>
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
                              {parsedItems && (
                                <>
                                  <span>·</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedItemsTxId(isExpanded ? null : tx.id); }}
                                    className="flex items-center gap-0.5 text-xs font-medium hover:text-foreground transition-colors"
                                    style={{ color: "rgba(0,230,255,0.7)" }}
                                    data-testid={`button-items-${tx.id}`}
                                  >
                                    <Package className="h-2.5 w-2.5" />
                                    {parsedItems.length} {parsedItems.length === 1 ? "item" : "itens"}
                                    {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-medium ${tx.type === "income" ? "text-green-500" : ""}`}>
                            {tx.type === "income" ? "+" : "-"}R$ {fmtBRL(tx.amount)}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setTxToDelete(tx.id); }} data-testid={`button-delete-tx-${tx.id}`}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {isExpanded && parsedItems && (
                        <div className="mx-3 mb-1 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {parsedItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderBottom: idx < parsedItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                              <span className="text-white/70 truncate mr-3">{item.description}</span>
                              <span className="font-medium text-white/90 shrink-0">R$ {fmtBRL(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
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

      {/* ── Dialog: Adicionar Saldo ── */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initialBalance > 0 ? "Atualizar saldo" : "Adicionar saldo inicial"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {initialBalance > 0
              ? "Informe o valor total que você tem agora. O sistema vai controlar tudo que entra e sai a partir desse valor."
              : "Informe quanto dinheiro você tem hoje — salário, poupança, tudo junto. O sistema trabalha em cima desse saldo."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = parseFloat(balanceInput.replace(",", "."));
              if (isNaN(val) || val < 0) {
                toast({ title: "Informe um valor válido", variant: "destructive" });
                return;
              }
              setInitialBalanceMutation.mutate(val);
            }}
            className="space-y-4"
            data-testid="form-initial-balance"
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                className="pl-9"
                autoFocus
                data-testid="input-initial-balance"
              />
            </div>
            <Button type="submit" className="w-full" disabled={setInitialBalanceMutation.isPending} data-testid="button-submit-balance">
              {setInitialBalanceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {initialBalance > 0 ? "Atualizar saldo" : "Definir saldo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      {selectedTx && (() => {
        const tx = selectedTx as any;
        const txDate = tx.date ? new Date(tx.date) : null;
        const hasTime = txDate && (txDate.getHours() !== 0 || txDate.getMinutes() !== 0);
        const dateStr = txDate
          ? txDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
          : null;
        const timeStr = hasTime
          ? txDate!.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : null;
        const pmLabel = paymentLabel(tx.paymentMethod);
        const PMIcon = pmLabel ? (PM_ICONS[tx.paymentMethod] || Wallet) : null;
        const SOURCE_LABELS: Record<string, { label: string; Icon: any }> = {
          manual: { label: "Cadastro manual", Icon: Hash },
          voice: { label: "Voz", Icon: Mic },
          text: { label: "Texto", Icon: FileText },
          photo: { label: "Foto / comprovante", Icon: Image },
          whatsapp: { label: "WhatsApp", Icon: MessageCircle },
          pdf: { label: "PDF / extrato", Icon: FileText },
        };
        const srcInfo = SOURCE_LABELS[tx.source] ?? null;
        const isIncome = tx.type === "income";

        return (
          <Dialog open onOpenChange={() => setSelectedTx(null)}>
            <DialogContent className="max-w-sm" data-testid="dialog-tx-detail">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold leading-snug pr-6">{tx.description}</DialogTitle>
              </DialogHeader>

              {/* Amount */}
              <div className={`text-3xl font-bold ${isIncome ? "text-green-500" : "text-destructive"}`}>
                {isIncome ? "+" : "-"}R$ {fmtBRL(tx.amount)}
              </div>

              <div className="space-y-3 pt-1">
                {/* Type */}
                <div className="flex items-center gap-2.5 text-sm">
                  {isIncome
                    ? <ArrowDownCircle className="h-4 w-4 text-green-500 shrink-0" />
                    : <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="ml-auto font-medium">{isIncome ? "Receita" : "Despesa"}</span>
                </div>

                {/* Category */}
                {tx.categoryName && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Categoria</span>
                    <span className="ml-auto font-medium capitalize">{tx.categoryName}</span>
                  </div>
                )}

                {/* Establishment */}
                {tx.establishment && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{isIncome ? "Remetente" : "Destinatário"}</span>
                    <span className="ml-auto font-medium text-right max-w-[55%] leading-tight">{tx.establishment}</span>
                  </div>
                )}

                {/* Date */}
                {dateStr && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Data</span>
                    <span className="ml-auto font-medium text-right max-w-[60%] leading-tight capitalize">{dateStr}</span>
                  </div>
                )}

                {/* Time */}
                {timeStr && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Horário</span>
                    <span className="ml-auto font-medium">{timeStr}</span>
                  </div>
                )}

                {/* Payment method */}
                {pmLabel && (
                  <div className="flex items-center gap-2.5 text-sm">
                    {PMIcon ? <PMIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="text-muted-foreground">Pagamento</span>
                    <span className="ml-auto font-medium">{pmLabel}</span>
                  </div>
                )}

                {/* Location */}
                {tx.location && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Local</span>
                    <span className="ml-auto font-medium text-right max-w-[55%] leading-tight">{tx.location}</span>
                  </div>
                )}

                {/* Source */}
                {srcInfo && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <srcInfo.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Origem</span>
                    <span className="ml-auto font-medium">{srcInfo.label}</span>
                  </div>
                )}

                {/* Receipt items */}
                {(() => {
                  const rawItems = tx.receiptItems;
                  if (!rawItems) return null;
                  let items: { description: string; amount: number }[] = [];
                  try { const arr = JSON.parse(rawItems); if (Array.isArray(arr) && arr.length > 0) items = arr; } catch { return null; }
                  if (items.length === 0) return null;
                  return (
                    <div>
                      <button
                        onClick={() => setShowDetailItems(v => !v)}
                        className="flex items-center justify-between w-full text-sm py-0.5"
                        data-testid="button-toggle-receipt-items"
                      >
                        <span className="flex items-center gap-2.5">
                          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Itens</span>
                        </span>
                        <span className="flex items-center gap-1 font-medium" style={{ color: "rgba(0,230,255,0.8)" }}>
                          {items.length} {items.length === 1 ? "item" : "itens"}
                          {showDetailItems ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                      {showDetailItems && (
                        <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                              <span className="text-white/70 truncate mr-3">{item.description}</span>
                              <span className="font-medium text-white/90 shrink-0">R$ {fmtBRL(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-2"
                onClick={() => setTxToDelete(tx.id)}
                data-testid="button-delete-tx-detail"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Excluir transação
              </Button>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AlertDialog open={!!txToDelete} onOpenChange={(o) => { if (!o) setTxToDelete(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-delete-tx">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A transação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-tx">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (txToDelete) {
                  deleteTxMutation.mutate(txToDelete);
                  setTxToDelete(null);
                  setSelectedTx(null);
                }
              }}
              data-testid="button-confirm-delete-tx"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManageBillsSheet open={showManageBills} onClose={() => setShowManageBills(false)} />
    </div>
  );
}

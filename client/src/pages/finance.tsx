import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/use-currency";
import { DollarSign, Plus, Trash2, Upload, Camera, TrendingUp, TrendingDown, Loader2, X, Check, CreditCard, Smartphone, Banknote, Wallet, Receipt, PlusCircle, Calendar, CalendarDays, Clock, MapPin, Tag, Store, ArrowDownCircle, ArrowUpCircle, MessageCircle, Mic, FileText, Image, Hash, Package, ChevronDown, ChevronUp, Settings2, Pencil, Minus, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatTxDescription } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CaptureButton } from "@/components/capture-button";
import { BillsTab } from "@/components/bills-tab";
import { ManageBillsSheet } from "@/components/manage-bills-sheet";
import { CreditCardsTab } from "@/components/credit-cards-tab";
import { EditTransactionDialog } from "@/components/edit-transaction-dialog";
import { useTheme, getPrimaryHex } from "@/components/theme-provider";
import type { Transaction, FinancialGoal } from "@shared/schema";

const PAYMENT_METHOD_VALUES = ["debit","credit","pix","cash","other"] as const;
type PaymentMethodValue = typeof PAYMENT_METHOD_VALUES[number];

function fmtTxDate(date: Date | string | null | undefined, lang = "en-US"): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = d.toLocaleString(lang, { month: "short" }).replace(".", "");
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (hasTime) {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month} · ${h}:${m}`;
  }
  return `${day} ${month}`;
}

type TxPeriodFilter = "current" | "last" | "last3" | "last6" | "custom";

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

function getTxPeriodLabel(period: TxPeriodFilter, range: { start: Date; end: Date }, lang = "en-US"): string {
  if (period === "current" || period === "last") {
    return range.start.toLocaleString(lang, { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  const f = range.start.toLocaleString(lang, { month: "short", year: "numeric" });
  const l = range.end.toLocaleString(lang, { month: "short", year: "numeric" });
  return `${f} — ${l}`;
}

export default function Finance() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const { fmtMoney, symbol } = useCurrency();
  const { theme } = useTheme();
  const accent = getPrimaryHex(theme);

  const PAYMENT_METHODS = [
    { value: "debit",   label: t("axisFinance.pmDebit"),  icon: CreditCard },
    { value: "credit",  label: t("axisFinance.pmCredit"), icon: CreditCard },
    { value: "pix",     label: t("axisFinance.pmPix"),    icon: Smartphone },
    { value: "cash",    label: t("axisFinance.pmCash"),   icon: Banknote },
    { value: "other",   label: t("axisFinance.pmOther"),  icon: Wallet },
  ] as const;

  const PAYMENT_LABEL_MAP: Record<string, string> = {
    debit: t("axisFinance.pmDebit"),
    credit: t("axisFinance.pmCredit"),
    pix: t("axisFinance.pmPix"),
    cash: t("axisFinance.pmCash"),
    other: t("axisFinance.pmOther"),
  };

  function paymentLabel(method: string | null | undefined): string {
    if (!method) return "";
    return PAYMENT_LABEL_MAP[method] || method;
  }

  const TX_PERIOD_OPTS: { id: TxPeriodFilter; label: string }[] = [
    { id: "current", label: t("axisFinance.periodCurrent") },
    { id: "last",    label: t("axisFinance.periodLast") },
    { id: "last3",   label: t("axisFinance.period3m") },
    { id: "last6",   label: t("axisFinance.period6m") },
    { id: "custom",  label: t("axisFinance.periodCustom") },
  ];
  const [activeTab, setActiveTab] = useState<"transactions" | "bills" | "cards">("transactions");
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
    creditCardId: "",
    installments: "1",
  });
  const [goalForm, setGoalForm] = useState({ title: "", emoji: "💰", description: "", targetAmount: "", currentAmount: "" });
  const [showDepositGoal, setShowDepositGoal] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [showWithdrawGoal, setShowWithdrawGoal] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ title: "", emoji: "💰", description: "", targetAmount: "", currentAmount: "" });
  const [showGoalHistory, setShowGoalHistory] = useState<string | null>(null);
  const [historyEditId, setHistoryEditId] = useState<string | null>(null);
  const [historyEditAmount, setHistoryEditAmount] = useState("");
  const [historyEditDate, setHistoryEditDate] = useState("");
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
  const [editingTx, setEditingTx] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: goals = [] } = useQuery<FinancialGoal[]>({ queryKey: ["/api/goals"] });
  const { data: profileData } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  const { data: creditCards = [] } = useQuery<any[]>({ queryKey: ["/api/credit-cards"] });
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
      toast({ title: t("axisFinance.balanceUpdated") });
    },
    onError: () => toast({ title: t("axisFinance.balanceError"), variant: "destructive" }),
  });

  const resetTxForm = () => setTxForm({ amount: "", description: "", type: "expense", categoryName: "", paymentMethod: "", paymentMethodOther: "", creditCardId: "", installments: "1" });

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
    onError: () => toast({ title: t("axisFinance.txSaveError"), variant: "destructive" }),
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
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowAddGoal(false);
      setGoalForm({ title: "", emoji: "💰", description: "", targetAmount: "", currentAmount: "" });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await apiRequest("POST", `/api/goals/${id}/deposit`, { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowDepositGoal(null);
      setDepositAmount("");
      toast({ title: t("axisFinance.depositDone"), description: t("axisFinance.depositDoneDesc") });
    },
    onError: () => toast({ title: t("axisFinance.depositError"), variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await apiRequest("POST", `/api/goals/${id}/withdraw`, { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowWithdrawGoal(null);
      setWithdrawAmount("");
      toast({ title: t("axisFinance.withdrawDone"), description: t("axisFinance.withdrawDoneDesc") });
    },
    onError: (e: any) => toast({ title: e?.message || t("axisFinance.withdrawError"), variant: "destructive" }),
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/goals/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setEditingGoal(null);
      toast({ title: t("axisFinance.goalUpdated") });
    },
    onError: () => toast({ title: t("axisFinance.goalUpdateError"), variant: "destructive" }),
  });

  const editHistoryMutation = useMutation({
    mutationFn: async ({ goalId, txId, amount, date }: { goalId: string; txId: string; amount: number; date?: string }) => {
      const res = await apiRequest("PATCH", `/api/goals/${goalId}/history/${txId}`, { amount, date });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals", vars.goalId, "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setHistoryEditId(null);
      toast({ title: t("axisFinance.historyEntryUpdated") });
    },
    onError: () => toast({ title: t("axisFinance.historyUpdateError"), variant: "destructive" }),
  });

  const { data: goalHistory = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/goals", showGoalHistory, "history"],
    enabled: !!showGoalHistory,
  });

  const totalGuardado = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/goals/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] }),
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/finance/photo", { method: "POST", body: formData, credentials: "include" });
      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        if (body?.limitReached) {
          window.dispatchEvent(new CustomEvent("axis:limit-reached", { detail: body }));
          throw new Error("__limit_reached__");
        }
      }
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      return res.json();
    },
    onSuccess: (data: { count: number; receipts: any[] }) => {
      const receipts = data.receipts?.filter((r: any) => r.totalAmount) ?? [];
      if (receipts.length === 0) {
        toast({ title: t("axisFinance.photoNoReceipt"), description: t("axisFinance.photoNoReceiptDesc"), variant: "destructive" });
      } else {
        setPhotoResults(receipts);
        setExpandedReceiptIdx(receipts.length === 1 ? 0 : null);
      }
    },
    onError: (error: Error) => {
      if (error.message === "__limit_reached__") return;
      toast({ title: t("axisFinance.photoNoReceipt"), variant: "destructive" });
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
      toast({ title: count > 1 ? t("axisFinance.receiptsConfirmed", { count }) : t("axisFinance.receiptConfirmed") });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/finance/pdf", { method: "POST", body: formData, credentials: "include" });
      if (res.status === 402) {
        const body = await res.json().catch(() => ({}));
        if (body?.limitReached) {
          window.dispatchEvent(new CustomEvent("axis:limit-reached", { detail: body }));
          throw new Error("__limit_reached__");
        }
      }
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      return res.json();
    },
    onSuccess: async (data) => {
      setPdfPreview(data);
      setIdentityNeeded(false);
      setIdentityChoice(null);
      if (data?.docType === "bill") {
        const notesParts: string[] = [];
        if (data.description) notesParts.push(`${t("axisFinance.serviceProduct")}: ${data.description}`);
        if (data.issuer) notesParts.push(`${t("axisFinance.issuer")}: ${data.issuer}${data.issuerCnpj ? ` (${data.issuerCnpj})` : ""}`);
        if (data.recipient) notesParts.push(`${t("axisFinance.recipient")}: ${data.recipient}${data.recipientCnpj ? ` (${data.recipientCnpj})` : ""}`);
        if (data.paymentInfo) notesParts.push(`${t("axisFinance.paymentData")}: ${data.paymentInfo}`);

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
        toast({ title: t("axisFinance.billRegistered") });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        setPdfPreview(null);
        toast({ title: t("axisFinance.statementImported") });
      }
    },
  });

  const txDateRange = getTxDateRange(txPeriod, txCustomStart, txCustomEnd);
  const filteredTx = transactions.filter(tx => {
    const d = new Date(tx.date!);
    return d >= txDateRange.start && d <= txDateRange.end;
  }).sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());
  const totalExpenses = filteredTx.filter(tx => tx.type === "expense" && !(tx as any).creditCardId).reduce((s, tx) => s + tx.amount, 0);
  const totalIncome = filteredTx.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
  const totalCardExpenses = filteredTx.filter(tx => tx.type === "expense" && !!(tx as any).creditCardId).reduce((s, tx) => s + tx.amount, 0);
  const today = new Date();
  const pastTransactions = transactions.filter(tx => tx.date && new Date(tx.date) <= today);
  const allExpenses = pastTransactions.filter(tx => tx.type === "expense" && !(tx as any).creditCardId).reduce((s, tx) => s + tx.amount, 0);
  const allIncome = pastTransactions.filter(tx => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);

  function handleSubmitTx(e: React.FormEvent) {
    e.preventDefault();
    if (!txForm.categoryName.trim()) {
      toast({ title: t("axisFinance.categoryRequired"), description: t("axisFinance.categoryRequiredDesc"), variant: "destructive" });
      return;
    }
    const resolvedPayment = txForm.creditCardId ? "credit_card" : (txForm.paymentMethod === "other" ? txForm.paymentMethodOther || "other" : txForm.paymentMethod);
    const installmentsNum = parseInt(txForm.installments) || 1;
    createTxMutation.mutate({
      amount: parseFloat(txForm.amount),
      description: txForm.description,
      type: txForm.type,
      categoryName: txForm.categoryName.trim(),
      paymentMethod: resolvedPayment || null,
      creditCardId: txForm.creditCardId || null,
      installments: txForm.creditCardId && installmentsNum > 1 ? installmentsNum : undefined,
    });
  }

  const PM_ICONS: Record<string, any> = { debit: CreditCard, credit: CreditCard, pix: Smartphone, cash: Banknote, other: Wallet };

  return (
    <div className="px-6 py-6 pb-28 space-y-5">
      <title>{t("axisFinance.pageTitle")}</title>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-finance-title">{t("axisFinance.title")}</h1>
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
              <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">{t("axisFinance.add")}</span>
            </Button>
          </>)}
          <Button variant="outline" size="sm" onClick={() => setShowManageBills(true)} data-testid="button-manage-bills">
            <Settings2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("axisFinance.fixedBills")}</span>
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {([
          { id: "transactions", label: t("axisFinance.tabTransactions"), icon: DollarSign },
          { id: "bills", label: t("axisFinance.tabBills"), icon: Receipt },
          { id: "cards", label: t("axisFinance.tabCards"), icon: CreditCard },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
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
      {activeTab === "cards" && <CreditCardsTab />}

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
                  ? { background: `${accent}17`, color: accent, borderColor: `${accent}40` }
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
            <span className="text-xs text-white/40 font-medium">{t("axisFinance.from")}</span>
            <input
              type="date"
              data-testid="input-tx-custom-start"
              value={txCustomStart}
              onChange={e => setTxCustomStart(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
            <span className="text-xs text-white/40 font-medium">{t("axisFinance.to")}</span>
            <input
              type="date"
              data-testid="input-tx-custom-end"
              value={txCustomEnd}
              onChange={e => setTxCustomEnd(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        )}
        <p className="text-xs text-white/35">{getTxPeriodLabel(txPeriod, txDateRange, lang)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border" data-testid="card-total-expenses">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-destructive" /> {t("axisFinance.expensesDebit")}</p>
            <p className="text-xl font-bold mt-1">{fmtMoney(totalExpenses)}</p>
            {totalCardExpenses > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> {t("axisFinance.onCard", { amount: fmtMoney(totalCardExpenses) })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border" data-testid="card-total-income">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> {t("axisFinance.income")}</p>
            <p className="text-xl font-bold mt-1">{fmtMoney(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-border relative" data-testid="card-balance">
          <CardContent className="pt-4 pb-10">
            <p className="text-xs text-muted-foreground">{t("axisFinance.balance")}</p>
            <p className={`text-xl font-bold mt-1 ${initialBalance + allIncome - allExpenses >= 0 ? "text-green-500" : "text-destructive"}`}>
              {fmtMoney(initialBalance + allIncome - allExpenses)}
            </p>
          </CardContent>
          <button
            onClick={() => { setBalanceInput(initialBalance > 0 ? String(initialBalance) : ""); setShowBalanceDialog(true); }}
            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 rounded-md px-2 py-1 transition-colors"
            data-testid="button-add-balance"
          >
            <PlusCircle className="h-3 w-3" />
            {t("axisFinance.addBalance")}
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
                      ? t("axisFinance.receiptDetected")
                      : t("axisFinance.receiptsDetected", { count: photoResults.length })}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setPhotoResults(null); setExpandedReceiptIdx(null); }}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {photoResults.map((r: any, idx: number) => {
                  const isExpanded = expandedReceiptIdx === idx || photoResults.length === 1;
                  const label = r.establishment || r.description || t("axisFinance.receiptN", { n: idx + 1 });
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
                          {fmtMoney(r.totalAmount ?? 0)}
                          {photoResults.length > 1 && (isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-1 border-t border-border/40 pt-2">
                          {r.date && <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(r.date).toLocaleDateString()}{r.time ? ` ${t("axisFinance.at")} ${r.time}` : ""}</p>}
                          {r.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.location}</p>}
                          {r.paymentMethod && <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> {r.paymentMethod}</p>}
                          {r.items && r.items.length > 1 && (
                            <div className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                              {r.items.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs py-0.5">
                                  <span className="truncate">{item.description}</span>
                                  <span className="ml-2 flex-shrink-0">{fmtMoney(item.amount ?? 0)}</span>
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
                  {photoResults.length > 1 ? t("axisFinance.confirmAll", { count: photoResults.length }) : t("axisFinance.confirm")}
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
                    {t("axisFinance.billDetected")}
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
                          <span className="text-xs text-muted-foreground">{t("axisFinance.issuer")}</span>
                          <p className="font-medium">{pdfPreview.issuer}{pdfPreview.issuerCnpj ? <span className="text-muted-foreground font-normal"> ({pdfPreview.issuerCnpj})</span> : ""}</p>
                        </div>
                      </div>
                    )}
                    {pdfPreview.recipient && (
                      <div className="flex gap-2" data-testid="text-bill-recipient">
                        <ArrowDownCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">{t("axisFinance.recipient")}</span>
                          <p className="font-medium">{pdfPreview.recipient}{pdfPreview.recipientCnpj ? <span className="text-muted-foreground font-normal"> ({pdfPreview.recipientCnpj})</span> : ""}</p>
                        </div>
                      </div>
                    )}
                    {pdfPreview.description && (
                      <div className="flex gap-2" data-testid="text-bill-description">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">{t("axisFinance.serviceProduct")}</span>
                          <p>{pdfPreview.description}</p>
                        </div>
                      </div>
                    )}
                    {pdfPreview.paymentInfo && (
                      <div className="flex gap-2" data-testid="text-bill-payment">
                        <CreditCard className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">{t("axisFinance.paymentData")}</span>
                          <p>{pdfPreview.paymentInfo}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {identityNeeded && pdfPreview.issuerCnpj && pdfPreview.recipientCnpj && (
                  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-2" data-testid="identity-picker">
                    <p className="text-sm font-medium">{t("axisFinance.whoAreYou")}</p>
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
                          <p className="font-medium">{pdfPreview.issuer || t("axisFinance.issuer")}</p>
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
                          <p className="font-medium">{pdfPreview.recipient || t("axisFinance.recipient")}</p>
                          <p className="text-xs text-muted-foreground">{pdfPreview.recipientCnpj}</p>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("axisFinance.rememberChoice")}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.titleLabel")}</label>
                    <Input
                      value={billForm.title}
                      onChange={(e) => setBillForm(p => ({ ...p, title: e.target.value }))}
                      data-testid="input-bill-title"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.amountLabel")}</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={billForm.amount}
                      onChange={(e) => setBillForm(p => ({ ...p, amount: e.target.value }))}
                      data-testid="input-bill-amount"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.typeLabel")}</label>
                    <Select value={billForm.type} onValueChange={(v) => setBillForm(p => ({ ...p, type: v }))}>
                      <SelectTrigger data-testid="select-bill-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">{t("axisFinance.toPay")}</SelectItem>
                        <SelectItem value="income">{t("axisFinance.toReceive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.dueDay")}</label>
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
                    <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.recurrence")}</label>
                    <Select value={billForm.recurrenceType} onValueChange={(v) => setBillForm(p => ({ ...p, recurrenceType: v }))}>
                      <SelectTrigger data-testid="select-bill-recurrence"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this_month">{t("axisFinance.thisMonth")}</SelectItem>
                        <SelectItem value="permanent">{t("axisFinance.permanent")}</SelectItem>
                        <SelectItem value="three_months">{t("axisFinance.threeMonths")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.notes")}</label>
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
                      categoryName: billForm.categoryName || pdfPreview.categoryName || "general",
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
                  {t("axisFinance.registerBill")}
                </Button>
              </CardContent>
            </Card>
          )}

          {pdfPreview && pdfPreview.docType !== "bill" && (
            <Card className="border-primary" data-testid="card-pdf-preview">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t("axisFinance.statementDetected", { count: pdfPreview.transactions?.length || 0 })}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setPdfPreview(null)}><X className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 max-h-60 overflow-auto">
                {pdfPreview.transactions?.map((tx: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50">
                    <span className="truncate flex-1">{tx.description}</span>
                    <span className={`ml-2 ${tx.type === "income" ? "text-green-500" : "text-destructive"}`}>{fmtMoney(tx.amount ?? 0)}</span>
                  </div>
                ))}
                <Button onClick={() => confirmPdfMutation.mutate(pdfPreview)} disabled={confirmPdfMutation.isPending} className="w-full mt-2" data-testid="button-confirm-pdf">
                  {confirmPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} {t("axisFinance.importAll")}
                </Button>
              </CardContent>
            </Card>
          )}

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("axisFinance.recentTransactions")}</h2>
            {txLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredTx.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("axisFinance.noTransactions")}</p>
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
                            <p className="text-sm truncate">{formatTxDescription(tx.description)}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                              <span>{tx.categoryName || t("axisFinance.noCategory")}</span>
                              {tx.establishment && <><span>·</span><span>{tx.establishment}</span></>}
                              {(tx as any).creditCardId && (() => {
                                const card = creditCards.find((c: any) => c.id === (tx as any).creditCardId);
                                const installInfo = (() => { try { return (tx as any).installmentInfo ? JSON.parse((tx as any).installmentInfo) : null; } catch { return null; } })();
                                return card ? (
                                  <>
                                    <span>·</span>
                                    <span className="flex items-center gap-0.5 font-medium" style={{ color: card.color || "#7C3AED" }}>
                                      <CreditCard className="h-2.5 w-2.5" />
                                      {card.name}
                                      {installInfo && <span className="ml-0.5 text-muted-foreground">({installInfo.current}/{installInfo.total})</span>}
                                    </span>
                                  </>
                                ) : null;
                              })()}
                              {!(tx as any).creditCardId && pmLabel && (
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
                                    style={{ color: `${accent}B3` }}
                                    data-testid={`button-items-${tx.id}`}
                                  >
                                    <Package className="h-2.5 w-2.5" />
                                    {parsedItems.length} {parsedItems.length === 1 ? t("axisFinance.item") : t("axisFinance.items")}
                                    {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col items-end">
                            {tx.date && <span className="text-xs text-muted-foreground leading-tight">{fmtTxDate(tx.date, lang)}</span>}
                            <span className={`text-sm font-medium ${tx.type === "income" ? "text-green-500" : ""}`}>
                              {tx.type === "income" ? "+" : "-"}{fmtMoney(tx.amount)}
                            </span>
                          </div>
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
                              <span className="font-medium text-white/90 shrink-0">{fmtMoney(item.amount)}</span>
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

        {/* Right col (1/3): reservas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">{t("axisFinance.reserves")}</h2>
              {goals.length > 0 && totalGuardado > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold text-foreground">{fmtMoney(totalGuardado)}</span>
                  {" "}{t("axisFinance.totalSaved")}
                </p>
              )}
            </div>
            {goals.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAddGoal(true)} data-testid="button-add-goal">
                <Plus className="h-3 w-3 mr-1" /> {t("axisFinance.newReserve")}
              </Button>
            )}
          </div>
          {goals.length > 0 ? (
            <div className="space-y-2">
              {goals.map((g) => {
                const pct = g.targetAmount && g.targetAmount > 0
                  ? Math.min((g.currentAmount / g.targetAmount) * 100, 100)
                  : null;
                return (
                  <Card key={g.id} className="border-border" data-testid={`card-goal-${g.id}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg flex-shrink-0">{g.emoji || "💰"}</span>
                          <span className="font-medium text-sm truncate">{g.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <button
                            onClick={() => { setEditingGoal(g); setEditGoalForm({ title: g.title, emoji: g.emoji || "💰", description: g.description || "", targetAmount: g.targetAmount ? String(g.targetAmount) : "", currentAmount: String(g.currentAmount ?? 0) }); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            data-testid={`button-edit-goal-${g.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { setShowGoalHistory(g.id); setHistoryEditId(null); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            data-testid={`button-history-goal-${g.id}`}
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteGoalMutation.mutate(g.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            data-testid={`button-delete-goal-${g.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {g.description && (
                        <p className="text-xs text-muted-foreground mb-2 ml-7">{g.description}</p>
                      )}
                      <div className="ml-7">
                        <p className="text-base font-semibold text-foreground">{fmtMoney(g.currentAmount)}</p>
                        {pct !== null && g.targetAmount && (
                          <>
                            <p className="text-xs text-muted-foreground mb-1.5">de {fmtMoney(g.targetAmount)}</p>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t("axisFinance.completed", { pct: Math.round(pct) })}</p>
                          </>
                        )}
                        <div className="flex gap-1.5 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs flex-1"
                            onClick={() => { setShowDepositGoal(g.id); setDepositAmount(""); }}
                            data-testid={`button-deposit-${g.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" /> {t("axisFinance.deposit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs flex-1"
                            onClick={() => { setShowWithdrawGoal(g.id); setWithdrawAmount(""); }}
                            data-testid={`button-withdraw-${g.id}`}
                          >
                            <Minus className="h-3 w-3 mr-1" /> {t("axisFinance.withdraw")}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddGoal(true)} className="w-full" data-testid="button-add-first-goal">
              <Plus className="h-4 w-4 mr-1" /> {t("axisFinance.createFirstReserve")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Dialog: Nova Transação ── */}
      <Dialog open={showAddTx} onOpenChange={(open) => { setShowAddTx(open); if (!open) resetTxForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("axisFinance.newTransaction")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitTx} className="space-y-3" data-testid="form-add-transaction">

            {/* Tipo */}
            <Select value={txForm.type} onValueChange={(v) => setTxForm(p => ({ ...p, type: v }))}>
              <SelectTrigger data-testid="select-tx-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t("axisFinance.expense")}</SelectItem>
                <SelectItem value="income">{t("axisFinance.incomeLabel")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Valor */}
            <Input
              type="number"
              step="0.01"
              placeholder={t("axisFinance.amount")}
              value={txForm.amount}
              onChange={(e) => setTxForm(p => ({ ...p, amount: e.target.value }))}
              required
              data-testid="input-tx-amount"
            />

            {/* Descrição */}
            <Input
              placeholder={t("axisFinance.description")}
              value={txForm.description}
              onChange={(e) => setTxForm(p => ({ ...p, description: e.target.value }))}
              required
              data-testid="input-tx-description"
            />

            {/* Categoria — OBRIGATÓRIA */}
            <div>
              <Input
                placeholder={t("axisFinance.categoryRequired")}
                value={txForm.categoryName}
                onChange={(e) => setTxForm(p => ({ ...p, categoryName: e.target.value }))}
                data-testid="input-tx-category"
                className={txForm.categoryName === "" && createTxMutation.isError ? "border-destructive" : ""}
              />
              <p className="text-[11px] text-muted-foreground mt-1 ml-1">{t("axisFinance.categoryExample")}</p>
            </div>

            {/* Forma de pagamento */}
            <div>
              <Select value={txForm.paymentMethod} onValueChange={(v) => setTxForm(p => ({ ...p, paymentMethod: v as PaymentMethodValue, paymentMethodOther: "" }))}>
                <SelectTrigger data-testid="select-tx-payment-method">
                  <SelectValue placeholder={t("axisFinance.paymentMethod")} />
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
            {txForm.paymentMethod === "other" && !txForm.creditCardId && (
              <Input
                placeholder={t("axisFinance.specifyPayment")}
                value={txForm.paymentMethodOther}
                onChange={(e) => setTxForm(p => ({ ...p, paymentMethodOther: e.target.value }))}
                data-testid="input-tx-payment-other"
                autoFocus
              />
            )}

            {/* Cartão de crédito — exibido apenas para despesas */}
            {txForm.type === "expense" && creditCards.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.creditCardOptional")}</label>
                <Select value={txForm.creditCardId || "_none"} onValueChange={(v) => setTxForm(p => ({ ...p, creditCardId: v === "_none" ? "" : v, paymentMethod: v !== "_none" ? "credit" as PaymentMethodValue : p.paymentMethod, installments: "1" }))}>
                  <SelectTrigger data-testid="select-tx-credit-card">
                    <SelectValue placeholder={t("axisFinance.selectCard")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("axisFinance.noCard")}</SelectItem>
                    {creditCards.map((card: any) => (
                      <SelectItem key={card.id} value={card.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: card.color || "#7C3AED" }} />
                          {card.name} · {card.bank}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Parcelamento — somente quando cartão selecionado */}
            {txForm.creditCardId && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.installmentsQ")}</label>
                <Select value={txForm.installments} onValueChange={(v) => setTxForm(p => ({ ...p, installments: v }))}>
                  <SelectTrigger data-testid="select-tx-installments">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? t("axisFinance.inCash") : `${n}x`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={createTxMutation.isPending}
              data-testid="button-submit-transaction"
            >
              {createTxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("axisFinance.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Reserva ── */}
      <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("axisFinance.newReserve")}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createGoalMutation.mutate({
                title: goalForm.title,
                emoji: goalForm.emoji,
                description: goalForm.description || null,
                targetAmount: goalForm.targetAmount ? parseFloat(goalForm.targetAmount) : null,
                currentAmount: goalForm.currentAmount ? parseFloat(goalForm.currentAmount) : 0,
              });
            }}
            className="space-y-4"
            data-testid="form-add-goal"
          >
            {/* Emoji picker */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t("axisFinance.icon")}</p>
              <div className="flex flex-wrap gap-1.5">
                {["💰","🏦","🚗","🏠","✈️","💊","📚","💍","🐾","🎓","🏋️","💻","🎯","🌴","🛒","⚡"].map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setGoalForm(p => ({ ...p, emoji: em }))}
                    className="w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all"
                    style={{
                      borderColor: goalForm.emoji === em ? "hsl(var(--primary))" : "hsl(var(--border))",
                      background: goalForm.emoji === em ? "hsl(var(--primary) / 0.1)" : "transparent",
                    }}
                    data-testid={`emoji-goal-${em}`}
                  >{em}</button>
                ))}
              </div>
            </div>

            <Input
              placeholder={t("axisFinance.reserveName")}
              value={goalForm.title}
              onChange={(e) => setGoalForm(p => ({ ...p, title: e.target.value }))}
              required
              data-testid="input-goal-title"
            />

            <Input
              placeholder={t("axisFinance.reserveDescription")}
              value={goalForm.description}
              onChange={(e) => setGoalForm(p => ({ ...p, description: e.target.value }))}
              data-testid="input-goal-description"
            />

            <div>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={t("axisFinance.currentAmountOptional")}
                value={goalForm.currentAmount}
                onChange={(e) => setGoalForm(p => ({ ...p, currentAmount: e.target.value }))}
                data-testid="input-goal-current"
              />
              {goalForm.currentAmount && parseFloat(goalForm.currentAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1 ml-1">{t("axisFinance.willDebitBalance")}</p>
              )}
            </div>

            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={t("axisFinance.targetAmountOptional")}
              value={goalForm.targetAmount}
              onChange={(e) => setGoalForm(p => ({ ...p, targetAmount: e.target.value }))}
              data-testid="input-goal-amount"
            />

            <Button type="submit" className="w-full" disabled={createGoalMutation.isPending} data-testid="button-submit-goal">
              {createGoalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t("axisFinance.createReserve")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Depositar na reserva ── */}
      {(() => {
        const depositGoal = goals.find(g => g.id === showDepositGoal);
        return (
          <Dialog open={!!showDepositGoal} onOpenChange={(open) => { if (!open) { setShowDepositGoal(null); setDepositAmount(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {depositGoal ? `${depositGoal.emoji || "💰"} ${t("axisFinance.depositInto")} ${depositGoal.title}` : t("axisFinance.deposit")}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amt = parseFloat(depositAmount);
                  if (!showDepositGoal || isNaN(amt) || amt <= 0) return;
                  depositMutation.mutate({ id: showDepositGoal, amount: amt });
                }}
                className="space-y-4"
                data-testid="form-deposit-goal"
              >
                <p className="text-sm text-muted-foreground">
                  {t("axisFinance.depositDesc")}
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="pl-9"
                    autoFocus
                    required
                    data-testid="input-deposit-amount"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={depositMutation.isPending} data-testid="button-confirm-deposit">
                  {depositMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t("axisFinance.confirmDeposit")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}
      </>}

      {/* ── Dialog: Sacar da reserva ── */}
      {(() => {
        const withdrawGoal = goals.find(g => g.id === showWithdrawGoal);
        return (
          <Dialog open={!!showWithdrawGoal} onOpenChange={(open) => { if (!open) { setShowWithdrawGoal(null); setWithdrawAmount(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {withdrawGoal ? `${withdrawGoal.emoji || "💰"} ${t("axisFinance.withdrawFrom")} ${withdrawGoal.title}` : t("axisFinance.withdraw")}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amt = parseFloat(withdrawAmount);
                  if (!showWithdrawGoal || isNaN(amt) || amt <= 0) return;
                  withdrawMutation.mutate({ id: showWithdrawGoal, amount: amt });
                }}
                className="space-y-4"
                data-testid="form-withdraw-goal"
              >
                <p className="text-sm text-muted-foreground">
                  {t("axisFinance.withdrawDesc")}
                  {withdrawGoal && <span className="block mt-1 font-medium">{t("axisFinance.available")}: {fmtMoney(withdrawGoal.currentAmount)}</span>}
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={withdrawGoal?.currentAmount}
                    placeholder="0,00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-9"
                    autoFocus
                    required
                    data-testid="input-withdraw-amount"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={withdrawMutation.isPending} data-testid="button-confirm-withdraw">
                  {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t("axisFinance.confirmWithdraw")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Dialog: Editar reserva ── */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => { if (!open) setEditingGoal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("axisFinance.editReserve")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingGoal) return;
              updateGoalMutation.mutate({
                id: editingGoal.id,
                data: {
                  title: editGoalForm.title,
                  emoji: editGoalForm.emoji,
                  description: editGoalForm.description || null,
                  targetAmount: editGoalForm.targetAmount ? parseFloat(editGoalForm.targetAmount) : null,
                  currentAmount: editGoalForm.currentAmount !== "" ? parseFloat(editGoalForm.currentAmount) : undefined,
                },
              });
            }}
            className="space-y-3"
            data-testid="form-edit-goal"
          >
            <div className="flex flex-wrap gap-2">
              {["💰","🏦","🚗","🏠","✈️","💊","📚","💍","🐾","🎓","🏋️","💻","🎯","🌴","🛒","⚡"].map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEditGoalForm(p => ({ ...p, emoji: em }))}
                  className="text-xl p-1.5 rounded-lg border transition-colors"
                  style={{
                    borderColor: editGoalForm.emoji === em ? "hsl(var(--primary))" : "hsl(var(--border))",
                    background: editGoalForm.emoji === em ? "hsl(var(--primary) / 0.1)" : "transparent",
                  }}
                  data-testid={`emoji-edit-goal-${em}`}
                >
                  {em}
                </button>
              ))}
            </div>
            <Input
              placeholder={t("axisFinance.reserveName")}
              value={editGoalForm.title}
              onChange={(e) => setEditGoalForm(p => ({ ...p, title: e.target.value }))}
              required
              data-testid="input-edit-goal-title"
            />
            <Input
              placeholder={t("axisFinance.descriptionOptional")}
              value={editGoalForm.description}
              onChange={(e) => setEditGoalForm(p => ({ ...p, description: e.target.value }))}
              data-testid="input-edit-goal-description"
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={t("axisFinance.targetAmountOptional")}
              value={editGoalForm.targetAmount}
              onChange={(e) => setEditGoalForm(p => ({ ...p, targetAmount: e.target.value }))}
              data-testid="input-edit-goal-target"
            />
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1.5">{t("axisFinance.editCurrentAmount")}</p>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={t("axisFinance.currentAmountPlaceholder")}
                value={editGoalForm.currentAmount}
                onChange={(e) => setEditGoalForm(p => ({ ...p, currentAmount: e.target.value }))}
                data-testid="input-edit-goal-current"
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateGoalMutation.isPending} data-testid="button-confirm-edit-goal">
              {updateGoalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t("axisFinance.saveChanges")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Histórico da reserva ── */}
      {(() => {
        const histGoal = goals.find(g => g.id === showGoalHistory);
        return (
          <Dialog open={!!showGoalHistory} onOpenChange={(open) => { if (!open) { setShowGoalHistory(null); setHistoryEditId(null); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{histGoal?.emoji || "💰"} {histGoal?.title} — {t("axisFinance.goalHistory")}</DialogTitle>
              </DialogHeader>
              {historyLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : goalHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("axisFinance.noHistoryYet")}</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {goalHistory.map((tx: any) => {
                    const isDeposit = tx.type === "expense";
                    const isEditing = historyEditId === tx.id;
                    const dateStr = tx.date ? new Date(tx.date).toLocaleDateString(lang, { day: "2-digit", month: "short", year: "numeric" }) : "";
                    return (
                      <div key={tx.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-base ${isDeposit ? "text-emerald-500" : "text-red-400"}`}>
                              {isDeposit ? "+" : "−"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{fmtMoney(tx.amount)}</p>
                              <p className="text-xs text-muted-foreground">{dateStr}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDeposit ? "bg-emerald-500/10 text-emerald-500" : "bg-red-400/10 text-red-400"}`}>
                              {isDeposit ? t("axisFinance.deposit") : t("axisFinance.withdraw")}
                            </span>
                            <button
                              onClick={() => {
                                if (isEditing) { setHistoryEditId(null); } else {
                                  setHistoryEditId(tx.id);
                                  setHistoryEditAmount(String(tx.amount));
                                  setHistoryEditDate(tx.date ? new Date(tx.date).toISOString().split("T")[0] : "");
                                }
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1"
                              data-testid={`button-edit-history-${tx.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {isEditing && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const amt = parseFloat(historyEditAmount);
                              if (isNaN(amt) || amt <= 0 || !showGoalHistory) return;
                              editHistoryMutation.mutate({ goalId: showGoalHistory, txId: tx.id, amount: amt, date: historyEditDate || undefined });
                            }}
                            className="flex gap-2 pt-1 border-t border-border"
                          >
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={historyEditAmount}
                              onChange={e => setHistoryEditAmount(e.target.value)}
                              className="h-8 text-sm"
                              placeholder={t("axisFinance.amount")}
                              data-testid={`input-history-amount-${tx.id}`}
                            />
                            <Input
                              type="date"
                              value={historyEditDate}
                              onChange={e => setHistoryEditDate(e.target.value)}
                              className="h-8 text-sm"
                              data-testid={`input-history-date-${tx.id}`}
                            />
                            <Button type="submit" size="sm" className="h-8 shrink-0" disabled={editHistoryMutation.isPending} data-testid={`button-save-history-${tx.id}`}>
                              {editHistoryMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Dialog: Adicionar Saldo ── */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initialBalance > 0 ? t("axisFinance.updateBalance") : t("axisFinance.addInitialBalance")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {initialBalance > 0
              ? t("axisFinance.updateBalanceDesc")
              : t("axisFinance.addInitialBalanceDesc")}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = parseFloat(balanceInput.replace(",", "."));
              if (isNaN(val) || val < 0) {
                toast({ title: t("axisFinance.invalidValue"), variant: "destructive" });
                return;
              }
              setInitialBalanceMutation.mutate(val);
            }}
            className="space-y-4"
            data-testid="form-initial-balance"
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
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
              {initialBalance > 0 ? t("axisFinance.updateBalance") : t("axisFinance.setBalance")}
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
          ? txDate.toLocaleDateString(undefined, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
          : null;
        const timeStr = hasTime
          ? txDate!.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
          : null;
        const pmLabel = paymentLabel(tx.paymentMethod);
        const PMIcon = pmLabel ? (PM_ICONS[tx.paymentMethod] || Wallet) : null;
        const SOURCE_LABELS: Record<string, { label: string; Icon: any }> = {
          manual: { label: t("axisFinance.srcManual"), Icon: Hash },
          voice: { label: t("axisFinance.srcVoice"), Icon: Mic },
          text: { label: t("axisFinance.srcText"), Icon: FileText },
          photo: { label: t("axisFinance.srcPhoto"), Icon: Image },
          whatsapp: { label: "WhatsApp", Icon: MessageCircle },
          pdf: { label: t("axisFinance.srcPdf"), Icon: FileText },
        };
        const srcInfo = SOURCE_LABELS[tx.source] ?? null;
        const isIncome = tx.type === "income";

        return (
          <Dialog open onOpenChange={() => setSelectedTx(null)}>
            <DialogContent className="max-w-sm" data-testid="dialog-tx-detail">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold leading-snug pr-6">{formatTxDescription(tx.description)}</DialogTitle>
              </DialogHeader>

              {/* Amount */}
              <div className={`text-3xl font-bold ${isIncome ? "text-green-500" : "text-destructive"}`}>
                {isIncome ? "+" : "-"}{fmtMoney(tx.amount)}
              </div>

              <div className="space-y-3 pt-1">
                {/* Type */}
                <div className="flex items-center gap-2.5 text-sm">
                  {isIncome
                    ? <ArrowDownCircle className="h-4 w-4 text-green-500 shrink-0" />
                    : <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <span className="text-muted-foreground">{t("axisFinance.type")}</span>
                  <span className="ml-auto font-medium">{isIncome ? t("axisFinance.incomeLabel") : t("axisFinance.expenseLabel")}</span>
                </div>

                {/* Category */}
                {tx.categoryName && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t("axisFinance.category")}</span>
                    <span className="ml-auto font-medium capitalize">{tx.categoryName}</span>
                  </div>
                )}

                {/* Establishment */}
                {tx.establishment && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{isIncome ? t("axisFinance.sender") : t("axisFinance.recipient2")}</span>
                    <span className="ml-auto font-medium text-right max-w-[55%] leading-tight">{tx.establishment}</span>
                  </div>
                )}

                {/* Date */}
                {dateStr && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{t("axisFinance.date")}</span>
                    <span className="ml-auto font-medium text-right max-w-[60%] leading-tight capitalize">{dateStr}</span>
                  </div>
                )}

                {/* Time */}
                {timeStr && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t("axisFinance.time")}</span>
                    <span className="ml-auto font-medium">{timeStr}</span>
                  </div>
                )}

                {/* Payment method */}
                {pmLabel && (
                  <div className="flex items-center gap-2.5 text-sm">
                    {PMIcon ? <PMIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="text-muted-foreground">{t("axisFinance.payment")}</span>
                    <span className="ml-auto font-medium">{pmLabel}</span>
                  </div>
                )}

                {/* Location */}
                {tx.location && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t("axisFinance.location")}</span>
                    <span className="ml-auto font-medium text-right max-w-[55%] leading-tight">{tx.location}</span>
                  </div>
                )}

                {/* Source */}
                {srcInfo && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <srcInfo.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{t("axisFinance.source")}</span>
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
                          <span className="text-muted-foreground">{t("axisFinance.items")}</span>
                        </span>
                        <span className="flex items-center gap-1 font-medium" style={{ color: `${accent}CC` }}>
                          {items.length} {items.length === 1 ? t("axisFinance.item") : t("axisFinance.items")}
                          {showDetailItems ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                      {showDetailItems && (
                        <div className="mt-2 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs" style={{ borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                              <span className="text-white/70 truncate mr-3">{item.description}</span>
                              <span className="font-medium text-white/90 shrink-0">{fmtMoney(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => { setEditingTx(tx); setSelectedTx(null); }}
                data-testid="button-edit-tx-detail"
              >
                <Pencil className="h-4 w-4 mr-2" /> {t("axisFinance.editTransaction")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-2"
                onClick={() => setTxToDelete(tx.id)}
                data-testid="button-delete-tx-detail"
              >
                <Trash2 className="h-4 w-4 mr-2" /> {t("axisFinance.deleteTransaction")}
              </Button>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AlertDialog open={!!txToDelete} onOpenChange={(o) => { if (!o) setTxToDelete(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-delete-tx">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("axisFinance.deleteTxTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("axisFinance.deleteTxDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-tx">{t("axisFinance.cancel")}</AlertDialogCancel>
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
              {t("axisFinance.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManageBillsSheet open={showManageBills} onClose={() => setShowManageBills(false)} />

      <EditTransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />
    </div>
  );
}

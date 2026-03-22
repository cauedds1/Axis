import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, CreditCard, Smartphone, Banknote, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return new Date().toISOString().split("T")[0];
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

interface Props {
  transaction: any | null;
  onClose: () => void;
}

export function EditTransactionDialog({ transaction, onClose }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const PAYMENT_METHODS = [
    { value: "debit", label: t("axisFinance.pmDebit"), icon: CreditCard },
    { value: "credit", label: t("axisFinance.pmCredit"), icon: CreditCard },
    { value: "pix", label: t("axisFinance.pmPix"), icon: Smartphone },
    { value: "cash", label: t("axisFinance.pmCash"), icon: Banknote },
    { value: "other", label: t("axisFinance.pmOther"), icon: Wallet },
  ] as const;

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    description: "",
    categoryName: "",
    establishment: "",
    date: "",
    paymentMethod: "",
    creditCardId: "",
  });

  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type || "expense",
        amount: transaction.amount != null ? String(transaction.amount) : "",
        description: transaction.description || "",
        categoryName: transaction.categoryName || "",
        establishment: transaction.establishment || "",
        date: toDateInputValue(transaction.date),
        paymentMethod: transaction.paymentMethod || "",
        creditCardId: transaction.creditCardId || "",
      });
    }
  }, [transaction]);

  const { data: cardsData } = useQuery<any[]>({
    queryKey: ["/api/credit-cards"],
    enabled: !!transaction,
  });
  const creditCards: any[] = cardsData || [];

  const editMutation = useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/transactions/${transaction.id}`, fields);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: t("axisFinance.txUpdated") });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: t("axisFinance.txUpdateError"), description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transaction) return;
    const fields: Record<string, any> = {
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
      categoryName: form.categoryName,
      establishment: form.establishment || null,
      date: form.date,
      paymentMethod: form.paymentMethod || null,
      creditCardId: form.type === "expense" && form.creditCardId ? form.creditCardId : null,
    };
    editMutation.mutate(fields);
  }

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-testid="dialog-edit-transaction">
        <DialogHeader>
          <DialogTitle>{t("axisFinance.editTransaction")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" data-testid="form-edit-transaction">
          <Select value={form.type} onValueChange={(v) => setForm(p => ({ ...p, type: v, creditCardId: "" }))}>
            <SelectTrigger data-testid="select-edit-tx-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">{t("axisFinance.expense")}</SelectItem>
              <SelectItem value="income">{t("axisFinance.incomeLabel")}</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder={t("axisFinance.amountLabel")}
            value={form.amount}
            onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))}
            required
            data-testid="input-edit-tx-amount"
          />

          <Input
            placeholder={t("axisFinance.description")}
            value={form.description}
            onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
            required
            data-testid="input-edit-tx-description"
          />

          <div>
            <Input
              placeholder={t("axisFinance.categoryRequired")}
              value={form.categoryName}
              onChange={(e) => setForm(p => ({ ...p, categoryName: e.target.value }))}
              required
              data-testid="input-edit-tx-category"
            />
            <p className="text-[11px] text-muted-foreground mt-1 ml-1">{t("axisFinance.categoryPlaceholder")}</p>
          </div>

          <Input
            placeholder={t("axisFinance.establishmentOptional")}
            value={form.establishment}
            onChange={(e) => setForm(p => ({ ...p, establishment: e.target.value }))}
            data-testid="input-edit-tx-establishment"
          />

          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
            required
            data-testid="input-edit-tx-date"
          />

          <Select
            value={form.paymentMethod || "_none"}
            onValueChange={(v) => setForm(p => ({ ...p, paymentMethod: v === "_none" ? "" : v }))}
          >
            <SelectTrigger data-testid="select-edit-tx-payment">
              <SelectValue placeholder={t("axisFinance.paymentMethod")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t("axisFinance.notSpecified")}</SelectItem>
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

          {form.type === "expense" && creditCards.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("axisFinance.creditCardOptional")}</label>
              <Select
                value={form.creditCardId || "_none"}
                onValueChange={(v) => setForm(p => ({ ...p, creditCardId: v === "_none" ? "" : v, paymentMethod: v !== "_none" ? "credit" : p.paymentMethod }))}
              >
                <SelectTrigger data-testid="select-edit-tx-card">
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

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              data-testid="button-edit-tx-cancel"
            >
              {t("axisFinance.cancel")}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={editMutation.isPending}
              data-testid="button-edit-tx-save"
            >
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("axisFinance.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

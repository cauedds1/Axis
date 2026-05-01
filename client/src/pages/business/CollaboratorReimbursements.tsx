import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";

export default function CollaboratorReimbursements() {
  const { t } = useTranslation();
  const { fmtMoney } = useCurrency();
  const { user } = useAuth();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = orgs?.[0];

  const { data: allExpenses, isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses", user?.id],
    queryFn: async () => {
      if (!activeOrg?.id || !user?.id) return [];
      const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses?userId=${user.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    enabled: !!activeOrg?.id && !!user?.id,
  });

  const approved = useMemo(() => (allExpenses ?? []).filter(e => e.status === "approved"), [allExpenses]);
  const paid = useMemo(() => (allExpenses ?? []).filter(e => e.status === "paid").sort((a, b) => {
    if (!a.paidAt || !b.paidAt) return 0;
    return new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime();
  }), [allExpenses]);

  const totalAReceber = useMemo(() => approved.reduce((s, e) => s + e.amount, 0), [approved]);
  const totalRecebido = useMemo(() => paid.reduce((s, e) => s + e.amount, 0), [paid]);

  const isLoading = orgsLoading || expLoading;

  if (isLoading) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t("axisBiz.collabReimbursements.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("axisBiz.collabReimbursements.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            data-testid="card-total-a-receber"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#818CF818" }}>
              <Clock className="w-5 h-5" style={{ color: "#818CF8" }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("axisBiz.collabReimbursements.toReceive")}</p>
              <p className="text-xl font-bold text-foreground" data-testid="text-total-a-receber">{fmtMoney(totalAReceber)}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("axisBiz.collabReimbursements.expense", { count: approved.length })} {t("axisBiz.collabReimbursements.approved", { count: approved.length })}
              </p>
            </div>
          </div>
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            data-testid="card-total-recebido"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#10B98118" }}>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("axisBiz.collabReimbursements.totalReceived")}</p>
              <p className="text-xl font-bold text-foreground" data-testid="text-total-recebido">{fmtMoney(totalRecebido)}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("axisBiz.collabReimbursements.reimbursement", { count: paid.length })} {t("axisBiz.collabReimbursements.paid", { count: paid.length })}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" style={{ color: "#818CF8" }} />
            <h2 className="text-sm font-semibold text-foreground">{t("axisBiz.collabReimbursements.pendingSection")}</h2>
            {approved.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#818CF815", color: "#818CF8" }}>
                {approved.length}
              </span>
            )}
          </div>
          {approved.length === 0 ? (
            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)" }}
              data-testid="empty-aprovadas"
            >
              <Wallet className="w-8 h-8 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">{t("axisBiz.collabReimbursements.noPending")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {approved.map((expense: any) => (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                  data-testid={`row-approved-${expense.id}`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#818CF812" }}>
                    <Clock className="w-4 h-4" style={{ color: "#818CF8" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{expense.establishment || expense.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {expense.date ? format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </span>
                      {expense.categoryName && (
                        <>
                          <span className="text-muted-foreground/30 text-xs">·</span>
                          <span className="text-[11px] text-muted-foreground">{expense.categoryName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{fmtMoney(expense.amount)}</p>
                    <Badge className="text-[10px] font-semibold" style={{ background: "#818CF815", color: "#818CF8", border: "1px solid #818CF830" }}>
                      {t("axisBiz.collabReimbursements.waiting")}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">{t("axisBiz.collabReimbursements.receivedSection")}</h2>
            {paid.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#10B98115", color: "#10B981" }}>
                {paid.length}
              </span>
            )}
          </div>
          {paid.length === 0 ? (
            <div
              className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)" }}
              data-testid="empty-pagas"
            >
              <CheckCircle2 className="w-8 h-8 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">{t("axisBiz.collabReimbursements.noReceived")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {paid.map((expense: any) => (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                  data-testid={`row-paid-${expense.id}`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#10B98112" }}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{expense.establishment || expense.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {expense.date ? format(new Date(expense.date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </span>
                      {expense.categoryName && (
                        <>
                          <span className="text-muted-foreground/30 text-xs">·</span>
                          <span className="text-[11px] text-muted-foreground">{expense.categoryName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{fmtMoney(expense.amount)}</p>
                      {expense.paidAt && (
                        <p className="text-[10px] text-emerald-400">
                          {t("axisBiz.collabReimbursements.paidOn", { date: format(new Date(expense.paidAt), "dd/MM/yyyy", { locale: ptBR }) })}
                        </p>
                      )}
                    </div>
                    <Badge className="text-[10px] font-semibold" style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}>
                      {t("axisBiz.collabReimbursements.paid", { count: 1 })}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Search, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  SectionTitle, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDate, fmtCurrency, adminFetch } from "../admin-utils";

type SortDir = "asc" | "desc";

export function OrgsSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirmImpersonate, setConfirmImpersonate] = useState<Record<string, unknown> | null>(null);
  const [viewOrg, setViewOrg] = useState<Record<string, unknown> | null>(null);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const params = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery<{ organizations: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/organizations", page, search, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/organizations?${params.toString()}`),
  });

  interface OrgDetail {
    members: { user_id?: string; userId?: string; first_name?: string; last_name?: string; email?: string; role?: string }[];
    pendingApprovals: number;
    categoryBreakdown: { category_name?: string; total?: number; count?: number }[];
  }

  const { data: orgDetail, isLoading: orgDetailLoading } = useQuery<OrgDetail>({
    queryKey: ["/api/admin/organizations", viewOrg?.id],
    queryFn: () => adminFetch(`/api/admin/organizations/${viewOrg!.id}`),
    enabled: !!viewOrg,
  });

  const orgs = data?.organizations ?? [];
  const total = data?.total ?? 0;

  const impersonate = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/organizations/${id}/impersonate`);
      return res.json() as Promise<{ orgName?: string; message?: string }>;
    },
    onSuccess: (resp) => {
      const orgName = resp?.orgName ?? "org";
      toast({ title: `Now viewing ${orgName} in read-only mode. Navigating to business app…` });
      qc.invalidateQueries({ queryKey: ["/api/admin/impersonate/status"] });
      setConfirmImpersonate(null);
      // Navigate into the org's business context
      navigate("/business/app/financas");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  return (
    <div className="space-y-4">
      <SectionTitle>{t("orgs.title")}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-orgs-search" className="pl-9" placeholder={t("common.search")}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th onClick={() => toggleSort("name")}>{t("orgs.name")}<SortIcon field="name" sort={sortBy} dir={sortDir} /></Th>
                <Th>{t("orgs.owner")}</Th>
                <Th onClick={() => toggleSort("member_count")}>{t("orgs.members")}<SortIcon field="member_count" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("total_expenses")}>Total Expenses<SortIcon field="total_expenses" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("created_at")}>{t("orgs.createdAt")}<SortIcon field="created_at" sort={sortBy} dir={sortDir} /></Th>
                <Th>{t("users.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <EmptyRow colSpan={6} label={t("common.noData")} />
              ) : orgs.map((o) => (
                <tr key={o.id as string} className="hover:bg-accent/30 transition-colors cursor-pointer"
                  data-testid={`row-org-${o.id}`} onClick={() => setViewOrg(o)}>
                  <Td><span className="font-medium text-foreground">{o.name as string}</span></Td>
                  <Td className="text-muted-foreground text-xs">{(o.owner_email ?? o.ownerEmail ?? "—") as string}</Td>
                  <Td>{(o.member_count ?? o.memberCount ?? 0) as number}</Td>
                  <Td className="text-emerald-400">{fmtCurrency((o.total_expenses ?? o.totalExpenses) as number)}</Td>
                  <Td className="text-muted-foreground">{fmtDate((o.created_at ?? o.createdAt) as string)}</Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <Button data-testid={`button-impersonate-${o.id}`} variant="ghost" size="sm"
                      title="View org as owner (read-only)"
                      onClick={e => { e.stopPropagation(); setConfirmImpersonate(o); }}>
                      <UserCog className="h-3.5 w-3.5" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}

      <Dialog open={!!confirmImpersonate} onOpenChange={() => setConfirmImpersonate(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("orgs.viewAs")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("orgs.impersonateNote")}</div>
          <div className="font-medium text-foreground">
            {confirmImpersonate?.name as string} ({(confirmImpersonate?.owner_email ?? confirmImpersonate?.ownerEmail ?? "no owner") as string})
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmImpersonate(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-impersonate"
              onClick={() => confirmImpersonate && impersonate.mutate(confirmImpersonate.id as string)}
              disabled={impersonate.isPending}>
              {t("orgs.impersonate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewOrg} onOpenChange={() => setViewOrg(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle>{viewOrg?.name as string} — {t("orgs.title")}</DialogTitle></DialogHeader>
          {orgDetailLoading ? (
            <div className="text-muted-foreground py-4">{t("common.loading")}</div>
          ) : orgDetail ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Owner", (viewOrg?.owner_email ?? viewOrg?.ownerEmail ?? "—")],
                  ["Members", orgDetail.members?.length ?? 0],
                  ["Pending Approvals", orgDetail.pendingApprovals ?? 0],
                  ["Created", fmtDate((viewOrg?.created_at ?? viewOrg?.createdAt) as string)],
                ].map(([label, val]) => (
                  <div key={label as string} className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                    <div className="text-xs text-muted-foreground">{label as string}</div>
                    <div className="font-medium text-sm">{String(val ?? "—")}</div>
                  </div>
                ))}
              </div>
              {orgDetail.members?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Members</div>
                  <div className="space-y-1">
                    {orgDetail.members.map((m) => (
                      <div key={m.user_id ?? m.userId} className="flex justify-between text-xs bg-background/30 rounded px-3 py-2">
                        <span className="text-foreground">{m.first_name ?? ""} {m.last_name ?? ""} <span className="text-muted-foreground">{m.email}</span></span>
                        <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {orgDetail.categoryBreakdown?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Top Expense Categories</div>
                  <div className="space-y-1">
                    {orgDetail.categoryBreakdown.map((c) => (
                      <div key={c.category_name} className="flex justify-between text-xs bg-background/30 rounded px-3 py-2">
                        <span className="text-foreground capitalize">{c.category_name ?? "Uncategorized"}</span>
                        <span className="text-emerald-400">{fmtCurrency(c.total)} ({c.count} txns)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewOrg(null)}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

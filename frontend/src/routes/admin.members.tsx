import { createFileRoute } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, configApi, authApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Search, Plus, RefreshCw, Trash2, Edit3, Loader2, Download, CreditCard, Gift } from "lucide-react";
import { PlanBadge, PlanIcons } from "@/components/messmate/PlanBadge";
import {
  todayISO,
  daysRemaining,
  formatDate,
  formatINR,
  addDaysISO,
} from "@/lib/messmate/dateHelpers";
import { MEALS } from "@/lib/messmate/constants";
import type { Meal, Member, Plan } from "@/lib/messmate/types";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConfirmDialog } from "@/components/messmate/ConfirmDialog";
import { useSSE } from "@/lib/messmate/useSSE";

const PAYMENT_METHODS = ["Cash", "Online", "UPI", "Card"];

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Members - Mom's Kitchen Admin" }] }),
  component: MembersPage,
});

function MembersPage() {
  useSSE();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "expired" | "unpaid" | "pending">("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "member_id">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [renewing, setRenewing] = useState<Member | null>(null);
  const [paying, setPaying] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [page, setPage] = useState(1);

  const membersQ = useQuery({
    queryKey: ["members", { search, status, planFilter, sortBy, sortOrder, page }],
    queryFn: () =>
      membersApi.list({
        search,
        status,
        planId: planFilter === "all" ? undefined : planFilter,
        sortBy,
        sortOrder,
        page,
        limit: 50,
      }),
  });
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => configApi.listPlans() });
  const birthdaysQ = useQuery({ queryKey: ["birthdaysToday"], queryFn: () => membersApi.getBirthdaysToday() });

  const members = membersQ.data?.items ?? [];
  const plans = plansQ.data ?? [];
  const total = membersQ.data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const handleStatus = (v: any) => {
    setStatus(v);
    setPage(1);
  };
  const handlePlanFilter = (v: string) => {
    setPlanFilter(v);
    setPage(1);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["members"] });

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      // @ts-ignore
      const blob = await membersApi.exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messmate_members_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Members data exported successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to export member records");
    } finally {
      setExporting(false);
    }
  };

  const renewM = useMutation({
    mutationFn: (id: string) => membersApi.renew(id, {}),
    onSuccess: () => {
      toast.success("Plan renewed");
      invalidate();
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => membersApi.remove(id),
    onSuccess: () => {
      toast.success("Member removed");
      invalidate();
    },
  });

  const birthdays = birthdaysQ.data ?? [];

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {membersQ.isLoading ? "Loading…" : `${total} member${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            Export CSV
          </Button>
          <Button onClick={() => setAdding(true)} disabled={!plans.length}>
            <Plus className="mr-1 h-4 w-4" /> Add Member
          </Button>
        </div>
      </header>

      {birthdays.length > 0 && (
        <Card className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-pink-500/20 p-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
              <Gift className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-pink-800 dark:text-pink-300">Today's Birthdays 🎂</h3>
              <p className="text-sm text-pink-700/80 dark:text-pink-400/80 mt-1">
                Wish a happy birthday to: <span className="font-medium text-pink-900 dark:text-pink-200">{birthdays.map(m => m.name).join(", ")}</span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-5 flex flex-col md:flex-row gap-4 justify-between md:items-center">
        <div className="flex flex-wrap gap-2 w-full">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v: any) => handleStatus(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>

          <Select value={planFilter} onValueChange={handlePlanFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              {plansQ.data?.map((p) => (
                <SelectItem key={p.planId} value={p.planId}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={(val) => {
              const [by, order] = val.split("-") as [any, any];
              setSortBy(by);
              setSortOrder(order);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[185px]">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newly Joined</SelectItem>
              <SelectItem value="created_at-asc">Oldest Joined</SelectItem>
              <SelectItem value="member_id-asc">Member ID: Low to High</SelectItem>
              <SelectItem value="member_id-desc">Member ID: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isMobile ? (
          /* Mobile Card View */
          <div className="grid grid-cols-1 gap-4 p-4">
            {membersQ.isLoading && (
              <div className="space-y-4 py-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="p-4 border rounded-2xl space-y-3 bg-muted/20 animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-950/10 dark:bg-emerald-950/20" />
                        <div className="space-y-1.5">
                          <div className="h-4 w-28 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                          <div className="h-3 w-16 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </div>
                      </div>
                      <div className="h-6 w-16 rounded-full bg-emerald-950/10 dark:bg-emerald-950/20" />
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <div className="h-4 w-20 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                      <div className="h-4 w-12 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {membersQ.isError && (
              <div className="py-10 text-center text-destructive font-medium">
                Failed to load members. Please try again.
              </div>
            )}
            {!membersQ.isLoading && !membersQ.isError && members.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No members found</div>
            )}
            {!membersQ.isLoading &&
              !membersQ.isError &&
              members.map((m) => {
                const left = daysRemaining(m.subscription.endDate);
                const expired = left < 0;
                const canRenew = expired || left <= 2;
                const planDietType = plans.find((p) => p.planId === m.subscription.planId)?.dietType;
                return (
                  <div
                    key={m.memberId}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setViewingMember(m)}
                  >
                    <div className="flex items-start justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                          {(m.name || "U")
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <div className="font-semibold leading-tight">{m.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.memberId}
                            {m.mobile && (
                              <>
                                {" · "}
                                <a
                                  href={`tel:${m.mobile}`}
                                  className="hover:underline hover:text-primary transition-colors inline-flex items-center"
                                >
                                  📞 {m.mobile}
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        {!m.isActive ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-500 bg-amber-50"
                          >
                            Pending
                          </Badge>
                        ) : !m.subscription.isPaid ? (
                          <div className="text-right">
                            <Badge
                              variant="destructive"
                              className={cn(
                                m.subscription.amountPaid > 0 &&
                                "bg-orange-500 hover:bg-orange-600 border-orange-500",
                              )}
                            >
                              {m.subscription.amountPaid > 0 ? "Partial" : "Unpaid"}
                            </Badge>
                            {m.subscription.dueAmount > 0 && (
                              <div className="mt-1 text-[10px] font-medium text-destructive">
                                Due: ₹{m.subscription.dueAmount}
                              </div>
                            )}
                          </div>
                        ) : expired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground">Active</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div
                        className={cn(
                          "text-xs font-medium",
                          expired && "text-destructive",
                          !expired && left <= 3 && "text-warning",
                          !expired && left > 3 && "text-muted-foreground"
                        )}
                      >
                        {(m.subscription.endDate || m.createdAt)
                          ? (expired ? `Expired ${-left}d ago` : `${left}d remaining`)
                          : "No active plan"}
                      </div>
                      <div className="flex justify-end gap-2">
                        {!m.subscription.isPaid && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-primary text-primary hover:bg-primary/10"
                            onClick={(e) => { e.stopPropagation(); setPaying(m); }}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); setEditing(m); }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <div title={!canRenew ? "Can only renew when expired or within 2 days of expiration" : undefined}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); setRenewing(m); }}
                            disabled={!canRenew}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); setDeletingMember(m); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Member</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Meals</th>
                  <th className="px-4 py-3 text-left">Start</th>
                  <th className="px-4 py-3 text-left">Expiry</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {membersQ.isLoading && (
                  <>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <tr key={n} className="border-t animate-pulse">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-950/10 dark:bg-emerald-950/20" />
                            <div className="space-y-1">
                              <div className="h-4 w-24 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                              <div className="h-3 w-16 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-28 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-12 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4.5 w-16 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-16 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-6 w-16 rounded-full bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="ml-auto h-8 w-16 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
                      </tr>
                    ))}
                  </>
                )}
                {membersQ.isError && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-destructive font-medium">
                      Failed to load members. Please try again.
                    </td>
                  </tr>
                )}
                {!membersQ.isLoading &&
                  !membersQ.isError &&
                  members.map((m) => {
                    const left = daysRemaining(m.subscription.endDate);
                    const expired = left < 0;
                    const canRenew = expired || left <= 2;
                    const planDietType = plans.find((p) => p.planId === m.subscription.planId)?.dietType;
                    return (
                      <tr
                        key={m.memberId}
                        className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setViewingMember(m)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                              {(m.name || "U")
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div>
                              <div className="font-medium leading-tight">{m.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {m.memberId}
                                {m.mobile && (
                                  <>
                                    {" · "}
                                    <a
                                      href={`tel:${m.mobile}`}
                                      className="hover:underline hover:text-primary transition-colors inline-flex items-center"
                                    >
                                      📞 {m.mobile}
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PlanBadge
                            planId={m.subscription.planId}
                            label={m.subscription.planLabel}
                            dietType={planDietType}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <PlanIcons plan={m.subscription} />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {formatDate(m.subscription.startDate || m.createdAt)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-xs",
                            expired && "text-destructive font-semibold",
                            !expired &&
                            left <= 3 &&
                            (m.subscription.endDate || m.createdAt) &&
                            "text-warning font-semibold",
                          )}
                        >
                          {formatDate(m.subscription.endDate || addDaysISO(m.createdAt, 30))}
                          {(m.subscription.endDate || m.createdAt) && (
                            <div className="text-[10px] text-muted-foreground">
                              {expired ? `${-left}d ago` : `${left}d left`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!m.isActive ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-500 bg-amber-50"
                            >
                              Pending
                            </Badge>
                          ) : !m.subscription.isPaid ? (
                            <div>
                              <Badge
                                variant="destructive"
                                className={cn(
                                  m.subscription.amountPaid > 0 &&
                                  "bg-orange-500 hover:bg-orange-600 border-orange-500",
                                )}
                              >
                                {m.subscription.amountPaid > 0 ? "Partial" : "Unpaid"}
                              </Badge>
                              {m.subscription.dueAmount > 0 && (
                                <div className="mt-1 text-[10px] font-medium text-destructive">
                                  Due: ₹{m.subscription.dueAmount}
                                </div>
                              )}
                            </div>
                          ) : expired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <Badge className="bg-success text-success-foreground">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {!m.subscription.isPaid && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary hover:text-primary hover:bg-primary/10"
                                onClick={(e) => { e.stopPropagation(); setPaying(m); }}
                                title="Record Payment"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(m); }}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <div title={!canRenew ? "Can only renew when expired or within 2 days of expiration" : undefined}>
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setRenewing(m); }} disabled={!canRenew}>
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setDeletingMember(m); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!membersQ.isLoading && members.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No members found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination Controls */}
      {!membersQ.isLoading && !membersQ.isError && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {Math.min(total, (page - 1) * 50 + 1)}
            </span>{" "}
            to <span className="font-semibold text-foreground">{Math.min(page * 50, total)}</span>{" "}
            of <span className="font-semibold text-foreground">{total}</span> members
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                    <Button
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </React.Fragment>
                );
              })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AddMemberDialog
        open={adding}
        onOpenChange={setAdding}
        plans={plans}
        onCreated={invalidate}
      />
      {editing && (
        <EditMemberDialog
          member={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
      {renewing && (
        <RenewMemberDialog
          member={renewing}
          plans={plans}
          onClose={() => setRenewing(null)}
          onSaved={invalidate}
        />
      )}
      {paying && (
        <RecordPaymentDialog
          member={paying}
          onClose={() => setPaying(null)}
          onSaved={invalidate}
        />
      )}
      <ConfirmDialog
        isOpen={deletingMember !== null}
        onClose={() => setDeletingMember(null)}
        onConfirm={() => {
          if (deletingMember) {
            deleteM.mutate(deletingMember.memberId);
            setDeletingMember(null);
          }
        }}
        title="Delete Member?"
        description={`Are you sure you want to delete ${deletingMember?.name}? This action cannot be undone and will permanently remove their records.`}
        confirmText="Delete"
        isPending={deleteM.isPending}
      />

      <ViewMemberDialog
        member={viewingMember}
        onClose={() => setViewingMember(null)}
        plans={plans}
      />
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  plans,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans: Plan[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [college, setCollege] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("pass123");
  const [planId, setPlanId] = useState(plans[0]?.planId ?? "");
  const [meals, setMeals] = useState<Meal[]>(plans[0]?.meals ?? ["Breakfast", "Lunch", "Dinner"]);
  const [startDate, setStartDate] = useState(todayISO());
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [step, setStep] = useState(1);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setEmail("");
      setMobile("");
      setCollege("");
      setDob("");
      setAmountPaid("");
      setPaymentMethod("Cash");
      setStartDate(todayISO());
      setPassword("pass123");
    }
  }, [open]);

  const selectedPlan = plans.find((x) => x.planId === planId);
  const price = selectedPlan?.pricePerMonth ?? 0;
  const amountPaidNum = parseInt(amountPaid) || 0;
  const dueAmount = Math.max(0, price - amountPaidNum);

  const calculatedEndDate = useMemo(() => {
    const startStr = startDate || todayISO();
    if (!startStr) return "";
    const start = new Date(startStr);
    if (isNaN(start.getTime())) return "";
    const duration = selectedPlan?.durationMonths ?? 1;
    const end = new Date(start.getTime() + (duration * 30 - 1) * 24 * 60 * 60 * 1000);
    return end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }, [startDate, selectedPlan]);

  const onPlanChange = (id: string) => {
    setPlanId(id);
    const p = plans.find((x) => x.planId === id);
    if (p) setMeals(p.meals);
  };

  const createM = useMutation({
    mutationFn: () =>
      membersApi.create({
        name,
        email,
        password,
        mobile: mobile || undefined,
        college,
        dob,
        planId,
        meals,
        startDate: startDate || todayISO(),
        amountPaid: amountPaidNum,
        paymentMethod,
      }),
    onSuccess: (m) => {
      toast.success(`${m.name} added (${m.memberId})`);
      onCreated();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const handleNext = () => {
    if (step === 1 && (!name.trim() || !email.trim() || !college.trim() || !dob.trim())) {
      toast.error("Please fill in all mandatory fields");
      return;
    }
    if (step === 1 && mobile && mobile.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits");
      return;
    }
    if (step === 2 && !planId) {
      toast.error("Please select a plan");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            Add new member
            <div className="text-xs font-normal text-muted-foreground mt-1">
              Step {step} of 3: {step === 1 ? "Personal Details" : step === 2 ? "Subscription Plan" : "Payment & Checkout"}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 1 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
              <div>
                <Label>Full name <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@college.edu" />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={mobile}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setMobile(cleaned);
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>College <span className="text-destructive">*</span></Label>
                  <Input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="College Name" />
                </div>
                <div>
                  <Label>Date of Birth <span className="text-destructive">*</span></Label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Initial Password</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <Label>Plan <span className="text-destructive">*</span></Label>
                <Select value={planId} onValueChange={onPlanChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.planId} value={p.planId}>
                        <div className="flex items-center gap-2">
                          <span>{p.label}</span>
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm border ${p.dietType === "Non-Veg" ? "text-destructive bg-destructive/10 border-destructive/20" :
                            p.dietType === "Both" ? "text-muted-foreground bg-muted border-border/50" :
                              "text-green-600 bg-green-500/10 border-green-600/20"
                            }`}>
                            {p.dietType || "Veg"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Meals included</Label>
                <div className="mt-2 flex gap-4">
                  {MEALS.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={meals.includes(m)}
                        onCheckedChange={(v) =>
                          setMeals(v ? [...meals, m] : meals.filter((x) => x !== m))
                        }
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <div className="text-[11px] font-medium bg-muted/50 p-2 rounded-md mt-2 flex justify-between">
                  <span className="text-muted-foreground">Calculated Expiry:</span>
                  <span className="text-foreground">{calculatedEndDate || "Not calculated"}</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total Plan Price</span>
                <span className="font-bold text-lg text-primary">₹{price}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                <div>
                  <Label>Amount Paid Today</Label>
                  <Input
                    type="number"
                    placeholder={`₹${price}`}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {dueAmount > 0 && (
                <div className="mt-2 text-sm font-semibold text-destructive flex justify-between bg-destructive/10 p-2 rounded-md">
                  <span>Pending Balance:</span>
                  <span>₹{dueAmount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between items-center mt-2 pt-2 border-t">
          <div className="flex gap-2 w-full">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} className="w-24">
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-24">
                Cancel
              </Button>
            )}
            <div className="flex-1"></div>
            {step < 3 ? (
              <Button onClick={handleNext} className="w-24">
                Next
              </Button>
            ) : (
              <Button
                onClick={() => createM.mutate()}
                disabled={createM.isPending || !name || !email || !planId}
                className="w-32 bg-green-600 hover:bg-green-700 text-white"
              >
                {createM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Member
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({
  member,
  plans,
  onClose,
  onSaved,
}: {
  member: Member;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [mobile, setMobile] = useState(member.mobile ?? "");
  const [college, setCollege] = useState(member.college ?? "Unknown");
  const [dob, setDob] = useState(member.dob ?? "2000-01-01");
  const [planId, setPlanId] = useState(member.subscription.planId);
  const [meals, setMeals] = useState<Meal[]>(member.subscription.meals);

  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otp, setOtp] = useState("");

  const requestOtpM = useMutation({
    mutationFn: (newEmail: string) => authApi.requestEmailOTP(newEmail, member.memberId, name),
    onSuccess: () => {
      setShowOtpDialog(true);
      toast.success(`Verification code sent to ${email}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to request code"),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const emailChanged = email.trim().toLowerCase() !== member.email.trim().toLowerCase();
      await membersApi.update(member.memberId, {
        name,
        email,
        mobile: mobile || undefined,
        college,
        dob,
        otp: emailChanged ? otp : undefined
      });
      await membersApi.changePlan(member.memberId, { planId, meals });
    },
    onSuccess: () => {
      toast.success("Member updated");
      onSaved();
      onClose();
    },
    onError: (e: any) => {
      if (e?.requiresOtp) {
        requestOtpM.mutate(email);
      } else {
        toast.error(e?.message ?? "Failed");
      }
    },
  });

  const handleSave = () => {
    const emailChanged = email.trim().toLowerCase() !== member.email.trim().toLowerCase();
    if (emailChanged && !otp) {
      requestOtpM.mutate(email);
    } else {
      saveM.mutate();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>College / Roll No</Label>
              <Input value={college} onChange={(e) => setCollege(e.target.value)} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Plan</Label>
            <Select
              value={planId}
              onValueChange={(v) => {
                setPlanId(v);
                const p = plans.find((x) => x.planId === v);
                if (p) setMeals(p.meals);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.planId} value={p.planId}>
                    <div className="flex items-center gap-2">
                      <span>{p.label}</span>
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm border ${p.dietType === "Non-Veg" ? "text-destructive bg-destructive/10 border-destructive/20" :
                        p.dietType === "Both" ? "text-muted-foreground bg-muted border-border/50" :
                          "text-green-600 bg-green-500/10 border-green-600/20"
                        }`}>
                        {p.dietType || "Veg"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            {MEALS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={meals.includes(m)}
                  onCheckedChange={(v) =>
                    setMeals(v ? [...meals, m] : meals.filter((x) => x !== m))
                  }
                />
                {m}
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveM.isPending || requestOtpM.isPending}>
            {(saveM.isPending || requestOtpM.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* OTP Verification Modal */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Verify Email Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              A 6-digit verification code was sent to <span className="font-bold text-foreground">{email}</span>. Please enter it below to confirm this change.
            </p>
            <div className="flex justify-center">
              <Input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="------"
                className="w-32 text-center tracking-[0.5em] font-mono text-xl h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOtpDialog(false)} className="w-full">
              Cancel
            </Button>
            <Button
              onClick={() => saveM.mutate()}
              disabled={otp.length !== 6 || saveM.isPending}
              className="w-full"
            >
              {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function RenewMemberDialog({
  member,
  plans,
  onClose,
  onSaved,
}: {
  member: Member;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(member.subscription.planId);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [applyAbsenceCredits, setApplyAbsenceCredits] = useState(false);
  const [startDate, setStartDate] = useState(todayISO());

  const selectedPlan = plans.find((p) => p.planId === planId);
  const price = selectedPlan?.pricePerMonth ?? 0;
  const amountPaidNum = parseInt(amountPaid) || 0;
  const dueAmount = Math.max(0, price - amountPaidNum);

  // Fetch consecutive absence credits
  const creditsQ = useQuery({
    queryKey: ["members", member.memberId, "absence-credits"],
    queryFn: () => membersApi.getAbsenceCredits(member.memberId),
  });

  const totalDaysAdded =
    (selectedPlan?.durationMonths ?? 1) * 30 +
    (applyAbsenceCredits ? (creditsQ.data?.totalCreditDays ?? 0) : 0);
  const projectedExpiry = formatDate(addDaysISO(startDate, totalDaysAdded));

  const renewM = useMutation({
    mutationFn: () =>
      membersApi.renew(member.memberId, {
        planId,
        amountPaid: amountPaidNum,
        paymentMethod,
        applyAbsenceCredits,
        startDate,
      }),
    onSuccess: () => {
      toast.success(`${member.name}'s plan renewed!`);
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to renew"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Renew Subscription</DialogTitle>
          <div className="text-sm text-muted-foreground">
            {member.name} ({member.memberId})
          </div>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.planId} value={p.planId}>
                      {p.label} (₹{p.pricePerMonth})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount Paid</Label>
              <Input
                type="number"
                placeholder={`₹${price}`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Absence Reward Section */}
          {creditsQ.data && creditsQ.data.totalCreditDays > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="apply-credits-toggle"
                  checked={applyAbsenceCredits}
                  onCheckedChange={(checked) => setApplyAbsenceCredits(!!checked)}
                  className="mt-1"
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="apply-credits-toggle"
                    className="font-semibold text-primary cursor-pointer text-sm"
                  >
                    Apply Absence Credits (+{creditsQ.data.totalCreditDays} days)
                  </Label>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Streak of 3+ consecutive absent days detected in the current billing cycle.
                  </p>
                </div>
              </div>

              {/* Streaks breakdown */}
              <div className="text-xs space-y-1.5 pl-6 border-l border-primary/20 ml-2">
                <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
                  Qualifying Streaks:
                </div>
                {creditsQ.data.streaks.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-background/50 py-1 px-2 rounded border border-muted/50 text-[11px]"
                  >
                    <span className="text-muted-foreground">
                      {formatDate(s.start)} to {formatDate(s.end)}
                    </span>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">
                      {s.length} days absent
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dueAmount > 0 ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-bold text-destructive">
              Balance Due: ₹{dueAmount}
            </div>
          ) : (
            <div className="rounded-lg bg-success/10 p-3 text-center text-sm font-bold text-success">
              Fully Paid
            </div>
          )}

          {/* Extended Expiry Preview */}
          <div className="rounded-xl bg-muted/30 p-3 space-y-2 text-sm border border-muted">
            <div className="flex justify-between text-muted-foreground">
              <span>Standard Expiration:</span>
              <span className="font-medium text-foreground">
                {formatDate(addDaysISO(startDate, (selectedPlan?.durationMonths ?? 1) * 30))}
              </span>
            </div>
            {applyAbsenceCredits && (creditsQ.data?.totalCreditDays ?? 0) > 0 && (
              <div className="flex justify-between text-success">
                <span>Absence Extension:</span>
                <span className="font-semibold">+{creditsQ.data?.totalCreditDays} Days Reward</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2 border-muted-foreground/20">
              <span>Projected Expiry Date:</span>
              <span className="text-primary">{projectedExpiry}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => renewM.mutate()} disabled={renewM.isPending}>
            {renewM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Renew & Log
            Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(member.subscription.dueAmount.toString());
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const savePayment = useMutation({
    mutationFn: async () => {
      const amtVal = parseInt(amount);
      if (isNaN(amtVal) || amtVal <= 0) {
        throw new Error("Please enter a valid amount greater than 0");
      }
      await membersApi.addPayment(member.memberId, amtVal, paymentMethod);
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to record payment"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record Payment for {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Summary Card */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Plan:</span>
              <span className="font-medium">{member.subscription.planLabel || "No active plan"}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2 border-muted/80">
              <span className="text-muted-foreground">Plan Cost:</span>
              <span className="font-semibold">₹{member.subscription.pricePerMonth}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Paid:</span>
              <span className="text-success font-semibold">₹{member.subscription.amountPaid}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-dashed pt-2 border-muted-foreground/20 font-bold text-destructive">
              <span>Remaining Balance:</span>
              <span>₹{member.subscription.dueAmount}</span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <Label>Payment Amount (₹)</Label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={member.subscription.dueAmount}
                min={1}
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => savePayment.mutate()} disabled={savePayment.isPending}>
            {savePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewMemberDialog({
  member,
  onClose,
  plans,
}: {
  member: Member | null;
  onClose: () => void;
  plans: Plan[];
}) {
  if (!member) return null;

  const left = daysRemaining(member.subscription.endDate);
  const expired = left < 0;
  const planDietType = plans.find((p) => p.planId === member.subscription.planId)?.dietType;

  return (
    <Dialog open={!!member} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl overflow-hidden p-0 gap-0">
        <div className="bg-muted/30 p-6 border-b flex flex-col items-center justify-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary mb-3">
            {(member.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <DialogTitle className="text-xl mb-1">{member.name}</DialogTitle>
          <div className="text-sm text-muted-foreground font-medium mb-3">{member.memberId}</div>

          <div className="flex gap-2">
            {!member.isActive ? (
              <Badge variant="outline" className="border-amber-500 text-amber-500 bg-amber-50">Pending</Badge>
            ) : !member.subscription.isPaid ? (
              <Badge variant="destructive">Unpaid</Badge>
            ) : expired ? (
              <Badge variant="destructive">Expired</Badge>
            ) : (
              <Badge className="bg-success text-success-foreground">Active</Badge>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{member.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">College</span>
                <span className="font-medium">{member.college}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date of Birth</span>
                <span className="font-medium">{member.dob}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Mobile</span>
                <span className="font-medium">
                  {member.mobile ? (
                    <a href={`tel:${member.mobile}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{member.mobile}</a>
                  ) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Registered</span>
                <span className="font-medium">{formatDate(member.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subscription Details</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan</span>
                <PlanBadge planId={member.subscription.planId} label={member.subscription.planLabel} dietType={planDietType} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Meals Included</span>
                <PlanIcons plan={member.subscription} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-medium">{formatDate(member.subscription.startDate || member.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Expiry Date</span>
                <div className="text-right">
                  <div className={cn("font-medium", expired && "text-destructive")}>{formatDate(member.subscription.endDate || addDaysISO(member.createdAt, 30))}</div>
                  {(member.subscription.endDate || member.createdAt) && (
                    <div className="text-[10px] text-muted-foreground">{expired ? `${-left} days ago` : `${left} days remaining`}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Financials */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financials</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">₹{member.subscription.amountPaid || 0}</span>
              </div>
              {member.subscription.dueAmount > 0 && (
                <div className="flex justify-between items-center mt-2 bg-destructive/10 text-destructive p-2 rounded-md font-semibold">
                  <span>Pending Balance</span>
                  <span>₹{member.subscription.dueAmount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="p-4 border-t sm:justify-end bg-card">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


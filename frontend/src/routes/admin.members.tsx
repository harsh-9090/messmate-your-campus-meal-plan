import { createFileRoute } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, configApi } from "@/lib/messmate/api";
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

import { Search, Plus, RefreshCw, Trash2, Edit3, Loader2, Download } from "lucide-react";
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

const PAYMENT_METHODS = ["Cash", "Online", "UPI", "Card"];

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Members - Mom's Kitchen Admin" }] }),
  component: MembersPage,
});

function MembersPage() {
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

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
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
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
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
                return (
                  <div
                    key={m.memberId}
                    className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
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
                            {m.mobile && <> · 📞 {m.mobile}</>}
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

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Plan</div>
                        <div className="mt-1">
                          <PlanBadge
                            planId={m.subscription.planId}
                            label={m.subscription.planLabel}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Meals</div>
                        <div className="mt-1">
                          <PlanIcons plan={m.subscription} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Start Date</div>
                        <div className="font-medium">
                          {formatDate(m.subscription.startDate || m.createdAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Expiry Date</div>
                        <div
                          className={cn(
                            "font-medium",
                            expired && "text-destructive",
                            !expired &&
                              left <= 3 &&
                              (m.subscription.endDate || m.createdAt) &&
                              "text-warning",
                          )}
                        >
                          {formatDate(m.subscription.endDate || addDaysISO(m.createdAt, 30))}
                          {(m.subscription.endDate || m.createdAt) && (
                            <div className="text-[10px] text-muted-foreground">
                              {expired ? `${-left}d ago` : `${left}d left`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-end gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditing(m)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setRenewing(m)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`Delete ${m.name}?`)) deleteM.mutate(m.memberId);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                  <tr>
                    <td colSpan={7} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
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
                    return (
                      <tr key={m.memberId} className="border-t hover:bg-muted/30 transition-colors">
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
                                {m.mobile && <> · 📞 {m.mobile}</>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PlanBadge
                            planId={m.subscription.planId}
                            label={m.subscription.planLabel}
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
                            <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setRenewing(m)}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete ${m.name}?`)) deleteM.mutate(m.memberId);
                              }}
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
  const [password, setPassword] = useState("pass123");
  const [planId, setPlanId] = useState(plans[0]?.planId ?? "");
  const [meals, setMeals] = useState<Meal[]>(plans[0]?.meals ?? ["Breakfast", "Lunch", "Dinner"]);
  const [startDate, setStartDate] = useState(todayISO());
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const selectedPlan = plans.find((x) => x.planId === planId);
  const price = selectedPlan?.pricePerMonth ?? 0;
  const amountPaidNum = parseInt(amountPaid) || 0;
  const dueAmount = Math.max(0, price - amountPaidNum);

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
        planId,
        meals,
        startDate,
        amountPaid: amountPaidNum,
        paymentMethod,
      }),
    onSuccess: (m) => {
      toast.success(`${m.name} added (${m.memberId})`);
      onCreated();
      onOpenChange(false);
      setName("");
      setEmail("");
      setMobile("");
      setAmountPaid("");
      setPaymentMethod("Cash");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add new member</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input
                type="tel"
                placeholder="e.g. 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Initial password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={onPlanChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.planId} value={p.planId}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Meals included</Label>
            <div className="mt-1 flex gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Amount Paid (Total: ₹{price})</Label>
              <Input
                type="number"
                placeholder={`₹${price}`}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
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
            {dueAmount > 0 && (
              <div className="mt-1 text-xs font-semibold text-destructive text-right">
                Due Amount: ₹{dueAmount}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createM.mutate()}
            disabled={createM.isPending || !name || !email || !planId}
          >
            {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
          </Button>
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
  const [mobile, setMobile] = useState(member.mobile ?? "");
  const [planId, setPlanId] = useState(member.subscription.planId);
  const [meals, setMeals] = useState<Meal[]>(member.subscription.meals);
  const [addPayment, setAddPayment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const saveM = useMutation({
    mutationFn: async () => {
      await membersApi.update(member.memberId, { name, mobile: mobile || undefined });
      await membersApi.changePlan(member.memberId, { planId, meals });
      if (parseInt(addPayment) > 0) {
        await membersApi.addPayment(member.memberId, parseInt(addPayment), paymentMethod);
      }
    },
    onSuccess: () => {
      toast.success("Member updated");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
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
                    {p.label}
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
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Payment Status</div>
                <div className="text-xs text-muted-foreground">
                  {member.subscription.isPaid ? "Fully Paid" : "Balance Due"}
                </div>
              </div>
              <div className="text-right text-xs">
                <div>Total: ₹{member.subscription.pricePerMonth}</div>
                <div>Paid: ₹{member.subscription.amountPaid}</div>
                {member.subscription.dueAmount > 0 && (
                  <div className="font-bold text-destructive">
                    Due: ₹{member.subscription.dueAmount}
                  </div>
                )}
              </div>
            </div>
            {!member.subscription.isPaid && (
              <div className="mt-2 space-y-2 border-t pt-2">
                <div className="flex items-center gap-2">
                  <Label className="w-24 whitespace-nowrap text-xs">Add Amount</Label>
                  <Input
                    type="number"
                    placeholder="Enter amount..."
                    value={addPayment}
                    onChange={(e) => setAddPayment(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-24 whitespace-nowrap text-xs">Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-8">
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
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
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
  const projectedExpiry = formatDate(addDaysISO(todayISO(), totalDaysAdded));

  const renewM = useMutation({
    mutationFn: () =>
      membersApi.renew(member.memberId, {
        planId,
        amountPaid: amountPaidNum,
        paymentMethod,
        applyAbsenceCredits,
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
                {formatDate(addDaysISO(todayISO(), (selectedPlan?.durationMonths ?? 1) * 30))}
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

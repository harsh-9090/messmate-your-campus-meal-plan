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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Search, Plus, RefreshCw, Trash2, Edit3, Loader2, Download, CreditCard, Gift, FileText, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { exportDuesPdf } from "@/lib/messmate/exportDuesPdf";
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
import {
  ViewMemberDialog,
  RenewMemberDialog,
  RecordPaymentDialog,
} from "@/components/messmate/MemberAdminDialogs";

import { PAYMENT_METHODS } from "@/lib/messmate/constants";

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Members - Mom's Kitchen Admin" }] }),
  component: MembersPage,
});

function MembersPage() {
  useSSE();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "expired" | "unpaid" | "pending" | "left">("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "member_id" | "expiry_date">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [renewing, setRenewing] = useState<Member | null>(null);
  const [paying, setPaying] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [leavingMember, setLeavingMember] = useState<Member | null>(null);
  const [leaveReason, setLeaveReason] = useState("");
  const [reactivatingMember, setReactivatingMember] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [page, setPage] = useState(1);

  // Bulk selection for expired members
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLeavingOpen, setBulkLeavingOpen] = useState(false);
  const [bulkLeaveReason, setBulkLeaveReason] = useState("");

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

  // Only expired members can be selected for left mess
  const expiredMembersOnPage = useMemo(() => {
    return members.filter((m) => daysRemaining(m.subscription?.endDate) < 0 && !m.isLeft);
  }, [members]);

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const toggleAllExpired = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      expiredMembersOnPage.forEach((m) => next.add(m.memberId));
    } else {
      expiredMembersOnPage.forEach((m) => next.delete(m.memberId));
    }
    setSelectedIds(next);
  };

  const selectedMemberList = useMemo(() => {
    return members.filter((m) => selectedIds.has(m.memberId));
  }, [members, selectedIds]);

  const totalSelectedDue = useMemo(() => {
    return selectedMemberList.reduce((sum, m) => sum + (m.subscription?.dueAmount || 0), 0);
  }, [selectedMemberList]);

  const selectedWithDuesCount = useMemo(() => {
    return selectedMemberList.filter(
      (m) => (m.subscription?.dueAmount || 0) > 0 || !m.subscription?.isPaid,
    ).length;
  }, [selectedMemberList]);

  const handleSearch = (v: string) => {
    setSearch(v);
    setSelectedIds(new Set());
    setPage(1);
  };
  const handleStatus = (v: any) => {
    setStatus(v);
    setSelectedIds(new Set());
    if (v === "expired") {
      setSortBy("expiry_date");
      setSortOrder("desc");
    } else if (sortBy === "expiry_date") {
      setSortBy("created_at");
      setSortOrder("desc");
    }
    setPage(1);
  };
  const handlePlanFilter = (v: string) => {
    setPlanFilter(v);
    setSelectedIds(new Set());
    setPage(1);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["members"] });

  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportDuesPDF = async () => {
    setExportingPdf(true);
    try {
      const res = await membersApi.list({ limit: 10000 });
      exportDuesPdf(res.items || []);
      toast.success("Expired & Dues PDF downloaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to export Dues PDF");
    } finally {
      setExportingPdf(false);
    }
  };

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
  const markLeftM = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      membersApi.markLeft(id, { reason }),
    onSuccess: () => {
      toast.success("Member marked as left mess");
      setLeavingMember(null);
      setLeaveReason("");
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark member as left");
    },
  });
  const reactivateM = useMutation({
    mutationFn: (id: string) => membersApi.reactivate(id),
    onSuccess: () => {
      toast.success("Member reactivated successfully");
      setReactivatingMember(null);
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reactivate member");
    },
  });
  const bulkMarkLeftM = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason?: string }) =>
      membersApi.bulkMarkLeft(ids, { reason }),
    onSuccess: (data) => {
      toast.success(`${data.count || selectedIds.size} member(s) marked as left mess`);
      setSelectedIds(new Set());
      setBulkLeavingOpen(false);
      setBulkLeaveReason("");
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark selected members as left mess");
    },
  });

  const birthdays = birthdaysQ.data ?? [];

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {membersQ.isLoading ? "Loading…" : `${total} member${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExportDuesPDF}
              disabled={exportingPdf}
              className="h-9 justify-center text-xs sm:text-sm shadow-sm"
            >
              {exportingPdf ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-3.5 w-3.5 text-destructive" />
              )}
              <span>Dues PDF</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={exporting}
              className="h-9 justify-center text-xs sm:text-sm shadow-sm"
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              <span>Export CSV</span>
            </Button>
          </div>
          <Button
            onClick={() => setAdding(true)}
            disabled={!plans.length}
            className="h-9 justify-center font-semibold shadow-sm w-full sm:w-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Member
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
                Wish a happy birthday to: <span className="font-medium text-pink-900 dark:text-pink-200 cursor-help" title={birthdays.map(m => m.name).join(", ")}>
                  {birthdays.length > 3 
                    ? `${birthdays.slice(0, 3).map(m => m.name).join(", ")} and ${birthdays.length - 3} others`
                    : birthdays.map(m => m.name).join(", ")}
                </span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-auto sm:min-w-64 sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 w-full"
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
            <Select value={status} onValueChange={(v: any) => handleStatus(v)}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="left">Left Mess</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={handlePlanFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
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

            <div className="col-span-2 sm:col-span-1">
              <Select
                value={`${sortBy}-${sortOrder}`}
                onValueChange={(val) => {
                  const [by, order] = val.split("-") as [any, any];
                  setSortBy(by);
                  setSortOrder(order);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[185px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at-desc">Newly Joined</SelectItem>
                  <SelectItem value="created_at-asc">Oldest Joined</SelectItem>
                  <SelectItem value="member_id-asc">Member ID: Low to High</SelectItem>
                  <SelectItem value="member_id-desc">Member ID: High to Low</SelectItem>
                  <SelectItem value="expiry_date-desc">Recently Expired (1d, 2d...)</SelectItem>
                  <SelectItem value="expiry_date-asc">Longest Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-card/95 backdrop-blur-md p-4 shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white shadow-sm">
              {selectedIds.size}
            </span>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {selectedIds.size} Expired Member{selectedIds.size > 1 ? "s" : ""} Selected
              </div>
              <div className="text-xs text-muted-foreground">
                Only expired members can be marked as left mess
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-9 text-xs"
            >
              Clear Selection
            </Button>
            <Button
              size="sm"
              className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm flex-1 sm:flex-initial"
              onClick={() => {
                setBulkLeaveReason("");
                setBulkLeavingOpen(true);
              }}
            >
              <UserX className="mr-1.5 h-4 w-4" />
              Mark as Left Mess ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

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
            {!membersQ.isLoading && !membersQ.isError && expiredMembersOnPage.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAllExpiredMobile"
                    checked={expiredMembersOnPage.every((m) => selectedIds.has(m.memberId))}
                    onCheckedChange={(checked) => toggleAllExpired(!!checked)}
                  />
                  <label htmlFor="selectAllExpiredMobile" className="font-medium cursor-pointer text-foreground select-none">
                    Select All Expired ({expiredMembersOnPage.length})
                  </label>
                </div>
                {selectedIds.size > 0 && (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>
            )}
            {!membersQ.isLoading &&
              !membersQ.isError &&
              members.map((m) => {
                const left = daysRemaining(m.subscription.endDate);
                const expired = left < 0;
                const canRenew = expired || left <= 2;
                const startsIn = m.subscription.startDate ? daysRemaining(m.subscription.startDate) : 0;
                const startsInFuture = startsIn > 0;
                const planDietType = plans.find((p) => p.planId === m.subscription.planId)?.dietType;
                return (
                  <div
                    key={m.memberId}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm cursor-pointer hover:border-primary/50 transition-colors",
                      selectedIds.has(m.memberId) && "border-amber-500/60 bg-amber-500/5",
                    )}
                    onClick={() => setViewingMember(m)}
                  >
                    <div className="flex items-start justify-between gap-2 border-b pb-3">
                      <div className="flex items-center gap-3">
                        {expired && !m.isLeft ? (
                          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                            <Checkbox
                              checked={selectedIds.has(m.memberId)}
                              onCheckedChange={(c) => toggleOne(m.memberId, !!c)}
                              aria-label={`Select ${m.name}`}
                              className="shrink-0"
                            />
                          </div>
                        ) : (
                          <div onClick={(e) => e.stopPropagation()} className="pt-0.5" title={m.isLeft ? "Already left mess" : "Only expired members can be selected"}>
                            <Checkbox
                              disabled
                              className="shrink-0 opacity-25 cursor-not-allowed"
                            />
                          </div>
                        )}
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground overflow-hidden">
                          {m.photoUrl ? (
                            <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            (m.name || "U")
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                          )}
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
                      <div className="flex flex-col items-end gap-1">
                        {m.isLeft ? (
                          <Badge
                            variant="outline"
                            className="border-zinc-500 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800"
                          >
                            Left Mess
                          </Badge>
                        ) : (
                          <>
                            {!m.isActive && (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-500 bg-amber-50"
                              >
                                Pending
                              </Badge>
                            )}
                            {m.isActive && !m.subscription.isPaid && (
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
                            )}
                            {m.isActive && expired && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                            {m.isActive && startsInFuture && (
                              <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500">Starts Soon</Badge>
                            )}
                            {m.isActive && m.subscription.isPaid && !expired && !startsInFuture && (
                              <Badge className="bg-success text-success-foreground">Active</Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div
                        className={cn(
                          "text-xs font-medium",
                          m.isLeft && "text-muted-foreground",
                          !m.isLeft && expired && "text-destructive",
                          !m.isLeft && !expired && !startsInFuture && left <= 3 && "text-warning",
                          !m.isLeft && !expired && !startsInFuture && left > 3 && "text-muted-foreground",
                          !m.isLeft && startsInFuture && "text-blue-500"
                        )}
                      >
                        {m.isLeft
                          ? (m.leftAt ? `Left on ${formatDate(m.leftAt)}` : "Left Mess")
                          : (m.subscription.endDate || m.createdAt)
                          ? (expired ? `Expired ${-left}d ago` : startsInFuture ? `Starts in ${startsIn}d` : `${left}d remaining`)
                          : "No active plan"}
                      </div>
                      <div className="flex justify-end gap-2">
                        {!m.isLeft && !m.subscription.isPaid && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-primary text-primary hover:bg-primary/10"
                            onClick={(e) => { e.stopPropagation(); setPaying(m); }}
                            title="Record Payment"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); setEditing(m); }}
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        {!m.isLeft && (
                          <div title={!canRenew ? "Can only renew when expired or within 2 days of expiration" : undefined}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={(e) => { e.stopPropagation(); setRenewing(m); }}
                              disabled={!canRenew}
                              title="Renew"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {m.isLeft ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={(e) => { e.stopPropagation(); setReactivatingMember(m); }}
                            title="Reactivate Member"
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        ) : (
                          <div title={!expired ? "Member must be expired before marking as left mess" : undefined}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 border-amber-500/60 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={(e) => { e.stopPropagation(); setLeavingMember(m); setLeaveReason(""); }}
                              disabled={!expired}
                              title={expired ? "Discontinue / Left Mess" : undefined}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); setDeletingMember(m); }}
                          title="Delete Permanently"
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
                  <th className="w-10 px-4 py-3 text-left">
                    <div title={expiredMembersOnPage.length === 0 ? "No expired members to select on this page" : "Select all expired members on page"}>
                      <Checkbox
                        checked={
                          expiredMembersOnPage.length > 0 &&
                          expiredMembersOnPage.every((m) => selectedIds.has(m.memberId))
                        }
                        onCheckedChange={(checked) => toggleAllExpired(!!checked)}
                        disabled={expiredMembersOnPage.length === 0}
                        aria-label="Select all expired members"
                      />
                    </div>
                  </th>
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
                        <td className="w-10 px-4 py-4">
                          <div className="h-4 w-4 rounded bg-emerald-950/10 dark:bg-emerald-950/20" />
                        </td>
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
                    <td colSpan={8} className="py-10 text-center text-destructive font-medium">
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
                    const startsIn = m.subscription.startDate ? daysRemaining(m.subscription.startDate) : 0;
                    const startsInFuture = startsIn > 0;
                    const planDietType = plans.find((p) => p.planId === m.subscription.planId)?.dietType;
                    return (
                      <tr
                        key={m.memberId}
                        className={cn(
                          "border-t hover:bg-muted/30 transition-colors cursor-pointer",
                          selectedIds.has(m.memberId) && "bg-amber-500/5 hover:bg-amber-500/10",
                        )}
                        onClick={() => setViewingMember(m)}
                      >
                        <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {expired && !m.isLeft ? (
                            <Checkbox
                              checked={selectedIds.has(m.memberId)}
                              onCheckedChange={(checked) => toggleOne(m.memberId, !!checked)}
                              aria-label={`Select ${m.name}`}
                            />
                          ) : (
                            <div title={m.isLeft ? "Member has already left mess" : "Only expired members can be selected"}>
                              <Checkbox
                                disabled
                                className="opacity-25 cursor-not-allowed"
                                aria-label="Cannot select active or already left member"
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground overflow-hidden">
                              {m.photoUrl ? (
                                <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                (m.name || "U")
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                              )}
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
                            m.isLeft && "text-muted-foreground",
                            !m.isLeft && expired && "text-destructive font-semibold",
                            !m.isLeft &&
                            !startsInFuture &&
                            left <= 3 &&
                            (m.subscription.endDate || m.createdAt) &&
                            "text-warning font-semibold",
                            !m.isLeft && startsInFuture && "text-blue-500 font-semibold"
                          )}
                        >
                          {m.isLeft ? (
                            <div>
                              <div className="font-medium text-foreground">{m.leftAt ? formatDate(m.leftAt) : "Left Mess"}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={m.leftReason || undefined}>
                                {m.leftReason || "Discontinued"}
                              </div>
                            </div>
                          ) : (
                            <>
                              {formatDate(m.subscription.endDate || addDaysISO(m.createdAt, 30))}
                              {(m.subscription.endDate || m.createdAt) && (
                                <div className="text-[10px] text-muted-foreground">
                                  {expired ? `${-left}d ago` : startsInFuture ? `Starts in ${startsIn}d` : `${left}d left`}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            {m.isLeft ? (
                              <Badge
                                variant="outline"
                                className="border-zinc-500 text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800"
                              >
                                Left Mess
                              </Badge>
                            ) : (
                              <>
                                {!m.isActive && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500 text-amber-500 bg-amber-50"
                                  >
                                    Pending
                                  </Badge>
                                )}
                                {m.isActive && !m.subscription.isPaid && (
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
                                )}
                                {m.isActive && expired && (
                                  <Badge variant="destructive">Expired</Badge>
                                )}
                                {m.isActive && startsInFuture && (
                                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500">Starts Soon</Badge>
                                )}
                                {m.isActive && m.subscription.isPaid && !expired && !startsInFuture && (
                                  <Badge className="bg-success text-success-foreground">Active</Badge>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {!m.isLeft && !m.subscription.isPaid && (
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
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(m); }} title="Edit">
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            {!m.isLeft && (
                              <div title={!canRenew ? "Can only renew when expired or within 2 days of expiration" : undefined}>
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setRenewing(m); }} disabled={!canRenew} title="Renew">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                            {m.isLeft ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={(e) => { e.stopPropagation(); setReactivatingMember(m); }}
                                title="Reactivate Member"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <div title={!expired ? "Member must be expired before marking as left mess" : undefined}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                  onClick={(e) => { e.stopPropagation(); setLeavingMember(m); setLeaveReason(""); }}
                                  disabled={!expired}
                                  title={expired ? "Discontinue / Left Mess" : undefined}
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); setDeletingMember(m); }}
                              title="Delete Permanently"
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
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
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

      {/* Discontinue / Left Mess Dialog */}
      <Dialog open={leavingMember !== null} onOpenChange={(open) => !open && setLeavingMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <UserX className="h-5 w-5" />
              Mark Member as Left Mess
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirm marking this student as discontinued from the mess.
            </DialogDescription>
          </DialogHeader>
          {leavingMember && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to mark <span className="font-semibold text-foreground">{leavingMember.name}</span> ({leavingMember.memberId}) as having left the mess?
              </p>

              <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">What this does:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Removes student from daily active and expired renewal lists.</li>
                  <li>Keeps their complete profile, attendance, and payment history safe.</li>
                  <li>Allows 1-click reactivation anytime if the student rejoins.</li>
                </ul>
              </div>

              {(leavingMember.subscription.dueAmount > 0 || !leavingMember.subscription.isPaid) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-start gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Notice: Pending Dues</span>
                    <p className="mt-0.5">
                      This member has pending dues of ₹{leavingMember.subscription.dueAmount || Math.max(0, (leavingMember.subscription.pricePerMonth || 0) - (leavingMember.subscription.amountPaid || 0))}.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="leave-reason" className="text-xs font-semibold">
                  Reason for Leaving (Optional)
                </Label>
                <Input
                  id="leave-reason"
                  placeholder="e.g. Semester ended, graduated, relocated..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLeavingMember(null)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                if (leavingMember) {
                  markLeftM.mutate({ id: leavingMember.memberId, reason: leaveReason });
                }
              }}
              disabled={markLeftM.isPending}
            >
              {markLeftM.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <UserX className="mr-1.5 h-4 w-4" />
              )}
              Confirm Left Mess
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Discontinue / Left Mess Dialog */}
      <Dialog open={bulkLeavingOpen} onOpenChange={(open) => !open && setBulkLeavingOpen(false)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <UserX className="h-5 w-5" />
              Mark {selectedIds.size} Expired Member{selectedIds.size > 1 ? "s" : ""} as Left Mess
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Discontinue multiple expired members at once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark <span className="font-semibold text-foreground">{selectedIds.size} expired member{selectedIds.size > 1 ? "s" : ""}</span> as having left the mess?
            </p>

            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">What this does:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Removes selected students from daily active and expired renewal lists.</li>
                <li>All historical attendance, transactions, and records remain completely safe.</li>
                <li>You can reactivate any profile individually if a student returns.</li>
              </ul>
            </div>

            {selectedWithDuesCount > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-start gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Notice: Pending Dues</span>
                  <p className="mt-0.5">
                    {selectedWithDuesCount} of the selected members have pending dues (Total: ₹{totalSelectedDue}). These records will remain saved.
                  </p>
                </div>
              </div>
            )}

            {/* List preview of selected students */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Selected Members ({selectedMemberList.length})</Label>
              <div className="max-h-28 overflow-y-auto rounded-lg border bg-muted/20 p-2 flex flex-wrap gap-1.5 text-xs">
                {selectedMemberList.map((m) => (
                  <Badge key={m.memberId} variant="secondary" className="text-[11px] font-normal py-0.5">
                    {m.name} ({m.memberId})
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-leave-reason" className="text-xs font-semibold">
                Reason for Leaving (Optional)
              </Label>
              <Input
                id="bulk-leave-reason"
                placeholder="e.g. End of semester, graduation, batch completed..."
                value={bulkLeaveReason}
                onChange={(e) => setBulkLeaveReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkLeavingOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                bulkMarkLeftM.mutate({
                  ids: Array.from(selectedIds),
                  reason: bulkLeaveReason,
                });
              }}
              disabled={bulkMarkLeftM.isPending}
            >
              {bulkMarkLeftM.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <UserX className="mr-1.5 h-4 w-4" />
              )}
              Confirm ({selectedIds.size}) Left Mess
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={reactivatingMember !== null}
        onClose={() => setReactivatingMember(null)}
        onConfirm={() => {
          if (reactivatingMember) {
            reactivateM.mutate(reactivatingMember.memberId);
          }
        }}
        title="Reactivate Member?"
        description={`Reactivate ${reactivatingMember?.name}? They will be restored to your active members list so you can renew or update their meal plan.`}
        confirmText="Reactivate"
        isPending={reactivateM.isPending}
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
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" />
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
  const [startDate, setStartDate] = useState(
    member.subscription.startDate ? member.subscription.startDate.split('T')[0] : ""
  );

  const historyQ = useQuery({
    queryKey: ["member-history", member.memberId],
    queryFn: () => membersApi.getHistory(member.memberId),
  });

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
      await membersApi.changePlan(member.memberId, { planId, meals, startDate });
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

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="history">History & Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-3 mt-0">
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
            <div className="grid sm:grid-cols-2 gap-3">
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
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
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
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {historyQ.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyQ.isError ? (
              <div className="text-center py-8 text-destructive text-sm">Failed to load history.</div>
            ) : (
              <div className="space-y-4">
                {/* Analytics Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Total Days</div>
                    <div className="text-lg font-display font-bold text-primary">
                      {historyQ.data?.reduce((acc, row) => {
                        const start = new Date(row.start_date);
                        const end = new Date(row.end_date);
                        const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        return acc + Math.max(0, days);
                      }, 0)}
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Renewals</div>
                    <div className="text-lg font-display font-bold text-primary">{historyQ.data?.length || 0}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center border border-border/50">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">LTV</div>
                    <div className="text-lg font-display font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{historyQ.data?.reduce((acc, row) => acc + (row.amount_paid || 0), 0)}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <ScrollArea className="h-[280px] pr-3 rounded-md">
                  <div className="space-y-3">
                    {historyQ.data?.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-4">No subscription history found.</div>
                    ) : (
                      historyQ.data?.map((sub, i) => (
                        <div key={sub.id} className="relative pl-6 pb-4 border-l border-border/40 last:border-l-0 last:pb-0">
                          {/* Timeline dot */}
                          <div className="absolute left-[-5px] top-[2px] w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                          
                          <div className="bg-muted/10 border border-border/40 rounded-xl p-3 hover:bg-muted/20 transition-colors">
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-bold text-sm text-foreground">
                                {sub.plan_label || "Custom Plan"}
                              </div>
                              <Badge variant={sub.status === "active" ? "default" : sub.status === "expired" ? "destructive" : "secondary"} className="text-[9px] uppercase">
                                {sub.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                              <span>{formatDate(sub.start_date)}</span>
                              <span>→</span>
                              <span>{formatDate(sub.end_date)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                              <div className="flex gap-1 text-[10px] text-muted-foreground font-semibold">
                                {sub.meals?.join(", ")}
                              </div>
                              <div className="text-xs font-bold text-foreground">
                                ₹{sub.amount_paid}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
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

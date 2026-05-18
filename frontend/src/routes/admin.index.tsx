import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, configApi, reportsApi, usageApi } from "@/lib/messmate/api";
import { StatCard } from "@/components/messmate/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  CreditCard,
  AlertTriangle,
  IndianRupee,
  UtensilsCrossed,
  RefreshCw,
  UserPlus,
  Repeat,
  Clock,
  Coins,
} from "lucide-react";
import {
  todayISO,
  daysRemaining,
  formatINR,
  formatDate,
  isWithinWindow,
  formatTime12h,
} from "@/lib/messmate/dateHelpers";
import { PlanBadge } from "@/components/messmate/PlanBadge";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Member } from "@/lib/messmate/types";
import { GhostLoader } from "@/components/messmate/GhostLoader";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard - Mom's Kitchen Admin" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const membersQ = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => membersApi.list({ limit: 500 }),
  });
  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const summaryQ = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: () => usageApi.summaryToday(),
    refetchInterval: 30_000,
  });
  const expiringQ = useQuery({
    queryKey: ["reports", "expiring", 3],
    queryFn: () => reportsApi.expiring(3),
  });
  const statsQ = useQuery({
    queryKey: ["reports", "daily-stats"],
    queryFn: () => reportsApi.getDailyStats(),
    refetchInterval: 60_000,
  });

  const [viewingList, setViewingList] = useState<{ title: string; members: Member[] } | null>(null);

  const renewM = useMutation({
    mutationFn: (id: string) => membersApi.renew(id, {}),
    onSuccess: () => {
      toast.success("Plan renewed");
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["reports", "expiring", 3] });
    },
  });

  const members = membersQ.data?.items ?? [];
  const windows = windowsQ.data ?? [];
  const summary = summaryQ.data ?? { Breakfast: 0, Lunch: 0, Dinner: 0, total: 0 };
  const stats = statsQ.data ?? {
    new_members: 0,
    renewed_members: 0,
    expired_members: 0,
    collection: 0,
    new_list: [],
    renewed_list: [],
    expired_list: [],
  };
  const expiringSoon = (expiringQ.data ?? []).sort(
    (a, b) => daysRemaining(a.subscription.endDate) - daysRemaining(b.subscription.endDate),
  );

  const today = todayISO();
  const active = members.filter(
    (m) => m.subscription.isPaid && daysRemaining(m.subscription.endDate) >= 0,
  );
  const expired = members.filter((m) => daysRemaining(m.subscription.endDate) < 0);
  const revenue = active.reduce((s, m) => s + m.subscription.pricePerMonth, 0);

  const planCounts: Record<string, number> = {};
  members.forEach((m) => {
    planCounts[m.subscription.planLabel] = (planCounts[m.subscription.planLabel] || 0) + 1;
  });
  const planChart = Object.entries(planCounts).map(([name, value]) => ({ name, value }));
  const COLORS = [
    "hsl(245 75% 60%)",
    "hsl(150 60% 50%)",
    "hsl(40 95% 60%)",
    "hsl(0 75% 60%)",
    "hsl(220 70% 60%)",
    "hsl(290 60% 60%)",
  ];

  if (membersQ.isLoading) {
    return <GhostLoader size="fullscreen" />;
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{formatDate(today)} · Live overview</p>
        </div>
      </header>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">
          Today's Summary (IST)
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <div
            className="cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => setViewingList({ title: "New Joins Today", members: stats.new_list })}
          >
            <StatCard
              icon={UserPlus}
              label="New Joins"
              value={stats.new_members}
              accent="primary"
            />
          </div>
          <div
            className="cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => setViewingList({ title: "Renewals Today", members: stats.renewed_list })}
          >
            <StatCard
              icon={Repeat}
              label="Renewals"
              value={stats.renewed_members}
              accent="success"
            />
          </div>
          <div
            className="cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => setViewingList({ title: "Expired Today", members: stats.expired_list })}
          >
            <StatCard
              icon={Clock}
              label="Expired Today"
              value={stats.expired_members}
              accent="destructive"
            />
          </div>
          <StatCard
            icon={Coins}
            label="Today's Collection"
            value={formatINR(stats.collection)}
            accent="success"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">
          Overall Metrics
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard icon={Users} label="Total Members" value={members.length} accent="primary" />
          <StatCard icon={CreditCard} label="Active Plans" value={active.length} accent="success" />
          <StatCard
            icon={AlertTriangle}
            label="Expired"
            value={expired.length}
            accent="destructive"
          />
          <StatCard
            icon={UtensilsCrossed}
            label="Meals Today"
            value={summary.total}
            accent="primary"
            hint={`${summary.Breakfast}B · ${summary.Lunch}L · ${summary.Dinner}D`}
          />
          <StatCard
            icon={IndianRupee}
            label="Monthly Revenue"
            value={formatINR(revenue)}
            accent="success"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-bold">Members by Plan</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={planChart}>
                <XAxis dataKey="name" stroke="currentColor" fontSize={11} />
                <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {planChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Meal Windows</h3>
          <div className="space-y-2">
            {windows.map((w) => {
              const open = isWithinWindow(new Date(), w);
              const served = summary[w.meal];
              return (
                <div
                  key={w.meal}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-semibold">{w.meal}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime12h(w.startTime)} – {formatTime12h(w.endTime)}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={
                        open
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {open ? "OPEN" : "Closed"}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">{served} served</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Expiring Soon</h3>
          <Badge variant="secondary">{expiringSoon.length} members</Badge>
        </div>
        {expiringSoon.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No plans expiring in the next 3 days.
          </p>
        ) : (
          <div className="space-y-2">
            {expiringSoon.map((m) => {
              const left = daysRemaining(m.subscription.endDate);
              return (
                <div
                  key={m.memberId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="font-medium">
                        {m.name}{" "}
                        <span className="text-xs text-muted-foreground">· {m.memberId}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <PlanBadge
                          planId={m.subscription.planId}
                          label={m.subscription.planLabel}
                        />
                        <span className="ml-2">
                          expires in{" "}
                          <span className="font-semibold text-warning">
                            {left} day{left === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={renewM.isPending}
                    onClick={() => renewM.mutate(m.memberId)}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> Renew
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {viewingList && (
        <StatsDetailDialog
          title={viewingList.title}
          members={viewingList.members}
          onClose={() => setViewingList(null)}
        />
      )}
    </div>
  );
}

function StatsDetailDialog({
  title,
  members,
  onClose,
}: {
  title: string;
  members: Member[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] rounded-2xl flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex flex-col items-center text-center">
            <div className="mb-2 rounded-full bg-primary/10 p-3 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Showing {members.length} member{members.length === 1 ? "" : "s"}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {members.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No members found for this category today.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {members.slice(0, 100).map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center justify-between gap-4 rounded-xl border bg-accent/30 p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background text-sm font-bold text-primary shadow-sm border">
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{m.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        {m.memberId} {m.mobile && <span>· {m.mobile}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <PlanBadge planId={m.subscription.planId} label={m.subscription.planLabel} />
                    <div className="mt-1 text-[10px] font-medium text-muted-foreground">
                      Ends {formatDate(m.subscription.endDate)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-muted/30">
          <Button className="w-full" variant="outline" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

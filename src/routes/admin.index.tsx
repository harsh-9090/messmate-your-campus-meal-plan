import { createFileRoute } from "@tanstack/react-router";
import { useMess } from "@/lib/messmate/store";
import { StatCard } from "@/components/messmate/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, AlertTriangle, IndianRupee, UtensilsCrossed, RefreshCw } from "lucide-react";
import { todayISO, daysRemaining, formatINR, formatDate, isWithinWindow, formatTime12h } from "@/lib/messmate/dateHelpers";
import { PlanBadge } from "@/components/messmate/PlanBadge";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — MessMate Admin" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const members = useMess((s) => s.members.filter((m) => m.role === "member" && m.isActive));
  const windows = useMess((s) => s.windows);
  const usage = useMess((s) => s.usage);
  const logs = useMess((s) => s.logs);
  const renew = useMess((s) => s.renewMember);

  const today = todayISO();
  const active = members.filter((m) => m.subscription.isPaid && daysRemaining(m.subscription.endDate) >= 0);
  const expired = members.filter((m) => daysRemaining(m.subscription.endDate) < 0);
  const expiringSoon = members
    .filter((m) => { const d = daysRemaining(m.subscription.endDate); return d >= 0 && d <= 3; })
    .sort((a, b) => daysRemaining(a.subscription.endDate) - daysRemaining(b.subscription.endDate));

  const todaysLogs = logs.filter((l) => l.date === today);
  const allowedToday = todaysLogs.filter((l) => l.status === "allowed").length;
  const revenue = active.reduce((s, m) => s + m.subscription.pricePerMonth, 0);
  const todaysUsage = usage.filter((u) => u.date === today);
  const mealsByType = {
    Breakfast: todaysUsage.filter((u) => u.usedMeals.Breakfast).length,
    Lunch: todaysUsage.filter((u) => u.usedMeals.Lunch).length,
    Dinner: todaysUsage.filter((u) => u.usedMeals.Dinner).length,
  };

  // Plan distribution
  const planCounts: Record<string, number> = {};
  members.forEach((m) => { planCounts[m.subscription.planLabel] = (planCounts[m.subscription.planLabel] || 0) + 1; });
  const planChart = Object.entries(planCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ["hsl(245 75% 60%)", "hsl(150 60% 50%)", "hsl(40 95% 60%)", "hsl(0 75% 60%)", "hsl(220 70% 60%)", "hsl(290 60% 60%)"];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{formatDate(today)} · Live overview</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label="Total Members" value={members.length} accent="primary" />
        <StatCard icon={CreditCard} label="Active Plans" value={active.length} accent="success" />
        <StatCard icon={AlertTriangle} label="Expired" value={expired.length} accent="destructive" />
        <StatCard icon={UtensilsCrossed} label="Meals Today" value={allowedToday} accent="primary" hint={`${mealsByType.Breakfast}B · ${mealsByType.Lunch}L · ${mealsByType.Dinner}D`} />
        <StatCard icon={IndianRupee} label="Monthly Revenue" value={formatINR(revenue)} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Plan distribution */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-bold">Members by Plan</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={planChart}>
                <XAxis dataKey="name" stroke="currentColor" fontSize={11} />
                <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {planChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Meal windows */}
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Meal Windows</h3>
          <div className="space-y-2">
            {windows.map((w) => {
              const open = isWithinWindow(new Date(), w);
              const served = mealsByType[w.meal];
              return (
                <div key={w.meal} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-semibold">{w.meal}</div>
                    <div className="text-xs text-muted-foreground">{formatTime12h(w.startTime)} – {formatTime12h(w.endTime)}</div>
                  </div>
                  <div className="text-right">
                    <Badge className={open ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
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

      {/* Expiry alerts */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Expiring Soon</h3>
          <Badge variant="secondary">{expiringSoon.length} members</Badge>
        </div>
        {expiringSoon.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No plans expiring in the next 3 days.</p>
        ) : (
          <div className="space-y-2">
            {expiringSoon.map((m) => {
              const left = daysRemaining(m.subscription.endDate);
              return (
                <div key={m.memberId} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {m.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="font-medium">{m.name} <span className="text-xs text-muted-foreground">· {m.memberId}</span></div>
                      <div className="text-xs text-muted-foreground">
                        <PlanBadge planId={m.subscription.planId} label={m.subscription.planLabel} />
                        <span className="ml-2">expires in <span className="font-semibold text-warning">{left} day{left === 1 ? "" : "s"}</span></span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => { renew(m.memberId); toast.success(`${m.name} renewed for 30 days`); }}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Renew
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

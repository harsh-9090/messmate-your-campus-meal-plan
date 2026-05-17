import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/messmate/auth";
import { membersApi, scanApi, configApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCanvas } from "@/components/messmate/QRCanvas";
import { SubscriptionBar } from "@/components/messmate/SubscriptionBar";
import { MealChip } from "@/components/messmate/MealChip";
import { PlanBadge } from "@/components/messmate/PlanBadge";
import { Lock, AlertTriangle, History, LogOut, UtensilsCrossed, Loader2 } from "lucide-react";
import { daysRemaining, formatINR, formatTimestamp, isWithinWindow } from "@/lib/messmate/dateHelpers";
import { MEALS } from "@/lib/messmate/constants";
import type { Meal } from "@/lib/messmate/types";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";

export const Route = createFileRoute("/member/")({
  head: () => ({
    meta: [
      { title: "My Meals — MessMate" },
      { name: "description", content: "Your dynamic QR code, today's meal status, and 30-day plan progress." },
    ],
  }),
  component: MemberPortal,
});

function MemberPortal() {
  const authUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const meQ = useQuery({
    queryKey: ["member", authUser?.id],
    queryFn: () => membersApi.get(authUser!.id),
    enabled: !!authUser,
  });
  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const logsQ = useQuery({
    queryKey: ["my-logs"],
    queryFn: () => scanApi.logs({ limit: 14 }),
    enabled: !!authUser,
    refetchInterval: 15_000,
  });

  if (!authUser) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Button onClick={() => navigate({ to: "/login" })}>Sign in</Button>
      </div>
    );
  }
  if (meQ.isLoading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (meQ.isError || !meQ.data) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-destructive">Couldn't load your profile.</p>
          <p className="mt-1 text-sm text-muted-foreground">Make sure the backend is running.</p>
          <Button className="mt-4" onClick={() => meQ.refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const me = meQ.data;
  const sub = me.subscription;
  
  // Calculate grace period: 3 days from start
  const daysSinceStart = Math.max(0, daysRemaining(sub.startDate) * -1);
  const gracePeriod = 3;
  const inGracePeriod = !sub.isPaid && daysSinceStart <= gracePeriod;
  
  const left = daysRemaining(sub.endDate);
  const expired = left < 0;
  const locked = (!sub.isPaid && !inGracePeriod) || expired;
  
  const windows = windowsQ.data ?? [];
  const myLogs = logsQ.data ?? [];

  // Build today's usage from logs
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysUsed: Record<Meal, boolean> = { Breakfast: false, Lunch: false, Dinner: false };
  myLogs.forEach((l) => {
    if (l.date === todayStr && l.status === "allowed") todaysUsed[l.meal] = true;
  });

  const stateOf = (meal: Meal) => {
    if (!sub.meals.includes(meal)) return "not-in-plan" as const;
    if (todaysUsed[meal]) return "used" as const;
    const w = windows.find((x) => x.meal === meal);
    if (!w || !isWithinWindow(new Date(), w)) return "window-closed" as const;
    return "available" as const;
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-white">
              {me.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="text-sm font-semibold">{me.name}</div>
              <div className="text-xs text-muted-foreground">
                {me.memberId}{me.mobile && <> · 📞 {me.mobile}</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login" onClick={() => logout()}><LogOut className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-primary p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider opacity-70">Current Plan</div>
                <div className="font-display text-2xl font-bold">{sub.planLabel}</div>
                <div className="mt-1 text-sm opacity-80">{formatINR(sub.pricePerMonth)} / month</div>
              </div>
              <div className="text-right">
                <Badge className={sub.isPaid ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                  {sub.isPaid ? "Paid" : "Unpaid"}
                </Badge>
                {sub.dueAmount > 0 && <div className="mt-1 text-[10px] font-bold text-white">Due: {formatINR(sub.dueAmount)}</div>}
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-2xl">
              {sub.meals.includes("Breakfast") && <span>🌅</span>}
              {sub.meals.includes("Lunch") && <span>🍱</span>}
              {sub.meals.includes("Dinner") && <span>🌙</span>}
            </div>
          </div>
          <div className="p-5"><SubscriptionBar sub={sub} /></div>
        </Card>

        {!expired && left <= 3 && sub.isPaid && (
          <Card className="border-warning/40 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <div className="font-semibold">Plan expires in {left} day{left === 1 ? "" : "s"}</div>
                <div className="text-sm text-muted-foreground">Contact admin to renew before it expires.</div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your Pass</div>
              <div className="font-display text-xl font-bold">Scan at counter</div>
            </div>
            <UtensilsCrossed className="h-5 w-5 text-primary" />
          </div>
          <div className="grid place-items-center py-6">
            {locked ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-10 text-center">
                <Lock className="h-10 w-10 text-destructive" />
                <div className="font-display text-xl font-bold text-destructive">
                  {expired ? "Plan Expired" : "Payment Pending"}
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {expired ? "Your 30-day plan has ended. Contact admin to renew."
                           : `Your subscription payment is pending (Due: ${formatINR(sub.dueAmount)}). Contact admin.`}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {inGracePeriod && (
                  <Badge variant="outline" className="border-amber-500 bg-amber-50 text-amber-600">
                    Grace Period: {gracePeriod - daysSinceStart} days left to pay
                  </Badge>
                )}
                <QRCanvas />
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-lg font-bold">Today's Meals</div>
            <PlanBadge planId={sub.planId} label={sub.planLabel} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MEALS.map((m) => <MealChip key={m} meal={m} state={stateOf(m)} />)}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <div className="font-display text-lg font-bold">Recent Scans</div>
          </div>
          {myLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            <div className="space-y-2">
              {myLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <div className="font-medium">{l.meal} <span className="text-xs text-muted-foreground">· {formatTimestamp(l.timestamp)}</span></div>
                    {l.status === "denied" && <div className="text-xs text-destructive">{l.denialReason}</div>}
                  </div>
                  <Badge variant={l.status === "allowed" ? "default" : "destructive"} className={l.status === "allowed" ? "bg-success text-success-foreground" : ""}>
                    {l.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

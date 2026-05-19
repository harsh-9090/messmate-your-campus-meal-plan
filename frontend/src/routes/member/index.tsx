import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/messmate/auth";
import { membersApi, scanApi, configApi, menusApi } from "@/lib/messmate/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCanvas } from "@/components/messmate/QRCanvas";
import { SubscriptionBar } from "@/components/messmate/SubscriptionBar";
import { MealChip } from "@/components/messmate/MealChip";
import { PlanBadge } from "@/components/messmate/PlanBadge";
import {
  Lock,
  AlertTriangle,
  History,
  LogOut,
  UtensilsCrossed,
  CreditCard,
  QrCode,
} from "lucide-react";
import {
  daysRemaining,
  formatINR,
  formatTimestamp,
  isWithinWindow,
  formatTime12h,
  todayISO,
} from "@/lib/messmate/dateHelpers";
import { MEALS } from "@/lib/messmate/constants";
import type { Meal } from "@/lib/messmate/types";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";
import { GhostLoader } from "@/components/messmate/GhostLoader";

export const Route = createFileRoute("/member/")({
  head: () => ({
    meta: [
      { title: "My Meals - Mom's Kitchen" },
      {
        name: "description",
        content: "Your dynamic QR code, today's meal status, and 30-day plan progress.",
      },
    ],
  }),
  component: MemberPortal,
});

function MemberPortal() {
  const authUser = useAuth((s) => s.user);
  const _hasHydrated = useAuth((s) => s._hasHydrated);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"today" | "pass" | "account">("today");
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const todayStr = todayISO();

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
  const menusQ = useQuery({
    queryKey: ["menus", "day", todayStr],
    queryFn: () => menusApi.list({ date: todayStr }),
    enabled: !!authUser,
  });

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!authUser || authUser.role !== "member") navigate({ to: "/login" });
  }, [_hasHydrated, authUser, navigate]);

  if (!_hasHydrated || !authUser) return null;
  if (meQ.isLoading) {
    return <GhostLoader size="fullscreen" />;
  }
  if (meQ.isError || !meQ.data) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-destructive">Couldn't load your profile.</p>
          <p className="mt-1 text-sm text-muted-foreground">Make sure the backend is running.</p>
          <Button className="mt-4" onClick={() => meQ.refetch()}>
            Retry
          </Button>
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
  const todaysUsed: Record<Meal, boolean> = { Breakfast: false, Lunch: false, Dinner: false };
  myLogs.forEach((l) => {
    if (l.date === todayStr && l.status === "allowed") todaysUsed[l.meal] = true;
  });

  const menus = menusQ.data ?? [];
  const activeMeal = windows.find((w) => isWithinWindow(new Date(), w))?.meal;

  const stateOf = (meal: Meal) => {
    if (!sub.meals.includes(meal)) return "not-in-plan" as const;
    if (todaysUsed[meal]) return "used" as const;
    const w = windows.find((x) => x.meal === meal);
    if (!w || !isWithinWindow(new Date(), w)) return "window-closed" as const;
    return "available" as const;
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2 shadow-sm border-b border-white/10 animate-in slide-in-from-top duration-300">
          <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
          <span>Running Offline — Showing cached passes. Your offline code remains fully valid.</span>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl md:max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-white">
              {me.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <div className="text-sm font-semibold">{me.name}</div>
              <div className="text-xs text-muted-foreground">
                {me.memberId}
                {me.mobile && <> · 📞 {me.mobile}</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="cursor-pointer">
              <Link to="/login" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Tactile Mobile Tab Selector (Hidden on md and up) */}
      <div className="md:hidden flex border-b bg-background sticky top-[65px] z-10 p-1 bg-slate-50 dark:bg-slate-900 border-b">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "today"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UtensilsCrossed className="h-4 w-4" /> Today's Menu
        </button>
        <button
          onClick={() => setActiveTab("pass")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "pass"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <QrCode className="h-4 w-4" /> Dining Pass
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "account"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="h-4 w-4" /> Plan & Logs
        </button>
      </div>

      {/* Main Grid: Stacks on mobile, side-by-side on desktop */}
      <main className="mx-auto max-w-2xl md:max-w-7xl space-y-4 md:space-y-0 p-4 md:grid md:grid-cols-12 md:gap-6">
        {/* COLUMN 1: Today's Menu & Meals Status (Visible if activeTab === 'today' on mobile) */}
        <div
          className={`md:col-span-4 space-y-4 ${activeTab === "today" ? "block" : "hidden md:block"}`}
        >
          {/* Today's Menu */}
          <Card className="p-4 sm:p-5 shadow-sm border-border bg-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-base sm:text-lg font-bold flex items-center gap-1.5">
                <span>🍽️</span> Today's Menu
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] font-semibold tracking-wide bg-primary/10 text-primary"
              >
                Fresh & Hygienic
              </Badge>
            </div>
            <div className="space-y-3">
              {menusQ.isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Loading today's menu…
                </div>
              ) : menus.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground italic">
                  No menu items configured for today yet.
                </div>
              ) : (
                (["Breakfast", "Lunch", "Dinner"] as Meal[]).map((mealType) => {
                  const m = menus.find((x) => x.meal === mealType);
                  const isActive = activeMeal === mealType;
                  const w = windows.find((x) => x.meal === mealType);
                  const timeStr = w
                    ? `(${formatTime12h(w.startTime)} - ${formatTime12h(w.endTime)})`
                    : "";

                  return (
                    <div
                      key={mealType}
                      className={cn(
                        "rounded-xl p-3 border transition-all duration-200",
                        isActive
                          ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                          : "bg-muted/10 border-muted/40 opacity-75",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">
                            {mealType === "Breakfast" ? "🍳" : mealType === "Lunch" ? "🍛" : "🍲"}
                          </span>
                          <span className="font-bold text-sm">{mealType}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {timeStr}
                          </span>
                        </div>
                        {isActive && (
                          <Badge className="bg-primary hover:bg-primary text-[9px] font-extrabold tracking-wider px-2 py-0.5 animate-pulse">
                            ACTIVE MEAL
                          </Badge>
                        )}
                      </div>
                      {m && m.items.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {m.items.map((item) => (
                              <span
                                key={item}
                                className="bg-background/80 dark:bg-background/40 border border-border text-foreground px-2 py-0.5 rounded-full text-[11px] font-medium shadow-xs"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          {m.notes && (
                            <p className="text-[11px] text-primary font-semibold italic mt-1 pl-1 border-l-2 border-primary/40">
                              💡 {m.notes}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60 italic pl-1">
                          No items added yet.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Today's Meals Status */}
          <Card className="p-4 sm:p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-display text-base sm:text-lg font-bold">Today's Meals</div>
              <PlanBadge planId={sub.planId} label={sub.planLabel} />
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {MEALS.map((m) => (
                <MealChip key={m} meal={m} state={stateOf(m)} />
              ))}
            </div>
          </Card>
        </div>

        {/* COLUMN 2: Pass & Warnings (Visible if activeTab === 'pass' on mobile) */}
        <div
          className={`md:col-span-4 space-y-4 ${activeTab === "pass" ? "block" : "hidden md:block"}`}
        >
          {/* Expiry Warning */}
          {!expired && left <= 3 && sub.isPaid && (
            <Card className="border-warning/40 bg-warning/10 p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-warning animate-bounce" />
                <div>
                  <div className="font-semibold">
                    Plan expires in {left} day{left === 1 ? "" : "s"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Contact admin to renew before it expires.
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Secure Dining Pass QR */}
          <Card className="p-5 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Your Pass
                </div>
                <div className="font-display text-xl font-bold">Scan at counter</div>
              </div>
              <UtensilsCrossed className="h-5 w-5 text-primary" />
            </div>
            <div className="grid place-items-center py-4">
              {locked ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-destructive/40 bg-destructive/5 p-8 text-center w-full max-w-sm">
                  <Lock className="h-10 w-10 text-destructive" />
                  <div className="font-display text-xl font-bold text-destructive">
                    {expired ? "Plan Expired" : "Payment Pending"}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {expired
                      ? "Your 30-day plan has ended. Contact admin to renew."
                      : `Your subscription payment is pending (Due: ${formatINR(sub.dueAmount)}). Contact admin.`}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 w-full">
                  {inGracePeriod && (
                    <Badge
                      variant="outline"
                      className="border-amber-500 bg-amber-50 text-amber-600"
                    >
                      Grace Period: {gracePeriod - daysSinceStart} days left to pay
                    </Badge>
                  )}
                  <QRCanvas meals={sub.meals} />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* COLUMN 3: Subscription & Historical logs (Visible if activeTab === 'account' on mobile) */}
        <div
          className={`md:col-span-4 space-y-4 ${activeTab === "account" ? "block" : "hidden md:block"}`}
        >
          {/* Subscription Progress Card */}
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="bg-gradient-primary p-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-70">Current Plan</div>
                  <div className="font-display text-2xl font-bold">{sub.planLabel}</div>
                  <div className="mt-1 text-sm opacity-80">
                    {formatINR(sub.pricePerMonth)} / month
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    className={
                      sub.isPaid
                        ? "bg-success text-success-foreground"
                        : "bg-destructive text-destructive-foreground"
                    }
                  >
                    {sub.isPaid ? "Paid" : "Unpaid"}
                  </Badge>
                  {sub.dueAmount > 0 && (
                    <div className="mt-1 text-[10px] font-bold text-white">
                      Due: {formatINR(sub.dueAmount)}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-2xl">
                {sub.meals.includes("Breakfast") && <span>🌅</span>}
                {sub.meals.includes("Lunch") && <span>🍱</span>}
                {sub.meals.includes("Dinner") && <span>🌙</span>}
              </div>
            </div>
            <div className="p-5">
              <SubscriptionBar sub={sub} />
            </div>
          </Card>

          {/* Historical Check-in Scan logs */}
          <Card className="p-4 sm:p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 border-b pb-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <div className="font-display text-lg font-bold">Recent Scans</div>
            </div>
            {myLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No scans yet.</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {myLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm bg-muted/5 hover:bg-muted/10 transition-all"
                  >
                    <div>
                      <div className="font-medium">
                        {l.meal}{" "}
                        <span className="text-[10px] text-muted-foreground font-normal">
                          · {formatTimestamp(l.timestamp)}
                        </span>
                      </div>
                      {l.status === "denied" && (
                        <div className="text-[10px] text-destructive font-medium mt-0.5">
                          {l.denialReason}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={l.status === "allowed" ? "default" : "destructive"}
                      className={l.status === "allowed" ? "bg-success text-success-foreground" : ""}
                    >
                      {l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

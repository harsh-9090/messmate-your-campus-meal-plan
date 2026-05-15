import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMess } from "@/lib/messmate/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanResultScreen } from "@/components/messmate/ScanResult";
import { MEALS, MEAL_ICONS } from "@/lib/messmate/constants";
import { getActiveMeal, formatTime12h, formatTimestamp } from "@/lib/messmate/dateHelpers";
import type { Meal, ScanResult } from "@/lib/messmate/types";
import { Camera, LogOut, UtensilsCrossed, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/scanner")({
  head: () => ({
    meta: [
      { title: "Mess Scanner — MessMate" },
      { name: "description", content: "Staff scanner for mess hall: validate member QR codes against plan, time, and usage." },
    ],
  }),
  component: ScannerPage,
});

function ScannerPage() {
  const me = useMess((s) => s.currentUser());
  const members = useMess((s) => s.members);
  const windows = useMess((s) => s.windows);
  const logs = useMess((s) => s.logs);
  const performScan = useMess((s) => s.performScan);
  const logout = useMess((s) => s.logout);
  const navigate = useNavigate();

  const activeFromTime = getActiveMeal(windows);
  const [meal, setMeal] = useState<Meal>(activeFromTime ?? "Lunch");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  if (!me) { navigate({ to: "/login" }); return null; }

  const window = windows.find((w) => w.meal === meal)!;
  const todayLogs = logs.filter((l) => l.scannedBy === me.memberId).slice(0, 12);

  const doScan = (memberId: string) => {
    setScanning(true);
    setTimeout(() => {
      const r = performScan(memberId, meal, me.memberId);
      setResult(r);
      setScanning(false);
    }, 600);
  };

  if (result) return <ScanResultScreen result={result} onNext={() => setResult(null)} />;

  if (scanning) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="font-display text-2xl font-bold">Validating…</div>
          <p className="mt-1 text-sm text-muted-foreground">Checking plan, expiry & time window</p>
        </div>
      </div>
    );
  }

  const memberOptions = members.filter((m) => m.role === "member" && m.isActive);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 border-b bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-white">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <div>
              <div className="font-display text-base font-bold leading-none">Mess Scanner</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">{me.name}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Link to="/login" onClick={logout}><LogOut className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4">
        {/* Meal slot selector */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current Meal Slot</div>
            <Badge variant={activeFromTime === meal ? "default" : "secondary"} className={activeFromTime === meal ? "bg-success text-success-foreground" : ""}>
              {activeFromTime === meal ? "Window OPEN" : "Window CLOSED"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MEALS.map((m) => (
              <button
                key={m}
                onClick={() => setMeal(m)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  meal === m ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:border-primary/40"
                )}
              >
                <div className="text-2xl">{MEAL_ICONS[m]}</div>
                <div className="font-semibold">{m}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatTime12h(windows.find((w) => w.meal === m)!.startTime)} – {formatTime12h(windows.find((w) => w.meal === m)!.endTime)}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {window && `${meal} window: ${formatTime12h(window.startTime)} – ${formatTime12h(window.endTime)}`}
          </div>
        </Card>

        {/* Scanner */}
        <Card className="p-6">
          <div className="grid place-items-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 text-center">
            <Camera className="mb-3 h-12 w-12 text-primary" />
            <div className="font-display text-xl font-bold">Ready to Scan</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap a member below to simulate a QR scan.
            </p>
          </div>
        </Card>

        {/* Demo: member list to tap */}
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ChevronDown className="h-3 w-3" /> Demo: tap a member to scan
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {memberOptions.map((m) => (
              <button
                key={m.memberId}
                onClick={() => doScan(m.memberId)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {m.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.memberId} · {m.subscription.planLabel}</div>
                </div>
                <Badge variant={m.subscription.isPaid ? "default" : "destructive"} className={cn("text-[10px]", m.subscription.isPaid && "bg-success text-success-foreground")}>
                  {m.subscription.isPaid ? "Paid" : "Unpaid"}
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      </main>

      {/* Recent scans strip */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Today's scans</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {todayLogs.length === 0 && <div className="text-xs text-muted-foreground">No scans yet</div>}
            {todayLogs.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "shrink-0 rounded-md border px-2 py-1 text-[11px]",
                  l.status === "allowed" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                <div className="font-semibold">{l.memberName}</div>
                <div>{l.meal} · {formatTimestamp(l.timestamp).split(",")[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

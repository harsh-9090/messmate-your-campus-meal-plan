import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/messmate/auth";
import { configApi, scanApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScanResultScreen } from "@/components/messmate/ScanResult";
import { MEALS, MEAL_ICONS } from "@/lib/messmate/constants";
import { getActiveMeal, formatTime12h, formatTimestamp } from "@/lib/messmate/dateHelpers";
import type { Meal, ScanResult } from "@/lib/messmate/types";
import { Camera, CameraOff, LogOut, UtensilsCrossed, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const authUser = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const windows = windowsQ.data ?? [];
  const activeFromTime = windows.length ? getActiveMeal(windows) : null;

  const [meal, setMeal] = useState<Meal>("Lunch");
  useEffect(() => { if (activeFromTime) setMeal(activeFromTime); }, [activeFromTime]);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  const logsQ = useQuery({
    queryKey: ["scanner-logs", authUser?.id],
    queryFn: () => scanApi.logs({ limit: 12 }),
    refetchInterval: 5_000,
  });

  const scanM = useMutation({
    mutationFn: (qrToken: string) => scanApi.validate(qrToken, meal),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["scanner-logs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });

  if (!authUser) { navigate({ to: "/login" }); return null; }

  const windowForMeal = windows.find((w) => w.meal === meal);
  const todayLogs = logsQ.data ?? [];

  const onDetect = (token: string) => {
    if (scanM.isPending) return;
    scanM.mutate(token);
  };

  if (result) return <ScanResultScreen result={result} onNext={() => setResult(null)} />;

  if (scanM.isPending) {
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
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">{authUser.name}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Link to="/login" onClick={() => logout()}><LogOut className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current Meal Slot</div>
            <Badge className={activeFromTime === meal ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
              {activeFromTime === meal ? "Window OPEN" : "Window CLOSED"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MEALS.map((m) => {
              const w = windows.find((x) => x.meal === m);
              return (
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
                    {w ? `${formatTime12h(w.startTime)} – ${formatTime12h(w.endTime)}` : "—"}
                  </div>
                </button>
              );
            })}
          </div>
          {windowForMeal && (
            <div className="mt-3 text-xs text-muted-foreground">
              {meal} window: {formatTime12h(windowForMeal.startTime)} – {formatTime12h(windowForMeal.endTime)}
            </div>
          )}
        </Card>

        {/* Camera scanner */}
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">QR Camera</div>
            <Button size="sm" variant={cameraOn ? "destructive" : "default"} onClick={() => setCameraOn((v) => !v)}>
              {cameraOn ? <><CameraOff className="mr-1 h-4 w-4" /> Stop</> : <><Camera className="mr-1 h-4 w-4" /> Start camera</>}
            </Button>
          </div>
          {cameraOn ? (
            <CameraScanner onDetect={onDetect} />
          ) : (
            <div className="grid place-items-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-10 text-center">
              <Camera className="mb-3 h-12 w-12 text-primary" />
              <div className="font-display text-lg font-bold">Camera off</div>
              <p className="mt-1 text-sm text-muted-foreground">Start the camera to scan member QR codes.</p>
            </div>
          )}
        </Card>

        {/* Manual token entry */}
        <Card className="p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Manual token</div>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (manualToken.trim()) { onDetect(manualToken.trim()); setManualToken(""); } }}
          >
            <Input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste QR token" />
            <Button type="submit" disabled={!manualToken.trim()}><Send className="h-4 w-4" /></Button>
          </form>
        </Card>
      </main>

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

// ---- Camera component (html5-qrcode) ----
function CameraScanner({ onDetect }: { onDetect: (token: string) => void }) {
  const containerId = "qr-camera-region";
  const ref = useRef<HTMLDivElement>(null);
  const lastRef = useRef<{ token: string; at: number } | null>(null);

  useEffect(() => {
    let scanner: any = null;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled || !ref.current) return;
      scanner = new Html5Qrcode(containerId);
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            const now = Date.now();
            if (lastRef.current && lastRef.current.token === decoded && now - lastRef.current.at < 3000) return;
            lastRef.current = { token: decoded, at: now };
            onDetect(decoded);
          },
          () => {}
        );
      } catch (e: any) {
        toast.error(e?.message || "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      if (scanner) { scanner.stop().catch(() => {}).then(() => scanner.clear?.()); }
    };
  }, [onDetect]);

  return <div id={containerId} ref={ref} className="overflow-hidden rounded-xl border bg-black" style={{ minHeight: 280 }} />;
}

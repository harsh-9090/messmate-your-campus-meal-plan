import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Camera, CameraOff, LogOut, UtensilsCrossed, Send, ScanLine,
  CheckCircle2, XCircle, Loader2, AlertTriangle,
} from "lucide-react";
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
  const [cameraOn, setCameraOn] = useState(true); // auto-start
  const [camError, setCamError] = useState<string | null>(null);
  const lastTokenRef = useRef<string | null>(null);

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

  const handleDetect = useCallback((token: string) => {
    if (scanM.isPending) return;
    lastTokenRef.current = token;
    scanM.mutate(token);
  }, [scanM]);

  const handleNext = useCallback(() => {
    setResult(null);
    lastTokenRef.current = null;
  }, []);

  const handleRetry = useCallback(() => {
    const t = lastTokenRef.current;
    setResult(null);
    if (t) scanM.mutate(t);
  }, [scanM]);

  if (!authUser) { navigate({ to: "/login" }); return null; }

  const windowForMeal = windows.find((w) => w.meal === meal);
  const todayLogs = logsQ.data ?? [];
  const allowedCount = todayLogs.filter((l) => l.status === "allowed").length;
  const deniedCount = todayLogs.filter((l) => l.status === "denied").length;

  if (result) return <ScanResultScreen result={result} onNext={handleNext} onRetry={handleRetry} />;

  return (
    <div className="min-h-screen bg-background pb-40">
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
              <CheckCircle2 className="mr-1 h-3 w-3" /> {allowedCount}
            </Badge>
            <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
              <XCircle className="mr-1 h-3 w-3" /> {deniedCount}
            </Badge>
            <Button variant="ghost" size="sm" asChild className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Link to="/login" onClick={() => logout()}><LogOut className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4">
        {/* Meal selector */}
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

        {/* Live Camera */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <ScanLine className="h-4 w-4" /> Live QR Camera
            </div>
            <Button size="sm" variant={cameraOn ? "destructive" : "default"} onClick={() => { setCamError(null); setCameraOn((v) => !v); }}>
              {cameraOn ? <><CameraOff className="mr-1 h-4 w-4" /> Stop</> : <><Camera className="mr-1 h-4 w-4" /> Start</>}
            </Button>
          </div>

          <div className="relative">
            {cameraOn ? (
              <CameraScanner
                onDetect={handleDetect}
                paused={scanM.isPending}
                onError={(m) => { setCamError(m); setCameraOn(false); }}
              />
            ) : (
              <div className="grid place-items-center bg-muted/20 p-12 text-center">
                {camError ? (
                  <>
                    <AlertTriangle className="mb-3 h-12 w-12 text-destructive" />
                    <div className="font-display text-lg font-bold">Camera unavailable</div>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">{camError}</p>
                  </>
                ) : (
                  <>
                    <Camera className="mb-3 h-12 w-12 text-primary" />
                    <div className="font-display text-lg font-bold">Camera off</div>
                    <p className="mt-1 text-sm text-muted-foreground">Start the camera to scan member QR codes.</p>
                  </>
                )}
              </div>
            )}

            {/* Overlay reticle */}
            {cameraOn && !scanM.isPending && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="relative h-56 w-56">
                  <span className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                  <span className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute inset-x-2 top-0 h-0.5 animate-[scanline_2s_ease-in-out_infinite] bg-primary/80 shadow-[0_0_12px_2px_hsl(var(--primary))]" />
                </div>
              </div>
            )}

            {/* Validating overlay */}
            {scanM.isPending && (
              <div className="absolute inset-0 grid place-items-center bg-background/85 backdrop-blur-sm">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-2 h-10 w-10 animate-spin text-primary" />
                  <div className="font-display text-lg font-bold">Validating…</div>
                  <p className="text-xs text-muted-foreground">Checking plan, expiry & time window</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-2 text-center text-[11px] text-muted-foreground">
            Hold the QR steady inside the box · auto-detects in ~1s
          </div>
        </Card>

        {/* Manual entry */}
        <Card className="p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Manual token (fallback)</div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = manualToken.trim();
              if (t) { handleDetect(t); setManualToken(""); }
            }}
          >
            <Input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste QR token" />
            <Button type="submit" disabled={!manualToken.trim() || scanM.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </main>

      {/* Today's scans strip */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent scans</div>
            <div className="text-[10px] text-muted-foreground">Auto-refresh 5s</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {todayLogs.length === 0 && <div className="py-2 text-xs text-muted-foreground">No scans yet</div>}
            {todayLogs.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "shrink-0 rounded-md border px-2 py-1 text-[11px]",
                  l.status === "allowed"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                )}
              >
                <div className="font-semibold">{l.memberName}</div>
                <div>{l.meal} · {formatTimestamp(l.timestamp).split(",")[1]?.trim() ?? ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Camera component (html5-qrcode) ----
function CameraScanner({
  onDetect,
  paused,
  onError,
}: {
  onDetect: (token: string) => void;
  paused: boolean;
  onError: (msg: string) => void;
}) {
  const containerId = "qr-camera-region";
  const scannerRef = useRef<any>(null);
  const lastRef = useRef<{ token: string; at: number } | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1.3333 },
          (decoded: string) => {
            if (pausedRef.current) return;
            const now = Date.now();
            if (lastRef.current && lastRef.current.token === decoded && now - lastRef.current.at < 2500) return;
            lastRef.current = { token: decoded, at: now };
            onDetect(decoded);
          },
          () => {}
        );
      } catch (e: any) {
        const msg = e?.message || "Unable to access camera. Check permissions.";
        onError(msg);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try { s.stop().catch(() => {}).then(() => s.clear?.()); } catch {}
        scannerRef.current = null;
      }
    };
  }, [onDetect, onError]);

  return (
    <div
      id={containerId}
      className="w-full bg-black [&_video]:!w-full [&_video]:!h-auto"
      style={{ minHeight: 320 }}
    />
  );
}

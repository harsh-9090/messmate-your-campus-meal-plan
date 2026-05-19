import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/messmate/auth";
import { configApi, scanApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanResultScreen } from "@/components/messmate/ScanResult";
import { MEALS, MEAL_ICONS } from "@/lib/messmate/constants";
import {
  getActiveMeal,
  formatTime12h,
  formatTimestamp,
  todayISO,
} from "@/lib/messmate/dateHelpers";
import type { Meal, ScanResult, Member } from "@/lib/messmate/types";
import {
  Camera,
  CameraOff,
  LogOut,
  UtensilsCrossed,
  ScanLine,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  History,
  Settings2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";
import { GhostLoader } from "@/components/messmate/GhostLoader";

export const Route = createFileRoute("/staff/scanner")({
  head: () => ({
    meta: [
      { title: "Mess Scanner - Mom's Kitchen" },
      {
        name: "description",
        content:
          "Staff scanner for mess hall: validate member QR codes against plan, time, and usage.",
      },
    ],
  }),
  component: ScannerPage,
});

function ScannerPage() {
  const authUser = useAuth((s) => s.user);
  const _hasHydrated = useAuth((s) => s._hasHydrated);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"scan" | "shift">("scan");

  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const windows = windowsQ.data ?? [];
  const activeFromTime = windows.length ? getActiveMeal(windows) : null;

  const [meal, setMeal] = useState<Meal>("Lunch");
  useEffect(() => {
    if (activeFromTime) setMeal(activeFromTime);
  }, [activeFromTime]);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraOn, setCameraOn] = useState(true); // auto-start
  const [camError, setCamError] = useState<string | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  const [searchVal, setSearchVal] = useState("");
  const [lookupMember, setLookupMember] = useState<Member | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const logsQ = useQuery({
    queryKey: ["scanner-logs", authUser?.id],
    queryFn: () => scanApi.logs({ date: todayISO(), limit: 12 }),
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

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    setIsSearching(true);
    setLookupMember(null);
    try {
      const data = await scanApi.lookup(searchVal);
      setLookupMember(data);
      toast.success("Member found!");
    } catch (err: any) {
      toast.error(err.message || "No active member found with this ID or contact number");
    } finally {
      setIsSearching(false);
    }
  };

  const manualScanM = useMutation({
    mutationFn: (memberId: string) => scanApi.manualValidate(memberId, meal),
    onSuccess: (r) => {
      setResult(r);
      setLookupMember(null);
      setSearchVal("");
      qc.invalidateQueries({ queryKey: ["scanner-logs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Manual check-in failed"),
  });

  const handleDetect = useCallback(
    (token: string) => {
      if (scanM.isPending) return;
      lastTokenRef.current = token;
      scanM.mutate(token);
    },
    [scanM],
  );

  const handleNext = useCallback(() => {
    setResult(null);
    lastTokenRef.current = null;
  }, []);

  const handleRetry = useCallback(() => {
    const t = lastTokenRef.current;
    setResult(null);
    if (t) scanM.mutate(t);
  }, [scanM]);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!authUser || authUser.role !== "staff") navigate({ to: "/login" });
  }, [_hasHydrated, authUser, navigate]);

  if (!_hasHydrated || !authUser) return null;

  if (windowsQ.isLoading) {
    return <GhostLoader size="fullscreen" />;
  }

  const windowForMeal = windows.find((w) => w.meal === meal);
  const todayLogs = logsQ.data ?? [];
  const allowedCount = todayLogs.filter((l) => l.status === "allowed").length;
  const deniedCount = todayLogs.filter((l) => l.status === "denied").length;

  if (result) return <ScanResultScreen result={result} onNext={handleNext} onRetry={handleRetry} />;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-sidebar text-sidebar-foreground shadow-sm">
        <div className="mx-auto flex max-w-xl md:max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/apple-touch-icon.png"
              alt="Mom's Kitchen Logo"
              className="h-9 w-9 rounded-full border border-primary/20 object-cover shadow-sm bg-primary/10"
            />
            <div>
              <div className="font-display text-base font-bold leading-none">Mess Scanner</div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 mt-0.5">
                {authUser.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-success/40 bg-success/10 text-success font-bold"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" /> {allowedCount}
            </Badge>
            <Badge
              variant="outline"
              className="border-destructive/40 bg-destructive/10 text-destructive font-bold"
            >
              <XCircle className="mr-1 h-3 w-3" /> {deniedCount}
            </Badge>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer"
            >
              <Link to="/login" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Tactile Mobile Tab Selector (Hidden on md and up) */}
      <div className="md:hidden flex border-b bg-background sticky top-[61px] z-10 p-1 bg-slate-50 dark:bg-slate-900 border-b">
        <button
          onClick={() => setActiveTab("scan")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "scan"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScanLine className="h-4 w-4" /> Live Scan
        </button>
        <button
          onClick={() => setActiveTab("shift")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer ${
            activeTab === "shift"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="h-4 w-4" /> Shift Logs
        </button>
      </div>

      {/* Main Grid: Stacks on mobile, side-by-side on desktop */}
      <main className="mx-auto max-w-xl md:max-w-5xl space-y-4 md:space-y-0 p-4 md:grid md:grid-cols-12 md:gap-6">
        {/* LEFT COLUMN: Camera Scanner (Visible if activeTab === 'scan' on mobile) */}
        <div
          className={`md:col-span-7 space-y-4 ${activeTab === "scan" ? "block" : "hidden md:block"}`}
        >
          {/* Live Camera Scanner */}
          <Card className="overflow-hidden p-0 shadow-sm border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <ScanLine className="h-4 w-4" /> Live QR Camera
              </div>
              <Button
                size="sm"
                className="cursor-pointer"
                variant={cameraOn ? "destructive" : "default"}
                onClick={() => {
                  setCamError(null);
                  setCameraOn((v) => !v);
                }}
              >
                {cameraOn ? (
                  <>
                    <CameraOff className="mr-1 h-4 w-4" /> Stop
                  </>
                ) : (
                  <>
                    <Camera className="mr-1 h-4 w-4" /> Start
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              {cameraOn ? (
                <CameraScanner
                  onDetect={handleDetect}
                  paused={scanM.isPending}
                  onError={(m) => {
                    setCamError(m);
                    setCameraOn(false);
                  }}
                />
              ) : (
                <div className="grid place-items-center bg-muted/20 p-12 text-center">
                  {camError ? (
                    <>
                      <AlertTriangle className="mb-3 h-12 w-12 text-destructive animate-bounce" />
                      <div className="font-display text-lg font-bold">Camera unavailable</div>
                      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{camError}</p>
                    </>
                  ) : (
                    <>
                      <Camera className="mb-3 h-12 w-12 text-primary animate-pulse" />
                      <div className="font-display text-lg font-bold">Camera off</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Start the camera to scan member QR codes.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Overlay viewfinder reticle */}
              {cameraOn && !scanM.isPending && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="relative h-56 w-56">
                    <span className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                    <span className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                    <div className="absolute inset-x-2 top-0 h-0.5 animate-[scanline_2s_ease-in-out_infinite] bg-primary/80 shadow-[0_0_12px_2px_id(var(--primary))]" />
                  </div>
                </div>
              )}

              {/* Validating overlay */}
              {scanM.isPending && (
                <div className="absolute inset-0 grid place-items-center bg-background/85 backdrop-blur-sm">
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-2 h-10 w-10 animate-spin text-primary" />
                    <div className="font-display text-lg font-bold animate-pulse">Validating…</div>
                    <p className="text-xs text-muted-foreground">
                      Checking plan, expiry & time window
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-2 text-center text-[11px] text-muted-foreground border-t">
              Hold the QR steady inside the box · auto-detects in ~1s
            </div>
          </Card>

          {/* Manual Member Lookup & Check-in */}
          <Card className="p-4 shadow-sm border">
            <div className="flex items-center gap-2 border-b pb-2 mb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <div className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Manual Member Lookup
              </div>
            </div>
            
            <form onSubmit={handleLookup} className="flex gap-2">
              <Input
                placeholder="Enter Student ID (e.g. MK001) or Mobile..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                disabled={isSearching || manualScanM.isPending}
                className="flex-1 text-xs"
              />
              <Button type="submit" disabled={isSearching || manualScanM.isPending || !searchVal.trim()} size="sm" className="cursor-pointer">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
              </Button>
            </form>

            {lookupMember && (
              <div className="mt-4 p-4 border rounded-xl bg-muted/20 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm">{lookupMember.name}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      ID: {lookupMember.memberId} {lookupMember.mobile && `· 📞 ${lookupMember.mobile}`}
                    </p>
                  </div>
                  <Badge variant={lookupMember.isActive ? "default" : "destructive"} className={cn("text-[9px] font-bold", lookupMember.isActive ? "bg-success text-success-foreground" : "")}>
                    {lookupMember.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="border-t border-b py-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Plan:</span>
                    <span className="font-semibold">{lookupMember.subscription?.planLabel || "No Plan"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={cn("font-bold", lookupMember.subscription?.isPaid ? "text-success" : "text-destructive")}>
                      {lookupMember.subscription?.isPaid ? "Paid" : `Payment Due (Grace Period / Outstanding ₹${lookupMember.subscription?.dueAmount})`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Covered Meals:</span>
                    <span className="font-semibold">{(lookupMember.subscription?.meals || []).join(", ") || "None"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    Selected Slot: <strong className="text-primary font-bold">{meal}</strong>
                  </div>
                  <Button
                    size="sm"
                    disabled={manualScanM.isPending}
                    onClick={() => manualScanM.mutate(lookupMember.memberId)}
                    className="cursor-pointer text-[10px]"
                  >
                    {manualScanM.isPending ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Checking…
                      </>
                    ) : (
                      "Approve Check-in"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: Meal Selector & Today's Shift Logs (Visible if activeTab === 'shift' on mobile) */}
        <div
          className={`md:col-span-5 space-y-4 ${activeTab === "shift" ? "block" : "hidden md:block"}`}
        >
          {/* Meal Selector Card */}
          <Card className="p-4 shadow-sm border">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Current Meal Slot
              </div>
              <Badge
                className={
                  activeFromTime === meal
                    ? "bg-success text-success-foreground font-semibold"
                    : "bg-muted text-muted-foreground font-semibold"
                }
              >
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
                      "rounded-lg border p-2.5 text-left transition-all cursor-pointer",
                      meal === m
                        ? "border-primary bg-primary/5 shadow-glow"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="text-2xl">{MEAL_ICONS[m]}</div>
                    <div className="font-semibold text-xs mt-0.5">{m}</div>
                    <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                      {w ? `${formatTime12h(w.startTime)} – ${formatTime12h(w.endTime)}` : "-"}
                    </div>
                  </button>
                );
              })}
            </div>
            {windowForMeal && (
              <div className="mt-3 text-[10px] text-muted-foreground">
                {meal} window: {formatTime12h(windowForMeal.startTime)} –{" "}
                {formatTime12h(windowForMeal.endTime)}
              </div>
            )}
          </Card>

          {/* Today's Scans list (Desktop and Mobile shift logs tab vertical view) */}
          <Card
            className={cn(
              "p-4 shadow-sm border",
              activeTab === "shift" ? "block" : "hidden md:block",
            )}
          >
            <div className="mb-3 flex items-center gap-2 border-b pb-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <div className="font-display text-base font-bold">Today's Shift Logs</div>
            </div>
            {todayLogs.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No scans recorded today.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {todayLogs.map((l) => (
                  <div
                    key={l.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-xs bg-muted/5 hover:bg-muted/10 transition-all",
                      l.status === "allowed"
                        ? "border-success/30 bg-success/5 text-success"
                        : "border-destructive/30 bg-destructive/5 text-destructive",
                    )}
                  >
                    <div>
                      <div className="font-bold">{l.memberName}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        {l.meal} · {formatTimestamp(l.timestamp).split(",")[1]?.trim() ?? ""}
                      </div>
                      {l.status === "denied" && (
                        <div className="text-[9px] font-semibold mt-0.5">{l.denialReason}</div>
                      )}
                    </div>
                    <Badge
                      variant={l.status === "allowed" ? "default" : "destructive"}
                      className={cn(
                        "text-[9px] font-bold",
                        l.status === "allowed" ? "bg-success text-success-foreground" : "",
                      )}
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
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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
            if (
              lastRef.current &&
              lastRef.current.token === decoded &&
              now - lastRef.current.at < 2500
            )
              return;
            lastRef.current = { token: decoded, at: now };
            onDetect(decoded);
          },
          () => {},
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
        try {
          s.stop()
            .catch(() => {})
            .then(() => s.clear?.());
        } catch {}
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

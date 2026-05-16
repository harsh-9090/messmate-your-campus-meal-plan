import { useEffect, useState } from "react";
import type { ScanResult } from "@/lib/messmate/types";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, CreditCard, CalendarX, Ban, Clock,
  RotateCcw, AlertTriangle, UserX, RefreshCw, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const codeMeta: Record<string, { icon: React.ReactNode; hint: string }> = {
  UNPAID:        { icon: <CreditCard className="h-16 w-16" />,    hint: "Ask member to clear their dues at the admin desk." },
  EXPIRED:       { icon: <CalendarX className="h-16 w-16" />,     hint: "Subscription ended. Renew before next meal." },
  NOT_IN_PLAN:   { icon: <Ban className="h-16 w-16" />,           hint: "This meal isn't part of the member's plan." },
  WRONG_TIME:    { icon: <Clock className="h-16 w-16" />,         hint: "Outside the active meal window." },
  ALREADY_USED:  { icon: <RotateCcw className="h-16 w-16" />,     hint: "This meal was already taken today." },
  INVALID_TOKEN: { icon: <AlertTriangle className="h-16 w-16" />, hint: "QR expired or tampered. Ask member to refresh." },
  NOT_FOUND:     { icon: <UserX className="h-16 w-16" />,         hint: "No active member matches this QR." },
};

const AUTO_DISMISS_MS = 3500;

export function ScanResultScreen({
  result,
  onNext,
  onRetry,
}: {
  result: ScanResult;
  onNext: () => void;
  onRetry?: () => void;
}) {
  const allowed = result.status === "allowed";
  const meta = codeMeta[result.code ?? ""] ?? { icon: <XCircle className="h-16 w-16" />, hint: result.reason ?? "Denied." };
  const [remaining, setRemaining] = useState(AUTO_DISMISS_MS);

  // Beep + vibrate on mount
  useEffect(() => {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "sine";
        o.frequency.value = allowed ? 880 : 220;
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (allowed ? 0.18 : 0.45));
        o.start();
        o.stop(ctx.currentTime + (allowed ? 0.2 : 0.5));
      }
    } catch {}
    if (navigator.vibrate) navigator.vibrate(allowed ? 80 : [120, 60, 120]);
  }, [allowed]);

  // Auto-dismiss on success only
  useEffect(() => {
    if (!allowed) return;
    const start = Date.now();
    const t = setInterval(() => {
      const left = AUTO_DISMISS_MS - (Date.now() - start);
      if (left <= 0) { clearInterval(t); onNext(); }
      else setRemaining(left);
    }, 80);
    return () => clearInterval(t);
  }, [allowed, onNext]);

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className={cn(
        "fixed inset-0 z-50 flex flex-col text-white animate-in fade-in zoom-in-95 duration-200",
        allowed ? "bg-gradient-to-b from-emerald-700 to-emerald-950" : "bg-gradient-to-b from-rose-700 to-rose-950"
      )}
    >
      {/* Progress bar (success auto-dismiss) */}
      {allowed && (
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full bg-white/80 transition-[width] duration-75"
            style={{ width: `${(remaining / AUTO_DISMISS_MS) * 100}%` }}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className={cn("rounded-full p-6", allowed ? "bg-white/15" : "bg-white/10")}>
          {allowed ? <CheckCircle2 className="h-24 w-24" strokeWidth={1.5} /> : meta.icon}
        </div>

        <div>
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
            {allowed ? "ALLOWED" : "DENIED"}
          </h1>
          <p className="mt-1 text-sm uppercase tracking-[0.3em] opacity-70">
            {result.meal}{result.code ? ` · ${result.code.replace(/_/g, " ")}` : ""}
          </p>
        </div>

        {result.member ? (
          <div className="w-full max-w-md space-y-1 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <div className="text-xl font-semibold">{result.member.name}</div>
            <div className="text-xs opacity-70">
              {result.member.memberId} · Room {result.member.room}
            </div>
            {allowed ? (
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/20 pt-3 text-left text-xs">
                <div><div className="opacity-60">Plan</div><div className="font-semibold">{result.planLabel}</div></div>
                <div><div className="opacity-60">Left today</div><div className="font-semibold">{result.mealsRemainingToday}</div></div>
                <div><div className="opacity-60">Days left</div><div className="font-semibold">{result.daysRemainingInPlan}</div></div>
              </div>
            ) : (
              <p className="mt-3 border-t border-white/20 pt-3 text-sm">{result.reason}</p>
            )}
          </div>
        ) : (
          <p className="max-w-md rounded-xl bg-white/10 px-5 py-3 text-base font-medium backdrop-blur">
            {result.reason}
          </p>
        )}

        {!allowed && (
          <p className="max-w-md text-sm opacity-80">💡 {meta.hint}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 p-5 sm:flex-row sm:justify-center">
        {!allowed && onRetry && (
          <Button
            size="lg"
            variant="outline"
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-48"
            onClick={onRetry}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Retry scan
          </Button>
        )}
        <Button
          size="lg"
          className={cn(
            "sm:w-64",
            allowed
              ? "bg-white text-emerald-900 hover:bg-white/90"
              : "bg-white text-rose-900 hover:bg-white/90"
          )}
          onClick={onNext}
        >
          Scan next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

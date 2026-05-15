import type { ScanResult } from "@/lib/messmate/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, CreditCard, CalendarX, Ban, Clock, RotateCcw } from "lucide-react";

const codeIcon: Record<string, React.ReactNode> = {
  UNPAID: <CreditCard className="h-12 w-12" />,
  EXPIRED: <CalendarX className="h-12 w-12" />,
  NOT_IN_PLAN: <Ban className="h-12 w-12" />,
  WRONG_TIME: <Clock className="h-12 w-12" />,
  ALREADY_USED: <RotateCcw className="h-12 w-12" />,
  INVALID_TOKEN: <XCircle className="h-12 w-12" />,
  NOT_FOUND: <XCircle className="h-12 w-12" />,
};

export function ScanResultScreen({ result, onNext }: { result: ScanResult; onNext: () => void }) {
  const allowed = result.status === "allowed";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 text-white"
      style={{ backgroundColor: allowed ? "#052e16" : "#450a0a" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {allowed ? (
          <CheckCircle2 className="h-32 w-32 text-success" strokeWidth={1.5} />
        ) : (
          <div className="text-destructive">{codeIcon[result.code ?? ""] ?? <XCircle className="h-32 w-32" />}</div>
        )}
        <h1 className="font-display text-6xl font-bold tracking-tight">
          {allowed ? "ALLOWED" : "DENIED"}
        </h1>

        {result.member && (
          <div className="space-y-1">
            <p className="text-2xl font-semibold">{result.member.name}</p>
            <p className="text-sm opacity-70">
              {result.member.memberId} · Room {result.member.room}
            </p>
          </div>
        )}

        {allowed ? (
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-4 text-left text-sm backdrop-blur">
            <div><div className="opacity-60">Meal</div><div className="font-semibold">{result.meal}</div></div>
            <div><div className="opacity-60">Plan</div><div className="font-semibold">{result.planLabel}</div></div>
            <div><div className="opacity-60">Meals left today</div><div className="font-semibold">{result.mealsRemainingToday}</div></div>
            <div><div className="opacity-60">Days left in plan</div><div className="font-semibold">{result.daysRemainingInPlan}</div></div>
          </div>
        ) : (
          <p className="max-w-md rounded-xl bg-white/10 px-5 py-3 text-base font-medium backdrop-blur">
            {result.reason}
          </p>
        )}
      </div>

      <Button size="lg" className="w-full max-w-sm" onClick={onNext}>
        Scan Next
      </Button>
    </div>
  );
}

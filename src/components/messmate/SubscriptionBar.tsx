import type { Subscription } from "@/lib/messmate/types";
import { daysElapsed, daysRemaining, formatDate } from "@/lib/messmate/dateHelpers";

export function SubscriptionBar({ sub }: { sub: Subscription }) {
  const elapsed = Math.min(30, daysElapsed(sub.startDate));
  const left = Math.max(0, daysRemaining(sub.endDate));
  const pct = (elapsed / 30) * 100;
  const expired = left <= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Day {elapsed} of 30</span>
        <span>{expired ? "Expired" : `${left} day${left === 1 ? "" : "s"} left`}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDate(sub.startDate)}</span>
        <span>{formatDate(sub.endDate)}</span>
      </div>
    </div>
  );
}

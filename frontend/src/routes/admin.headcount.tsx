import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { skipsApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Calendar as CalendarIcon,
  ChefHat,
  TrendingDown,
  Users,
  UtensilsCrossed,
  Info,
} from "lucide-react";
import { todayISO, formatDate, addDaysISO } from "@/lib/messmate/dateHelpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/headcount")({
  head: () => ({ meta: [{ title: "Kitchen Forecast - Mom's Kitchen Admin" }] }),
  component: KitchenForecastPage,
});

function KitchenForecastPage() {
  const [dateRange, setDateRange] = useState({
    startDate: todayISO(),
    endDate: addDaysISO(todayISO(), 6), // 7 days default
  });

  const { data: headcountData, isLoading, error } = useQuery({
    queryKey: ["headcount", dateRange],
    queryFn: () => skipsApi.getHeadcount(dateRange.startDate, dateRange.endDate),
  });

  const todayTotals = useMemo(() => {
    if (!headcountData || headcountData.length === 0) {
      return { totalPortions: 0, totalSkips: 0, wasteSavedPercent: 0, targetDate: todayISO() };
    }
    const todayStr = todayISO();
    const targetData = headcountData.find((d) => d.date === todayStr) || headcountData[0];

    let portions = 0;
    let skips = 0;
    if (targetData) {
      Object.values(targetData.meals).forEach((m) => {
        portions += m.expectedPortions;
        skips += m.skips;
      });
    }
    const totalSubscribed = portions + skips;
    const wasteSavedPercent = totalSubscribed > 0 ? Math.round((skips / totalSubscribed) * 100) : 0;
    return { 
      totalPortions: portions, 
      totalSkips: skips, 
      wasteSavedPercent, 
      targetDate: targetData?.date || todayStr 
    };
  }, [headcountData]);

  const formattedTargetDate = useMemo(() => {
    if (!todayTotals.targetDate) return "Today";
    if (todayTotals.targetDate === todayISO()) return "Today";
    return formatDate(todayTotals.targetDate);
  }, [todayTotals.targetDate]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Kitchen Forecast</h1>
          <p className="text-sm text-muted-foreground">
            Forecast plate count requirements for upcoming meals to minimize food waste
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                className="border-0 bg-transparent p-0 text-sm font-semibold focus:ring-0 focus:outline-none w-[115px] text-foreground cursor-pointer"
                value={dateRange.startDate}
                onChange={(e) =>
                  e.target.value && setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>
            <span className="text-muted-foreground text-[10px] font-extrabold uppercase px-1">to</span>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                className="border-0 bg-transparent p-0 text-sm font-semibold focus:ring-0 focus:outline-none w-[115px] text-foreground cursor-pointer"
                value={dateRange.endDate}
                onChange={(e) =>
                  e.target.value && setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-border bg-card shadow-sm flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black">{todayTotals.totalPortions}</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Expected Plates ({formattedTargetDate})
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black">{todayTotals.totalSkips}</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Registered Skips ({formattedTargetDate})
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border bg-card shadow-sm flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black">{todayTotals.wasteSavedPercent}%</div>
            <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Portions Saved ({formattedTargetDate})
            </div>
          </div>
        </Card>
      </div>

      {/* Kitchen Alert notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-950/40 dark:bg-blue-950/10">
        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>How headcount is calculated:</strong> Active Subscribers represents the total count of members with active, paid subscriptions that include that specific meal. Net portions to cook are obtained by subtracting registered skips from the active subscribers. Toggles for skips lock 12 hours before the start of each meal.
        </div>
      </div>

      {/* Forecast list */}
      {isLoading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary/50" />
          <p className="text-sm text-muted-foreground mt-2">Loading portion forecasts…</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-destructive">
          Failed to fetch headcount forecast data.
        </div>
      ) : headcountData?.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No days found in the selected range.
        </div>
      ) : (
        <div className="space-y-6">
          {headcountData?.map((day) => (
            <Card key={day.date} className="p-6 border-border bg-card shadow-sm space-y-4">
              <h3 className="font-display font-bold text-lg border-b pb-2 text-foreground">
                {formatDate(day.date)}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(["Breakfast", "Lunch", "Dinner"] as const).map((meal) => {
                  const mData = day.meals[meal];
                  const skipsPercent =
                    mData.activeSubscribers > 0
                      ? Math.round((mData.skips / mData.activeSubscribers) * 100)
                      : 0;

                  return (
                    <div
                      key={meal}
                      className="rounded-xl border border-border p-4 space-y-3 bg-muted/5 hover:bg-muted/10 transition-all duration-150"
                    >
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-bold flex items-center gap-1.5 text-sm text-foreground">
                          <UtensilsCrossed className="h-4 w-4 text-primary/80" />
                          {meal}
                        </span>
                        {mData.skips > 0 && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            {mData.skips} skipped ({skipsPercent}%)
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-background rounded-lg p-2 border border-border/40">
                          <div className="text-xs text-muted-foreground font-semibold">Active</div>
                          <div className="font-black text-sm text-foreground">
                            {mData.activeSubscribers}
                          </div>
                        </div>
                        <div className="bg-background rounded-lg p-2 border border-border/40">
                          <div className="text-xs text-muted-foreground font-semibold font-semibold">Skips</div>
                          <div className="font-black text-sm text-amber-600 dark:text-amber-400">
                            {mData.skips}
                          </div>
                        </div>
                        <div className="bg-primary/5 rounded-lg p-2 border border-primary/20">
                          <div className="text-xs text-primary font-bold">To Cook</div>
                          <div className="font-black text-base text-primary">
                            {mData.expectedPortions}
                          </div>
                        </div>
                      </div>

                      {/* Visual Progress/Portion Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground font-semibold uppercase">
                          <span>Portions Scale</span>
                          <span>{mData.expectedPortions} / {mData.activeSubscribers}</span>
                        </div>
                        <div className="h-2 w-full bg-muted dark:bg-muted/20 rounded-full overflow-hidden flex">
                          <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{
                              width: `${
                                mData.activeSubscribers > 0
                                  ? (mData.expectedPortions / mData.activeSubscribers) * 100
                                  : 0
                              }%`,
                            }}
                          />
                          <div
                            className="bg-amber-500 h-full transition-all duration-300"
                            style={{
                              width: `${
                                mData.activeSubscribers > 0
                                  ? (mData.skips / mData.activeSubscribers) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

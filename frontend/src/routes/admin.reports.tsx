import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { membersApi, reportsApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Utensils, Calendar } from "lucide-react";
import { todayISO, daysRemaining, formatINR } from "@/lib/messmate/dateHelpers";
import { format, parseISO } from "date-fns";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports - Mom's Kitchen Admin" }] }),
  component: ReportsPage,
});

const MEAL_COLORS = {
  Breakfast: "oklch(0.78 0.16 75)", // Warm amber
  Lunch: "oklch(0.7 0.18 150)", // emerald green
  Dinner: "oklch(0.58 0.22 277)", // Deep Indigo
};

function ReportsPage() {
  const [period, setPeriod] = useState<"day" | "month" | "year">("day");
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(() => format(new Date(), "yyyy"));

  // Main reports queries
  const weeklyQ = useQuery({ queryKey: ["reports", "weekly"], queryFn: () => reportsApi.weekly() });
  const membersQ = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => membersApi.list({ limit: 500 }),
  });

  const dailyStatsQ = useQuery({
    queryKey: ["reports", "meals", "daily", selectedDay],
    queryFn: () => reportsApi.daily(selectedDay),
    enabled: period === "day",
    refetchInterval: period === "day" ? 30000 : false,
  });

  const monthlyStatsQ = useQuery({
    queryKey: ["reports", "meals", "monthly", selectedMonth],
    queryFn: () => reportsApi.monthly(selectedMonth),
    enabled: period === "month",
  });

  const yearlyStatsQ = useQuery({
    queryKey: ["reports", "meals", "yearly", selectedYear],
    queryFn: () => reportsApi.yearly(selectedYear),
    enabled: period === "year",
  });

  const members = membersQ.data?.items ?? [];
  const weekly = (weeklyQ.data?.days ?? []).map((d) => ({
    date: format(parseISO(d.date), "EEE"),
    meals: d.meals,
  }));

  const active = members.filter(
    (m) => m.subscription.isPaid && daysRemaining(m.subscription.endDate) >= 0,
  );
  const totalRev =
    weeklyQ.data?.estimatedMonthlyRevenue ??
    active.reduce((s, m) => s + m.subscription.pricePerMonth, 0);
  const unpaidDues = members
    .filter((m) => !m.subscription.isPaid)
    .reduce((s, m) => s + m.subscription.pricePerMonth, 0);
  const totalMealsWeek = weekly.reduce((s, d) => s + d.meals, 0);
  const avgPerDay = (totalMealsWeek / 7).toFixed(1);

  // Compute active meals distribution stats based on period
  const { breakfastCount, lunchCount, dinnerCount, totalMealsCount, isLoadingMeals } =
    useMemo(() => {
      let b = 0,
        l = 0,
        d = 0,
        total = 0;
      let loading = false;

      if (period === "day") {
        loading = dailyStatsQ.isLoading;
        if (dailyStatsQ.data) {
          b = dailyStatsQ.data.meals.Breakfast || 0;
          l = dailyStatsQ.data.meals.Lunch || 0;
          d = dailyStatsQ.data.meals.Dinner || 0;
          total = dailyStatsQ.data.total || 0;
        }
      } else if (period === "month") {
        loading = monthlyStatsQ.isLoading;
        if (monthlyStatsQ.data) {
          b = monthlyStatsQ.data.meals?.Breakfast || 0;
          l = monthlyStatsQ.data.meals?.Lunch || 0;
          d = monthlyStatsQ.data.meals?.Dinner || 0;
          total = monthlyStatsQ.data.totalMeals || 0;
        }
      } else if (period === "year") {
        loading = yearlyStatsQ.isLoading;
        if (yearlyStatsQ.data) {
          b = yearlyStatsQ.data.meals?.Breakfast || 0;
          l = yearlyStatsQ.data.meals?.Lunch || 0;
          d = yearlyStatsQ.data.meals?.Dinner || 0;
          total = yearlyStatsQ.data.totalMeals || 0;
        }
      }
      return {
        breakfastCount: b,
        lunchCount: l,
        dinnerCount: d,
        totalMealsCount: total,
        isLoadingMeals: loading,
      };
    }, [
      period,
      dailyStatsQ.data,
      dailyStatsQ.isLoading,
      monthlyStatsQ.data,
      monthlyStatsQ.isLoading,
      yearlyStatsQ.data,
      yearlyStatsQ.isLoading,
    ]);

  // Chart data formatting for distribution donut
  const distributionChartData = useMemo(() => {
    return [
      { name: "Breakfast", value: breakfastCount, color: MEAL_COLORS.Breakfast },
      { name: "Lunch", value: lunchCount, color: MEAL_COLORS.Lunch },
      { name: "Dinner", value: dinnerCount, color: MEAL_COLORS.Dinner },
    ].filter((d) => d.value > 0);
  }, [breakfastCount, lunchCount, dinnerCount]);

  const exportCsv = async () => {
    try {
      const blob = await reportsApi.exportDailyCsv(selectedDay);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `messmate-scans-${selectedDay}.csv`;
      a.click();
      toast.success("CSV exported");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  };

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Kitchen analytics & dynamic consumption dashboards
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" className="cursor-pointer">
          <Download className="mr-1 h-4 w-4" /> Export Scan Logs CSV
        </Button>
      </header>

      {/* Main Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Meals served (7d)", totalMealsWeek],
          ["Avg meals / day", avgPerDay],
          ["Active revenue", formatINR(totalRev)],
          ["Unpaid dues", formatINR(unpaidDues)],
        ].map(([l, v]) => (
          <Card key={l as string} className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="font-display text-2xl font-bold">{v}</div>
          </Card>
        ))}
      </div>

      {/* Meal Served Analytics Section (Daywise, Monthwise, Yearwise) */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 mb-5">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Meal Consumption Analytics</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period sub-tabs */}
            <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-900 p-1 border">
              {(["day", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-4 py-1 text-xs font-semibold tracking-wide capitalize transition-all duration-300 cursor-pointer ${
                    period === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "day" ? "Daywise" : p === "month" ? "Monthwise" : "Yearwise"}
                </button>
              ))}
            </div>

            {/* Conditional Date inputs based on period */}
            {period === "day" && (
              <Input
                type="date"
                className="w-40 animate-slide-in"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
            )}
            {period === "month" && (
              <Input
                type="month"
                className="w-40 animate-slide-in"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            )}
            {period === "year" && (
              <div className="flex items-center border rounded-md px-2 bg-background">
                <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                <select
                  className="bg-transparent text-sm font-semibold outline-none py-1.5 cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {["2026", "2025", "2024"].map((y) => (
                    <option key={y} value={y} className="dark:bg-slate-900">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {isLoadingMeals ? (
          <div className="grid h-64 place-items-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-12">
            {/* Left side metrics */}
            <div className="md:col-span-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-4 bg-muted/10">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Breakfast
                </div>
                <div className="font-display text-2xl font-bold mt-1 text-amber-500">
                  {breakfastCount}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Members served</div>
              </div>
              <div className="rounded-lg border p-4 bg-muted/10">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Lunch</div>
                <div className="font-display text-2xl font-bold mt-1 text-emerald-500">
                  {lunchCount}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Members served</div>
              </div>
              <div className="rounded-lg border p-4 bg-muted/10">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Dinner</div>
                <div className="font-display text-2xl font-bold mt-1 text-indigo-500">
                  {dinnerCount}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Members served</div>
              </div>
              <div className="rounded-lg border p-4 bg-primary/5 border-primary/20">
                <div className="text-xs uppercase tracking-wider text-primary">Total Meals</div>
                <div className="font-display text-2xl font-bold mt-1 text-primary">
                  {totalMealsCount}
                </div>
                <div className="text-[10px] text-primary/70 mt-1">Scanned check-ins</div>
              </div>
            </div>

            {/* Right side donut chart */}
            <div className="md:col-span-7 rounded-lg border p-4 flex flex-col justify-center min-h-[220px]">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 text-center md:text-left">
                Meal Distribution Ratio
              </h4>
              {totalMealsCount === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No meal consumption data recorded for this period.
                </div>
              ) : (
                <div className="h-48 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {distributionChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} served`, "Total"]} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Weekly consumption chart */}
      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">
          Weekly Check-in Trends (last 7 days)
        </h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis dataKey="date" stroke="currentColor" fontSize={11} />
              <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="meals" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Revenue summary */}
      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Revenue summary</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Collected (active)
            </div>
            <div className="font-display text-3xl font-bold text-success">
              {formatINR(totalRev)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {active.length} paid active members
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending</div>
            <div className="font-display text-3xl font-bold text-destructive">
              {formatINR(unpaidDues)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {members.filter((m) => !m.subscription.isPaid).length} unpaid members
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

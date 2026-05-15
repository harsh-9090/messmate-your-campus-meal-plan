import { createFileRoute } from "@tanstack/react-router";
import { useMess } from "@/lib/messmate/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { addDaysISO, todayISO, daysRemaining, formatINR } from "@/lib/messmate/dateHelpers";
import { format, parseISO } from "date-fns";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — MessMate Admin" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const usage = useMess((s) => s.usage);
  const members = useMess((s) => s.members.filter((m) => m.role === "member" && m.isActive));
  const logs = useMess((s) => s.logs);

  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, -6 + i));
  const weekly = days.map((d) => {
    const dayUsage = usage.filter((u) => u.date === d);
    const meals = dayUsage.reduce((s, u) => s + (u.usedMeals.Breakfast ? 1 : 0) + (u.usedMeals.Lunch ? 1 : 0) + (u.usedMeals.Dinner ? 1 : 0), 0);
    return { date: format(parseISO(d), "EEE"), meals };
  });

  const active = members.filter((m) => m.subscription.isPaid && daysRemaining(m.subscription.endDate) >= 0);
  const totalRev = active.reduce((s, m) => s + m.subscription.pricePerMonth, 0);
  const unpaidDues = members.filter((m) => !m.subscription.isPaid).reduce((s, m) => s + m.subscription.pricePerMonth, 0);
  const totalMealsWeek = weekly.reduce((s, d) => s + d.meals, 0);
  const avgPerDay = (totalMealsWeek / 7).toFixed(1);

  const exportCsv = () => {
    const rows = [
      ["Date", "Member ID", "Member", "Meal", "Status", "Reason"],
      ...logs.map((l) => [l.date, l.memberId, l.memberName, l.meal, l.status, l.denialReason || ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `messmate-scans-${today}.csv`;
    a.click();
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Last 7 days · Revenue · Exports</p>
        </div>
        <Button onClick={exportCsv}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
      </header>

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

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Meals served (last 7 days)</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis dataKey="date" stroke="currentColor" fontSize={11} />
              <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="meals" fill="hsl(245 75% 60%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Revenue summary</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Collected (active)</div>
            <div className="font-display text-3xl font-bold text-success">{formatINR(totalRev)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{active.length} paid active members</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending</div>
            <div className="font-display text-3xl font-bold text-destructive">{formatINR(unpaidDues)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{members.filter((m) => !m.subscription.isPaid).length} unpaid members</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

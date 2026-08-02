import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { membersApi, reportsApi, usageApi } from "@/lib/messmate/api";
import { StatCard } from "@/components/messmate/StatCard";
import { Card } from "@/components/ui/card";
import {
  Users,
  CreditCard,
  AlertTriangle,
  IndianRupee,
  UtensilsCrossed,
} from "lucide-react";
import {
  daysRemaining,
  formatINR,
  formatDate,
} from "@/lib/messmate/dateHelpers";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, Legend, CartesianGrid } from "recharts";
import { GhostLoader } from "@/components/messmate/GhostLoader";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics - Mom's Kitchen Admin" }] }),
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const membersQ = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => membersApi.list({ limit: 500 }),
  });
  
  const summaryQ = useQuery({
    queryKey: ["usage", "summary"],
    queryFn: () => usageApi.summaryToday(),
    refetchInterval: 30_000,
  });
  
  const trendQ = useQuery({
    queryKey: ["reports", "daily-trend"],
    queryFn: () => reportsApi.getDailyTrend(7),
  });

  const members = membersQ.data?.items ?? [];
  const summary = summaryQ.data ?? { Breakfast: 0, Lunch: 0, Dinner: 0, total: 0 };
  const trendData = trendQ.data ?? [];

  const active = members.filter(
    (m) => m.subscription.isPaid && daysRemaining(m.subscription.endDate) >= 0,
  );
  const expired = members.filter((m) => daysRemaining(m.subscription.endDate) < 0);
  const revenue = active.reduce((s, m) => s + m.subscription.pricePerMonth, 0);

  const planCounts: Record<string, number> = {};
  members.forEach((m) => {
    planCounts[m.subscription.planLabel] = (planCounts[m.subscription.planLabel] || 0) + 1;
  });
  const planChart = Object.entries(planCounts).map(([name, value]) => ({ name, value }));
  const COLORS = [
    "hsl(245 75% 60%)",
    "hsl(150 60% 50%)",
    "hsl(40 95% 60%)",
    "hsl(0 75% 60%)",
    "hsl(220 70% 60%)",
    "hsl(290 60% 60%)",
  ];

  if (membersQ.isLoading) {
    return <GhostLoader size="fullscreen" />;
  }

  return (
    <div className="space-y-6 p-6 md:p-8 animate-in fade-in duration-300">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Member Analytics</h1>
          <p className="text-sm text-muted-foreground">Historical metrics & plan distribution</p>
        </div>
      </header>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">
          Overall Metrics
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard icon={Users} label="Total Members" value={members.length} accent="primary" />
          <StatCard icon={CreditCard} label="Active Plans" value={active.length} accent="success" />
          <StatCard
            icon={AlertTriangle}
            label="Expired"
            value={expired.length}
            accent="destructive"
          />
          <StatCard
            icon={UtensilsCrossed}
            label="Meals Today"
            value={summary.total}
            accent="primary"
            hint={`${summary.Breakfast}B · ${summary.Lunch}L · ${summary.Dinner}D`}
          />
          <StatCard
            icon={IndianRupee}
            label="Monthly Revenue"
            value={formatINR(revenue)}
            accent="success"
          />
        </div>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">7-Day Meal Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="99%" height="100%">
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis 
                dataKey="date" 
                stroke="currentColor" 
                fontSize={11} 
                tickFormatter={(val) => formatDate(val).split(',')[0]} 
              />
              <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
                labelFormatter={(val) => formatDate(val)}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Breakfast" fill="hsl(40 95% 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lunch" fill="hsl(150 60% 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dinner" fill="hsl(245 75% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Members by Plan</h3>
          <div className="h-64">
            <ResponsiveContainer width="99%" height="100%">
              <BarChart data={planChart}>
                <XAxis dataKey="name" stroke="currentColor" fontSize={11} />
                <YAxis stroke="currentColor" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {planChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

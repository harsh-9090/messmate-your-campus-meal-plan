import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/messmate/StatCard";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from "recharts";
import { IndianRupee, TrendingUp, Wallet, ArrowUpRight, Loader2, PieChart as PieChartIcon } from "lucide-react";
import { formatINR } from "@/lib/messmate/dateHelpers";
import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({ meta: [{ title: "Finance & Analytics — MessMate Admin" }] }),
  component: FinancePage,
});

function FinancePage() {
  const [period, setPeriod] = useState<'all' | 'day' | 'month' | 'year'>('all');
  const [dateValue, setDateValue] = useState(format(new Date(), "yyyy-MM-dd"));
  const [monthValue, setMonthValue] = useState(format(new Date(), "yyyy-MM"));
  const [yearValue, setYearValue] = useState(format(new Date(), "yyyy"));

  const getQueryDate = () => {
    if (period === 'day') return dateValue;
    if (period === 'month') return monthValue;
    if (period === 'year') return yearValue;
    return "";
  };

  const financeQ = useQuery({ 
    queryKey: ["reports", "finance", period, getQueryDate()], 
    queryFn: () => reportsApi.getFinance({ period, date: getQueryDate() }),
    refetchInterval: 300_000 // 5 min
  });

  if (financeQ.isLoading) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Calculating financial reports...</p>
        </div>
      </div>
    );
  }

  const data = financeQ.data;
  if (!data) return null;

  // Vibrant, premium palette
  const COLORS = [
    "hsl(245 75% 60%)", // Indigo
    "hsl(150 60% 50%)", // Emerald
    "hsl(40 95% 60%)",  // Amber
    "hsl(0 75% 60%)",   // Rose
    "hsl(270 70% 60%)", // Violet
    "hsl(190 80% 50%)"  // Cyan
  ];
  const PRIMARY_COLOR = COLORS[0];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Finance & Analytics</h1>
          <p className="text-sm text-muted-foreground">Revenue tracking and business growth insights</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-2 shadow-sm">
          <Tabs value={period} onValueChange={(v: any) => setPeriod(v)}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">All Time</TabsTrigger>
              <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
            </TabsList>
          </Tabs>

          {period === 'day' && (
            <Input type="date" className="h-9 w-40" value={dateValue} onChange={e => setDateValue(e.target.value)} />
          )}
          {period === 'month' && (
            <Input type="month" className="h-9 w-40" value={monthValue} onChange={e => setMonthValue(e.target.value)} />
          )}
          {period === 'year' && (
            <Input type="number" min="2020" max="2100" className="h-9 w-24" value={yearValue} onChange={e => setYearValue(e.target.value)} />
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={IndianRupee} label="Total Revenue" value={formatINR(data.summary.total_revenue || 0)} accent="success" />
        <StatCard icon={Wallet} label="Pending Dues" value={formatINR(data.summary.total_dues || 0)} accent="destructive" />
        <StatCard icon={TrendingUp} label="Transactions" value={data.summary.tx_count} accent="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Monthly Revenue Trend</h3>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.monthly}>
                <XAxis dataKey="month" stroke="currentColor" fontSize={11} />
                <YAxis stroke="currentColor" fontSize={11} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} 
                  formatter={(v: any) => [formatINR(Number(v)), "Revenue"]}
                />
                <Bar dataKey="revenue" fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Payment Methods</h3>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.methods}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.methods.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} 
                  formatter={(v: any) => [formatINR(Number(v)), "Total"]}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Revenue by Subscription Plan</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.plans} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="currentColor" fontSize={11} width={100} />
                <Tooltip 
                  content={(props: any) => {
                    const { active, payload } = props;
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-popover p-2 shadow-md">
                          <div className="text-sm font-bold">{d.name}</div>
                          <div className="mt-1 text-xs text-success">Revenue: {formatINR(d.value)}</div>
                          <div className="text-xs text-primary">Active Members: {d.members || 0}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.plans.map((_, i) => <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

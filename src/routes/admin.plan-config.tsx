import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configApi, membersApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlanIcons } from "@/components/messmate/PlanBadge";
import { formatINR, formatTime12h } from "@/lib/messmate/dateHelpers";
import { toast } from "sonner";
import type { Meal } from "@/lib/messmate/types";

export const Route = createFileRoute("/admin/plan-config")({
  head: () => ({ meta: [{ title: "Plan Config — MessMate Admin" }] }),
  component: PlanConfigPage,
});

function PlanConfigPage() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => configApi.listPlans() });
  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const membersQ = useQuery({ queryKey: ["members", "all"], queryFn: () => membersApi.list({ limit: 500 }) });

  const plans = plansQ.data ?? [];
  const windows = windowsQ.data ?? [];
  const members = membersQ.data?.items ?? [];

  const updatePlanM = useMutation({
    mutationFn: ({ planId, price }: { planId: string; price: number }) =>
      configApi.updatePlan(planId, { pricePerMonth: price }),
    onSuccess: (_, v) => {
      toast.success(`${plans.find((p) => p.planId === v.planId)?.label ?? "Plan"} updated`);
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const updateWindowM = useMutation({
    mutationFn: ({ meal, startTime, endTime }: { meal: Meal; startTime: string; endTime: string }) =>
      configApi.updateWindow(meal, startTime, endTime),
    onSuccess: (_, v) => {
      toast.success(`${v.meal} window updated`);
      qc.invalidateQueries({ queryKey: ["windows"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Plan Configuration</h1>
        <p className="text-sm text-muted-foreground">Manage subscription plans and meal time windows</p>
      </header>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Subscription Plans</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const count = members.filter((m) => m.subscription.planId === p.planId).length;
            return (
              <div key={p.planId} className="rounded-xl border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-lg font-bold">{p.label}</div>
                    <PlanIcons plan={p} />
                  </div>
                  <Badge variant="secondary">{count} members</Badge>
                </div>
                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">Price / month</Label>
                  <Input
                    type="number"
                    defaultValue={p.pricePerMonth}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      if (v && v !== p.pricePerMonth) updatePlanM.mutate({ planId: p.planId, price: v });
                    }}
                  />
                  <div className="mt-1 text-xs text-muted-foreground">Currently {formatINR(p.pricePerMonth)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Meal Time Windows</h3>
        <p className="mb-4 text-sm text-muted-foreground">Scans outside the configured window will be denied with WRONG_TIME.</p>
        <div className="space-y-3">
          {windows.map((w) => (
            <div key={w.meal} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
              <div className="min-w-32">
                <div className="font-display text-lg font-bold">{w.meal}</div>
                <div className="text-xs text-muted-foreground">{formatTime12h(w.startTime)} – {formatTime12h(w.endTime)}</div>
              </div>
              <div>
                <Label className="text-xs">Start</Label>
                <Input type="time" defaultValue={w.startTime}
                  onBlur={(e) => { if (e.target.value !== w.startTime) updateWindowM.mutate({ meal: w.meal, startTime: e.target.value, endTime: w.endTime }); }} />
              </div>
              <div>
                <Label className="text-xs">End</Label>
                <Input type="time" defaultValue={w.endTime}
                  onBlur={(e) => { if (e.target.value !== w.endTime) updateWindowM.mutate({ meal: w.meal, startTime: w.startTime, endTime: e.target.value }); }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

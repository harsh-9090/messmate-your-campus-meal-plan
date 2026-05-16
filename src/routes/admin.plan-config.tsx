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
import { Plus, Edit2, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MEALS } from "@/lib/messmate/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import type { Meal, Plan } from "@/lib/messmate/types";

export const Route = createFileRoute("/admin/plan-config")({
  head: () => ({ meta: [{ title: "Plan Config — MessMate Admin" }] }),
  component: PlanConfigPage,
});

function PlanConfigPage() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => configApi.listPlans() });
  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const membersQ = useQuery({ queryKey: ["members", "all"], queryFn: () => membersApi.list({ limit: 500 }) });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const plans = plansQ.data ?? [];
  const windows = windowsQ.data ?? [];
  const members = membersQ.data?.items ?? [];

  const updateWindowM = useMutation({
    mutationFn: ({ meal, startTime, endTime }: { meal: Meal; startTime: string; endTime: string }) =>
      configApi.updateWindow(meal, startTime, endTime),
    onSuccess: (_, v) => {
      toast.success(`${v.meal} window updated`);
      qc.invalidateQueries({ queryKey: ["windows"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deletePlanM = useMutation({
    mutationFn: (planId: string) => configApi.updatePlan(planId, { isActive: false } as any),
    onSuccess: () => {
      toast.success("Plan deleted");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["plans"] });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Plan Configuration</h1>
          <p className="text-sm text-muted-foreground">Manage subscription plans and meal time windows</p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Plan
        </Button>
      </header>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Subscription Plans</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const count = members.filter((m) => m.subscription.planId === p.planId).length;
            return (
              <div key={p.planId} className="group relative rounded-xl border p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-lg font-bold">{p.label}</div>
                    <PlanIcons plan={p} />
                  </div>
                  <Badge variant="secondary">{count} members</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Price / {p.durationMonths ?? 1}mo</div>
                    <div className="text-lg font-bold text-primary">{formatINR(p.pricePerMonth)}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Meal Windows same as before */}
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

      <AddPlanDialog open={adding} onOpenChange={setAdding} onSaved={invalidate} />
      {editing && <EditPlanDialog plan={editing} onClose={() => setEditing(null)} onSaved={invalidate} onDelete={() => deletePlanM.mutate(editing.planId)} />}
    </div>
  );
}

function AddPlanDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; }) {
  const [planId, setPlanId] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("1");
  const [meals, setMeals] = useState<Meal[]>(["Breakfast", "Lunch", "Dinner"]);

  const createM = useMutation({
    mutationFn: () => configApi.createPlan({ planId, label, pricePerMonth: parseInt(price) || 0, durationMonths: parseInt(duration) || 1, meals }),
    onSuccess: () => {
      toast.success("Plan created");
      onSaved();
      onOpenChange(false);
      setPlanId(""); setLabel(""); setPrice(""); setDuration("1");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add New Plan</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan ID (e.g. VIP_30)</Label>
              <Input placeholder="VIP_30" value={planId} onChange={e => setPlanId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Label (Display Name)</Label>
              <Input placeholder="Premium Plan" value={label} onChange={e => setLabel(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price for duration (₹)</Label>
              <Input type="number" placeholder="2500" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration (Months)</Label>
              <Input type="number" min="1" max="12" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Included Meals</Label>
            <div className="flex gap-4">
              {MEALS.map(m => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={meals.includes(m)} onCheckedChange={v => setMeals(v ? [...meals, m] : meals.filter(x => x !== m))} />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createM.mutate()} disabled={createM.isPending || !planId || !label || !price}>
            {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({ plan, onClose, onSaved, onDelete }: { plan: Plan; onClose: () => void; onSaved: () => void; onDelete: () => void; }) {
  const [label, setLabel] = useState(plan.label);
  const [price, setPrice] = useState(plan.pricePerMonth.toString());
  const [duration, setDuration] = useState((plan.durationMonths ?? 1).toString());
  const [meals, setMeals] = useState<Meal[]>(plan.meals);

  const saveM = useMutation({
    mutationFn: () => configApi.updatePlan(plan.planId, { label, pricePerMonth: parseInt(price) || 0, durationMonths: parseInt(duration) || 1, meals }),
    onSuccess: () => { toast.success("Plan updated"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {plan.label}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price for duration (₹)</Label>
              <Input type="number" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration (Months)</Label>
              <Input type="number" min="1" max="12" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Included Meals</Label>
            <div className="flex gap-4">
              {MEALS.map(m => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={meals.includes(m)} onCheckedChange={v => setMeals(v ? [...meals, m] : meals.filter(x => x !== m))} />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="destructive" className="sm:mr-auto" onClick={() => { if(confirm("Are you sure? This will deactivate the plan.")) { onDelete(); onClose(); } }}>Deactivate</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

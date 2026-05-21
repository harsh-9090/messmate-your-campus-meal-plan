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
import {
  Plus,
  Edit2,
  Loader2,
  Check,
  X,
  Trash2,
  Power,
  PowerOff,
  Sun,
  Utensils,
  Moon,
} from "lucide-react";
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
  head: () => ({ meta: [{ title: "Plan Config - Mom's Kitchen Admin" }] }),
  component: PlanConfigPage,
});

function PlanConfigPage() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => configApi.listPlans() });
  const windowsQ = useQuery({ queryKey: ["windows"], queryFn: () => configApi.listWindows() });
  const membersQ = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => membersApi.list({ limit: 500 }),
  });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const plans = plansQ.data ?? [];
  const windows = windowsQ.data ?? [];
  const members = membersQ.data?.items ?? [];

  const updateWindowM = useMutation({
    mutationFn: ({
      meal,
      startTime,
      endTime,
      guestPrice,
    }: {
      meal: Meal;
      startTime: string;
      endTime: string;
      guestPrice?: number;
    }) => configApi.updateWindow(meal, startTime, endTime, guestPrice),
    onSuccess: (_, v) => {
      toast.success(`${v.meal} window updated`);
      qc.invalidateQueries({ queryKey: ["windows"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deactivatePlanM = useMutation({
    mutationFn: ({ planId, isActive }: { planId: string; isActive: boolean }) =>
      configApi.updatePlan(planId, { isActive } as any),
    onSuccess: (_, v) => {
      toast.success(v.isActive ? "Plan activated" : "Plan deactivated");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deletePlanM = useMutation({
    mutationFn: (planId: string) => configApi.removePlan(planId),
    onSuccess: () => {
      toast.success("Plan deleted permanently");
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["plans"] });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Plan Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Manage subscription plans and meal time windows
          </p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Plan
        </Button>
      </header>

      <Card className="p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Subscription Plans</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const count = members.filter((m) => m.subscription.planId === p.planId).length;
            return (
              <div
                key={p.planId}
                className={`group relative rounded-xl border p-3 sm:p-4 transition-all ${p.isActive ? "hover:border-primary/50" : "bg-muted/30 opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <div className="font-display text-sm sm:text-lg font-bold leading-tight">
                        {p.label}
                      </div>
                      {!p.isActive && (
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1">
                      <PlanIcons plan={p} />
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                    {count} mem
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-1">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Price / {p.durationMonths ?? 1}mo
                    </div>
                    <div className="text-base sm:text-lg font-bold text-primary leading-tight">
                      {formatINR(p.pricePerMonth)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditing(p)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Permanently delete this plan?")) deletePlanM.mutate(p.planId);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Meal Windows same as before */}
      <Card className="p-5 sm:p-6 overflow-hidden relative">
        <div className="mb-6">
          <h3 className="font-display text-xl font-bold">Meal Time Windows</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure when students are allowed to scan for each meal.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6">
          {windows.map((w) => {
            const Icon = w.meal === "Breakfast" ? Plus : w.meal === "Lunch" ? Plus : Plus; // I'll use better icons below
            return (
              <div
                key={w.meal}
                className="group relative rounded-2xl border bg-card p-5 transition-all hover:shadow-md"
              >
                <div className="grid sm:grid-cols-[1fr_auto_auto] items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm group-hover:scale-105 transition-transform">
                      {w.meal === "Breakfast" && <Sun className="h-6 w-6" />}
                      {w.meal === "Lunch" && <Utensils className="h-6 w-6" />}
                      {w.meal === "Dinner" && <Moon className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="font-display text-lg font-bold leading-tight">{w.meal}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                        Current: {formatTime12h(w.startTime)} – {formatTime12h(w.endTime)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:flex items-stretch sm:items-end gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">
                        Start Time
                      </Label>
                      <div className="relative">
                        <Input
                          type="time"
                          defaultValue={w.startTime}
                          className="h-11 w-full sm:w-28 bg-muted/30 border-transparent focus:bg-background rounded-xl transition-all"
                          onBlur={(e) => {
                            if (e.target.value !== w.startTime)
                              updateWindowM.mutate({
                                meal: w.meal,
                                startTime: e.target.value,
                                endTime: w.endTime,
                                guestPrice: w.guestPrice,
                              });
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">
                        End Time
                      </Label>
                      <div className="relative">
                        <Input
                          type="time"
                          defaultValue={w.endTime}
                          className="h-11 w-full sm:w-28 bg-muted/30 border-transparent focus:bg-background rounded-xl transition-all"
                          onBlur={(e) => {
                            if (e.target.value !== w.endTime)
                              updateWindowM.mutate({
                                meal: w.meal,
                                startTime: w.startTime,
                                endTime: e.target.value,
                                guestPrice: w.guestPrice,
                              });
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">
                        Guest Price (₹)
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          defaultValue={w.guestPrice !== undefined ? w.guestPrice : 120}
                          className="h-11 w-full sm:w-28 bg-muted/30 border-transparent focus:bg-background rounded-xl transition-all font-semibold"
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== w.guestPrice)
                              updateWindowM.mutate({
                                meal: w.meal,
                                startTime: w.startTime,
                                endTime: w.endTime,
                                guestPrice: val,
                              });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <AddPlanDialog open={adding} onOpenChange={setAdding} onSaved={invalidate} />
      {editing && (
        <EditPlanDialog
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
          onDeactivate={(isActive) => deactivatePlanM.mutate({ planId: editing.planId, isActive })}
        />
      )}
    </div>
  );
}

function AddPlanDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState("");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("1");
  const [meals, setMeals] = useState<Meal[]>(["Breakfast", "Lunch", "Dinner"]);

  const createM = useMutation({
    mutationFn: () =>
      configApi.createPlan({
        planId,
        label,
        pricePerMonth: parseInt(price) || 0,
        durationMonths: parseInt(duration) || 1,
        meals,
      }),
    onSuccess: () => {
      toast.success("Plan created");
      onSaved();
      onOpenChange(false);
      setPlanId("");
      setLabel("");
      setPrice("");
      setDuration("1");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add New Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan ID (e.g. VIP_30)</Label>
              <Input
                placeholder="VIP_30"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Label (Display Name)</Label>
              <Input
                placeholder="Premium Plan"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price for duration (₹)</Label>
              <Input
                type="number"
                placeholder="2500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (Months)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Included Meals</Label>
            <div className="flex gap-4">
              {MEALS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={meals.includes(m)}
                    onCheckedChange={(v) =>
                      setMeals(v ? [...meals, m] : meals.filter((x) => x !== m))
                    }
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createM.mutate()}
            disabled={createM.isPending || !planId || !label || !price}
          >
            {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({
  plan,
  onClose,
  onSaved,
  onDeactivate,
}: {
  plan: Plan;
  onClose: () => void;
  onSaved: () => void;
  onDeactivate: (isActive: boolean) => void;
}) {
  const [label, setLabel] = useState(plan.label);
  const [price, setPrice] = useState(plan.pricePerMonth.toString());
  const [duration, setDuration] = useState((plan.durationMonths ?? 1).toString());
  const [meals, setMeals] = useState<Meal[]>(plan.meals);

  const saveM = useMutation({
    mutationFn: () =>
      configApi.updatePlan(plan.planId, {
        label,
        pricePerMonth: parseInt(price) || 0,
        durationMonths: parseInt(duration) || 1,
        meals,
      }),
    onSuccess: () => {
      toast.success("Plan updated");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit {plan.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price for duration (₹)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration (Months)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Included Meals</Label>
            <div className="flex gap-4">
              {MEALS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={meals.includes(m)}
                    onCheckedChange={(v) =>
                      setMeals(v ? [...meals, m] : meals.filter((x) => x !== m))
                    }
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="sm:mr-auto gap-2"
            onClick={() => {
              onDeactivate(!plan.isActive);
              onClose();
            }}
          >
            {plan.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            {plan.isActive ? "Deactivate Plan" : "Activate Plan"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

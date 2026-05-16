import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { membersApi, configApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, RefreshCw, Trash2, Edit3, Loader2 } from "lucide-react";
import { PlanBadge, PlanIcons } from "@/components/messmate/PlanBadge";
import { todayISO, daysRemaining, formatDate } from "@/lib/messmate/dateHelpers";
import { MEALS } from "@/lib/messmate/constants";
import type { Meal, Member, Plan } from "@/lib/messmate/types";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Members — MessMate Admin" }] }),
  component: MembersPage,
});

function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "expired" | "unpaid">("all");
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const membersQ = useQuery({
    queryKey: ["members", { search, status }],
    queryFn: () => membersApi.list({ search, status, limit: 500 }),
  });
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => configApi.listPlans() });

  const members = membersQ.data?.items ?? [];
  const plans = plansQ.data ?? [];

  const filtered = useMemo(() => members, [members]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["members"] });

  const renewM = useMutation({
    mutationFn: (id: string) => membersApi.renew(id),
    onSuccess: () => { toast.success("Plan renewed"); invalidate(); },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => membersApi.remove(id),
    onSuccess: () => { toast.success("Member removed"); invalidate(); },
  });

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {membersQ.isLoading ? "Loading…" : `${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={() => setOpenAdd(true)} disabled={!plans.length}>
          <Plus className="mr-1 h-4 w-4" /> Add Member
        </Button>
      </header>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name, ID, room…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={(v: typeof status) => setStatus(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Member</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Meals</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {membersQ.isLoading && (
                <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>
              )}
              {!membersQ.isLoading && filtered.map((m) => {
                const left = daysRemaining(m.subscription.endDate);
                const expired = left < 0;
                return (
                  <tr key={m.memberId} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
                          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <div className="font-medium leading-tight">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.memberId} · {m.room}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><PlanBadge planId={m.subscription.planId} label={m.subscription.planLabel} /></td>
                    <td className="px-4 py-3"><PlanIcons plan={m.subscription} /></td>
                    <td className="px-4 py-3 text-xs">{formatDate(m.subscription.startDate)}</td>
                    <td className={cn("px-4 py-3 text-xs", expired && "text-destructive font-semibold", !expired && left <= 3 && "text-warning font-semibold")}>
                      {formatDate(m.subscription.endDate)}
                      <div className="text-[10px] text-muted-foreground">
                        {expired ? `${-left}d ago` : `${left}d left`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {!m.subscription.isPaid ? <Badge variant="destructive">Unpaid</Badge>
                        : expired ? <Badge variant="destructive">Expired</Badge>
                        : <Badge className="bg-success text-success-foreground">Active</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(m)}><Edit3 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" disabled={renewM.isPending} onClick={() => renewM.mutate(m.memberId)}><RefreshCw className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${m.name}?`)) deleteM.mutate(m.memberId); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!membersQ.isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddMemberDialog open={openAdd} onOpenChange={setOpenAdd} plans={plans} onCreated={invalidate} />
      {editing && (
        <EditMemberDialog
          member={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function AddMemberDialog({ open, onOpenChange, plans, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; plans: Plan[]; onCreated: () => void; }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [room, setRoom] = useState("");
  const [password, setPassword] = useState("pass123");
  const [planId, setPlanId] = useState(plans[0]?.planId ?? "");
  const [meals, setMeals] = useState<Meal[]>(plans[0]?.meals ?? ["Breakfast", "Lunch", "Dinner"]);
  const [startDate, setStartDate] = useState(todayISO());
  const [isPaid, setIsPaid] = useState(true);

  const onPlanChange = (id: string) => {
    setPlanId(id);
    const p = plans.find((x) => x.planId === id);
    if (p) setMeals(p.meals);
  };

  const createM = useMutation({
    mutationFn: () => membersApi.create({ name, email, password, room, planId, meals, startDate, isPaid }),
    onSuccess: (m) => {
      toast.success(`${m.name} added (${m.memberId})`);
      onCreated();
      onOpenChange(false);
      setName(""); setEmail(""); setRoom("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add new member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} /></div>
          </div>
          <div><Label>Initial password</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={onPlanChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.planId} value={p.planId}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Meals included</Label>
            <div className="mt-1 flex gap-3">
              {MEALS.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={meals.includes(m)}
                    onCheckedChange={(v) => setMeals(v ? [...meals, m] : meals.filter((x) => x !== m))}
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="flex items-end gap-2"><Switch checked={isPaid} onCheckedChange={setIsPaid} /><Label>Paid</Label></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createM.mutate()} disabled={createM.isPending || !name || !email || !planId}>
            {createM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member, plans, onClose, onSaved }: { member: Member; plans: Plan[]; onClose: () => void; onSaved: () => void; }) {
  const [name, setName] = useState(member.name);
  const [room, setRoom] = useState(member.room);
  const [planId, setPlanId] = useState(member.subscription.planId);
  const [meals, setMeals] = useState<Meal[]>(member.subscription.meals);
  const [isPaid, setIsPaid] = useState(member.subscription.isPaid);

  const saveM = useMutation({
    mutationFn: async () => {
      await membersApi.update(member.memberId, { name, room });
      await membersApi.changePlan(member.memberId, { planId, meals });
      await membersApi.setPaid(member.memberId, isPaid);
    },
    onSuccess: () => { toast.success("Member updated"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit {member.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} /></div>
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={(v) => { setPlanId(v); const p = plans.find((x) => x.planId === v); if (p) setMeals(p.meals); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => <SelectItem key={p.planId} value={p.planId}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            {MEALS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox checked={meals.includes(m)} onCheckedChange={(v) => setMeals(v ? [...meals, m] : meals.filter((x) => x !== m))} />
                {m}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Payment</div>
              <div className="text-xs text-muted-foreground">{isPaid ? "Paid" : "Unpaid"}</div>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            {saveM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

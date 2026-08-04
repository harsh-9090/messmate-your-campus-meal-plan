import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { renewalsApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, User, Calendar, IndianRupee } from "lucide-react";
import { formatINR, formatDate } from "@/lib/messmate/dateHelpers";
import { useState } from "react";

export const Route = createFileRoute("/admin/renewals")({
  component: AdminRenewals,
});

function AdminRenewals() {
  const qc = useQueryClient();
  const reqsQ = useQuery({
    queryKey: ["admin-renewals"],
    queryFn: () => renewalsApi.list(),
  });

  const reqs = reqsQ.data ?? [];

  const [amountPaid, setAmountPaid] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const approveM = useMutation({
    mutationFn: (args: { id: string; amountPaid: number }) =>
      renewalsApi.approve(args.id, args.amountPaid),
    onSuccess: () => {
      toast.success("Request approved and member renewed!");
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ["admin-renewals"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to approve");
    },
  });

  const rejectM = useMutation({
    mutationFn: (id: string) => renewalsApi.reject(id),
    onSuccess: () => {
      toast.success("Request rejected.");
      qc.invalidateQueries({ queryKey: ["admin-renewals"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to reject");
    },
  });

  if (reqsQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Pending Renewals</h1>
        <p className="text-muted-foreground">Review and approve plan renewal requests.</p>
      </div>

      <div className="space-y-4">
        {reqs.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground border shadow-sm">
            No pending renewal requests.
          </Card>
        ) : (
          <>
            {/* Desktop Table View */}
            <Card className="hidden md:block overflow-hidden border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Member</th>
                      <th className="px-6 py-4">Requested Plan</th>
                      <th className="px-6 py-4">Start Date</th>
                      <th className="px-6 py-4">Current Due</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {reqs.map((req) => (
                      <tr key={req.id} className="transition-colors hover:bg-muted/10">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-semibold text-foreground">
                                {req.member_name} <span className="text-xs text-muted-foreground">({req.member_id})</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{req.member_mobile || req.member_email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold">{req.plan_label}</div>
                          <div className="text-xs text-muted-foreground">{formatINR(req.plan_price || 0)}/mo</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatDate(req.start_date)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={(req.current_due || 0) > 0 ? "border-destructive text-destructive" : ""}>
                            {formatINR(req.current_due || 0)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              disabled={rejectM.isPending}
                              onClick={() => {
                                if (window.confirm("Reject this renewal request?")) {
                                  rejectM.mutate(req.id);
                                }
                              }}
                            >
                              Reject
                            </Button>
                            <Dialog open={openId === req.id} onOpenChange={(val) => setOpenId(val ? req.id : null)}>
                              <DialogTrigger asChild>
                                <Button size="sm" onClick={() => setAmountPaid({ ...amountPaid, [req.id]: String(req.plan_price) })}>
                                  Approve
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="w-[90vw] max-w-md rounded-xl sm:max-w-[400px]">
                                <div className="mb-2 text-lg font-bold">Approve Renewal</div>
                                <div className="text-sm text-muted-foreground mb-4">
                                  Approving will instantly assign the {req.plan_label} starting on {formatDate(req.start_date)}.
                                </div>
                                <div className="space-y-4">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount Paid (Cash)</label>
                                    <div className="relative">
                                      <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                      <Input 
                                        className="pl-9 font-mono"
                                        type="number"
                                        value={amountPaid[req.id] || ""}
                                        onChange={(e) => setAmountPaid({ ...amountPaid, [req.id]: e.target.value })}
                                      />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Leave 0 if they haven't paid yet (they will enter grace period).</p>
                                  </div>
                                  <Button 
                                    className="w-full"
                                    disabled={approveM.isPending}
                                    onClick={() => {
                                      approveM.mutate({ id: req.id, amountPaid: Number(amountPaid[req.id]) || 0 });
                                    }}
                                  >
                                    {approveM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Confirm Approval
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {reqs.map((req) => (
                <Card key={req.id} className="p-4 border shadow-sm space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-semibold text-foreground">
                          {req.member_name} <span className="text-xs text-muted-foreground">({req.member_id})</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{req.member_mobile || req.member_email}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={(req.current_due || 0) > 0 ? "border-destructive text-destructive" : ""}>
                      Due: {formatINR(req.current_due || 0)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-3 rounded-lg">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Requested Plan</div>
                      <div className="font-semibold">{req.plan_label}</div>
                      <div className="text-xs text-muted-foreground">{formatINR(req.plan_price || 0)}/mo</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Start Date</div>
                      <div className="flex items-center gap-1.5 text-foreground font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(req.start_date)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      disabled={rejectM.isPending}
                      onClick={() => {
                        if (window.confirm("Reject this renewal request?")) {
                          rejectM.mutate(req.id);
                        }
                      }}
                    >
                      Reject
                    </Button>
                    <Dialog open={openId === req.id} onOpenChange={(val) => setOpenId(val ? req.id : null)}>
                      <DialogTrigger asChild>
                        <Button className="flex-1" onClick={() => setAmountPaid({ ...amountPaid, [req.id]: String(req.plan_price) })}>
                          Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[90vw] max-w-md rounded-xl p-5">
                        <div className="mb-2 text-lg font-bold">Approve Renewal</div>
                        <div className="text-sm text-muted-foreground mb-4">
                          Approving will instantly assign the {req.plan_label} starting on {formatDate(req.start_date)}.
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Amount Paid (Cash)</label>
                            <div className="relative">
                              <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                className="pl-9 font-mono"
                                type="number"
                                value={amountPaid[req.id] || ""}
                                onChange={(e) => setAmountPaid({ ...amountPaid, [req.id]: e.target.value })}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Leave 0 if they haven't paid yet (they will enter grace period).</p>
                          </div>
                          <Button 
                            className="w-full"
                            disabled={approveM.isPending}
                            onClick={() => {
                              approveM.mutate({ id: req.id, amountPaid: Number(amountPaid[req.id]) || 0 });
                            }}
                          >
                            {approveM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm Approval
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

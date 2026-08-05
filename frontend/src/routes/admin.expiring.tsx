import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { reportsApi, configApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PlanBadge } from "@/components/messmate/PlanBadge";
import { GhostLoader } from "@/components/messmate/GhostLoader";
import { daysRemaining, formatDate } from "@/lib/messmate/dateHelpers";
import { Send, Clock } from "lucide-react";
import type { Member } from "@/lib/messmate/types";
import {
  ViewMemberDialog,
  RenewMemberDialog,
} from "@/components/messmate/MemberAdminDialogs";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/expiring")({
  head: () => ({ meta: [{ title: "Expiring Soon - Mom's Kitchen Admin" }] }),
  component: ExpiringPage,
});

function ExpiringPage() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);

  const expiringQ = useQuery({ queryKey: ["reports", "expiring"], queryFn: () => reportsApi.expiring(7) });
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => configApi.listPlans() });

  const remindMutation = useMutation({
    mutationFn: (ids: string[]) => reportsApi.remindBulk(ids),
    onSuccess: (data) => {
      toast.success(`Successfully sent reminders to ${data.notifiedCount} members!`);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send reminders");
    }
  });

  if (expiringQ.isLoading) {
    return <GhostLoader size="fullscreen" />;
  }

  const members = (expiringQ.data ?? []).sort(
    (a, b) => daysRemaining(a.subscription.endDate) - daysRemaining(b.subscription.endDate)
  );

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(members.map((m) => m.memberId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleBulkRemind = () => {
    if (selectedIds.size === 0) return;
    remindMutation.mutate(Array.from(selectedIds));
  };

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Expiring Soon</h1>
          <p className="text-sm text-muted-foreground">
            Members expiring within the next 7 days
          </p>
        </div>
      </header>

      <div>
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
            <div className="font-medium text-sm">
              <span className="text-primary font-bold">{selectedIds.size}</span> members selected
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRemind}
                disabled={remindMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {remindMutation.isPending ? "Sending..." : "Send Reminders"}
              </Button>
            </div>
          </div>
        )}

        <Card className="rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <Checkbox
                      checked={members.length > 0 && selectedIds.size === members.length}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Member</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Plan</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expiring In</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">End Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No members expiring soon.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const days = daysRemaining(m.subscription.endDate);
                    return (
                      <tr
                        key={m.memberId}
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("button") || target.closest("[role='checkbox']")) return;
                          setViewingMember(m);
                        }}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(m.memberId)}
                            onCheckedChange={(c) => toggleOne(m.memberId, !!c)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{m.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{m.memberId}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <PlanBadge planId={m.subscription.planId} label={m.subscription.planLabel} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={days === 0 ? "destructive" : days === 1 ? "default" : "secondary"}
                            className={days === 1 ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                          >
                            {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                          {formatDate(m.subscription.endDate)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenewingMember(m);
                            }}
                          >
                            Renew
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {viewingMember && (
        <ViewMemberDialog
          member={viewingMember}
          onClose={() => setViewingMember(null)}
          plans={plansQ.data ?? []}
        />
      )}

      {renewingMember && (
        <RenewMemberDialog
          member={renewingMember}
          plans={plansQ.data ?? []}
          onClose={() => setRenewingMember(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["members"] });
            qc.invalidateQueries({ queryKey: ["reports", "expiring"] });
          }}
        />
      )}
    </div>
  );
}

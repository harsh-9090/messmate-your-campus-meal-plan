import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentsApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, Trash2, Calendar, User, CreditCard, Search, Loader2 } from "lucide-react";
import { formatINR, formatTimestamp } from "@/lib/messmate/dateHelpers";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — MessMate Admin" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const paymentsQ = useQuery({ 
    queryKey: ["payments"], 
    queryFn: () => paymentsApi.list({ limit: 200 }) 
  });

  const deletePaymentM = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => {
      toast.success("Payment record deleted");
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (paymentsQ.isError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Failed to load payments</h2>
        <p className="text-muted-foreground">{(paymentsQ.error as any)?.message || "Unknown error"}</p>
        <Button className="mt-4" onClick={() => paymentsQ.refetch()}>Try Again</Button>
      </div>
    );
  }

  const payments = paymentsQ.data ?? [];
  const filtered = payments.filter(p => 
    (p.memberName?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
    (p.memberId?.toLowerCase() ?? "").includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">Manage financial transactions and audit history</p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search member or ID..." 
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {paymentsQ.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {paymentsQ.isLoading ? "Loading payments..." : "No payments found."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {p.createdAt ? formatTimestamp(p.createdAt) : '---'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{p.memberName || 'Unknown'}</span>
                        <span className="text-[10px] text-muted-foreground">{p.memberId || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{p.planLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        {p.method}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`capitalize ${
                          p.type === 'initial' ? 'bg-primary/10 text-primary' : 
                          p.type === 'renewal' ? 'bg-indigo-100 text-indigo-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {p.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {formatINR(p.amount)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => { if(confirm("Delete this payment record? This cannot be undone.")) deletePaymentM.mutate(p.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

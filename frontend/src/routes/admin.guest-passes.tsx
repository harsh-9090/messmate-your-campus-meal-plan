import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestPassesApi } from "@/lib/messmate/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Ticket, 
  CheckCircle, 
  Search, 
  Loader2, 
  Calendar, 
  User, 
  IndianRupee, 
  AlertCircle,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { formatINR } from "@/lib/messmate/dateHelpers";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/guest-passes")({
  head: () => ({ meta: [{ title: "Guest Passes - Mom's Kitchen Admin" }] }),
  component: AdminGuestPassesPage,
});

function AdminGuestPassesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  // Fetch pending approvals
  const pendingQ = useQuery({
    queryKey: ["guest-passes-pending"],
    queryFn: () => guestPassesApi.listPending(),
  });

  // Fetch all history
  const allQ = useQuery({
    queryKey: ["guest-passes-all"],
    queryFn: () => guestPassesApi.listAll(),
  });

  // Approve mutation
  const approveM = useMutation({
    mutationFn: (id: string) => guestPassesApi.approve(id),
    onSuccess: () => {
      toast.success("Guest pass approved & activated!");
      qc.invalidateQueries({ queryKey: ["guest-passes-pending"] });
      qc.invalidateQueries({ queryKey: ["guest-passes-all"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to approve guest pass");
    },
  });

  if (pendingQ.isError || allQ.isError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive">Failed to load guest passes</h2>
        <p className="text-muted-foreground">
          {((pendingQ.error || allQ.error) as any)?.message || "Unknown error occurred"}
        </p>
        <Button className="mt-4" onClick={() => { pendingQ.refetch(); allQ.refetch(); }}>
          Try Again
        </Button>
      </div>
    );
  }

  const pendingPasses = pendingQ.data ?? [];
  const allPasses = allQ.data ?? [];

  // Filter lists based on search
  const filterPasses = (list: typeof allPasses) => {
    return list.filter(
      (gp) =>
        (gp.guest_name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (gp.host_name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
        (gp.member_id?.toLowerCase() ?? "").includes(search.toLowerCase())
    );
  };

  const filteredPending = filterPasses(pendingPasses);
  const filteredAll = filterPasses(allPasses);

  // Compute stat metrics
  const totalPendingCount = pendingPasses.length;
  const totalRevenue = allPasses
    .filter((gp) => gp.status === "active" || gp.status === "used")
    .reduce((sum, gp) => sum + (gp.price || 0), 0);
  const totalUsedCount = allPasses.filter((gp) => gp.status === "used").length;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Guest Passes</h1>
          <p className="text-sm text-muted-foreground">
            Approve counter payments and audit visitor access logs
          </p>
        </div>
      </header>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center justify-between border-l-4 border-l-amber-500 shadow-sm">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Awaiting Payment</div>
            <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{totalPendingCount}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Clock className="h-6 w-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between border-l-4 border-l-emerald-500 shadow-sm">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Revenue</div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{formatINR(totalRevenue)}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="h-6 w-6" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between border-l-4 border-l-indigo-500 shadow-sm">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Used / Scanned Passes</div>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{totalUsedCount}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
            <CheckCircle className="h-6 w-6" />
          </div>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b pb-4">
          <TabsList className="bg-slate-100 dark:bg-slate-900 border">
            <TabsTrigger value="pending" className="font-semibold">
              Pending Counter Payments ({totalPendingCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="font-semibold">
              All Guest Passes ({allPasses.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Guest, Host or ID..."
                className="pl-9 h-10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {(pendingQ.isFetching || allQ.isFetching) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <TabsContent value="pending" className="mt-4">
          <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-950/20">
                    <TableHead>Host Member</TableHead>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Date & Meal</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-semibold">
                        {pendingQ.isLoading ? "Loading pending guest passes..." : "No guest passes awaiting payment."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPending.map((gp) => (
                      <TableRow key={gp.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{gp.host_name || "Unknown"}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">ID: {gp.member_id} · {gp.host_mobile}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                          {gp.guest_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="font-bold border-slate-200/80">
                              {gp.date}
                            </Badge>
                            <Badge className="font-bold bg-primary/10 text-primary hover:bg-primary/15 border-none">
                              {gp.meal}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-amber-600">
                          {formatINR(gp.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="rounded-xl h-9 px-4 shadow-sm"
                            onClick={() => approveM.mutate(gp.id)}
                            disabled={approveM.isPending}
                          >
                            {approveM.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Mark Paid & Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-950/20">
                    <TableHead>Host Member</TableHead>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Date & Meal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-semibold">
                        {allQ.isLoading ? "Loading guest passes history..." : "No guest passes found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAll.map((gp) => (
                      <TableRow key={gp.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{gp.host_name || "Unknown"}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold">ID: {gp.member_id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                          {gp.guest_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="font-bold border-slate-200/80">
                              {gp.date}
                            </Badge>
                            <Badge className="font-bold bg-primary/10 text-primary hover:bg-primary/15 border-none">
                              {gp.meal}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`capitalize font-bold ${
                              gp.status === "active"
                                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                : gp.status === "used"
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                  : gp.status === "pending_approval"
                                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                                    : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {gp.status === "pending_approval" ? "Pending Cash" : gp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-slate-700 dark:text-slate-300">
                          {formatINR(gp.price)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

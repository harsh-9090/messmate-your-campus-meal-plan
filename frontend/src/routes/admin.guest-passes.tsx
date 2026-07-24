import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guestPassesApi, configApi } from "@/lib/messmate/api";
import { GuestPass } from "@/lib/messmate/types";
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
  ArrowUpRight,
  Mail,
  Check,
  Eye,
  MessageCircle,
} from "lucide-react";
import { formatINR } from "@/lib/messmate/dateHelpers";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import QRCode from "qrcode";

export const Route = createFileRoute("/admin/guest-passes")({
  head: () => ({ meta: [{ title: "Guest Passes - Mom's Kitchen Admin" }] }),
  component: AdminGuestPassesPage,
});

function AdminGuestPassesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [viewPass, setViewPass] = useState<(GuestPass & { guest_mobile?: string }) | null>(null);

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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Guest Passes</h1>
          <p className="text-sm text-muted-foreground">
            Approve counter payments and audit visitor access logs
          </p>
        </div>
        <Button
          onClick={() => setWalkInOpen(true)}
          className="rounded-xl font-bold shadow-sm cursor-pointer h-10 px-5 gap-2"
        >
          <Ticket className="h-4 w-4" />
          <span>Issue Walk-in Pass</span>
        </Button>
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
          <TabsList className="bg-slate-100 dark:bg-slate-900 border grid grid-cols-2 w-full sm:w-auto h-auto p-1 rounded-xl">
            <TabsTrigger value="pending" className="font-semibold py-2 px-3 text-xs sm:text-sm">
              Pending ({totalPendingCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="font-semibold py-2 px-3 text-xs sm:text-sm">
              All Passes ({allPasses.length})
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

        <TabsContent value="pending" className="mt-4 space-y-4">
          {/* Desktop Table View */}
          <Card className="hidden md:block overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl">
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

          {/* Mobile Card-Based View */}
          <div className="md:hidden space-y-3">
            {pendingQ.isLoading ? (
              <Card className="p-8 text-center text-muted-foreground font-semibold">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                Loading pending guest passes...
              </Card>
            ) : filteredPending.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground font-semibold">
                No guest passes awaiting payment.
              </Card>
            ) : (
              filteredPending.map((gp) => (
                <Card key={gp.id} className="p-4 space-y-3 border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{gp.host_name || "Unknown"}</div>
                      <div className="text-[10px] text-muted-foreground font-semibold">
                        ID: {gp.member_id || "N/A"} · {gp.host_mobile || "N/A"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-amber-600 text-sm">
                        {formatINR(gp.price)}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold">Price</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dashed">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground font-semibold mr-1">Guest:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{gp.guest_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="font-bold border-slate-200/80 text-[10px] py-0 px-1.5">
                        {gp.date}
                      </Badge>
                      <Badge className="font-bold bg-primary/10 text-primary hover:bg-primary/15 border-none text-[10px] py-0 px-1.5">
                        {gp.meal}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button
                      size="sm"
                      className="w-full rounded-xl h-10 px-4 shadow-sm"
                      onClick={() => approveM.mutate(gp.id)}
                      disabled={approveM.isPending}
                    >
                      {approveM.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                      )}
                      Mark Paid & Approve
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-4">
          {/* Desktop Table View */}
          <Card className="hidden md:block overflow-hidden border border-slate-200/80 dark:border-slate-800 rounded-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-950/20">
                    <TableHead>Host Member</TableHead>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Date & Meal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-semibold">
                        {allQ.isLoading ? "Loading guest passes history..." : "No guest passes found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAll.map((gp) => (
                      <TableRow key={gp.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{gp.host_name || "Unknown"}</span>
                            {gp.member_id ? (
                              <span className="text-[10px] text-muted-foreground font-semibold">ID: {gp.member_id}</span>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Walk-in Ticket</span>
                            )}
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
                            className={`capitalize font-bold ${gp.status === "active"
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
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-8 px-3 shadow-sm"
                            onClick={() => setViewPass(gp)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile Card-Based View */}
          <div className="md:hidden space-y-3">
            {allQ.isLoading ? (
              <Card className="p-8 text-center text-muted-foreground font-semibold">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                Loading guest passes history...
              </Card>
            ) : filteredAll.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground font-semibold">
                No guest passes found.
              </Card>
            ) : (
              filteredAll.map((gp) => (
                <Card key={gp.id} className="p-4 space-y-3 border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in-50 duration-155">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">{gp.host_name || "Unknown"}</div>
                      {gp.member_id ? (
                        <span className="text-[10px] text-muted-foreground font-semibold">ID: {gp.member_id}</span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">Walk-in Ticket</span>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`capitalize font-bold text-[10px] py-0 px-2 ${gp.status === "active"
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
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-dashed text-xs gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Guest Name</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">{gp.guest_name}</span>
                    </div>
                    <div className="space-y-0.5 text-center">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Session</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="font-bold border-slate-200/80 text-[10px] py-0 px-1.5 h-4">
                          {gp.date}
                        </Badge>
                        <Badge className="font-bold bg-primary/10 text-primary hover:bg-primary/15 border-none text-[10px] py-0 px-1.5 h-4">
                          {gp.meal}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Amount</span>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 text-xs">{formatINR(gp.price)}</span>
                    </div>
                  </div>

                  <div className="pt-1 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full rounded-xl h-9 shadow-sm"
                      onClick={() => setViewPass(gp)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-2" />
                      View Pass / Resend QR
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      <WalkInPassDialog open={walkInOpen} onOpenChange={setWalkInOpen} />
      <ViewPassDialog pass={viewPass} onOpenChange={(open) => { if (!open) setViewPass(null); }} />
    </div>
  );
}

interface WalkInPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function WalkInPassDialog({ open, onOpenChange }: WalkInPassDialogProps) {
  const qc = useQueryClient();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [guestDate, setGuestDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [guestMeal, setGuestMeal] = useState<Meal>("Lunch");
  const [createdPass, setCreatedPass] = useState<(GuestPass & { guest_mobile?: string }) | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch meal windows to resolve dynamic pricing
  const windowsQ = useQuery({
    queryKey: ["windows"],
    queryFn: () => configApi.listWindows(),
  });

  const getGuestPriceOf = (mealName: Meal) => {
    const w = windowsQ.data?.find((x) => x.meal === mealName);
    return w?.guestPrice ?? 120;
  };

  const walkInM = useMutation({
    mutationFn: (data: { guestName: string; guestEmail?: string; guestMobile?: string; date: string; meal: Meal }) =>
      guestPassesApi.issueWalkIn(data),
    onSuccess: (pass) => {
      toast.success("Walk-in pass issued & email dispatched!");
      setCreatedPass(pass);
      qc.invalidateQueries({ queryKey: ["guest-passes-all"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to issue walk-in pass");
    },
  });

  useEffect(() => {
    if (!open) {
      setGuestName("");
      setGuestEmail("");
      setGuestMobile("");
      setGuestDate(new Date().toISOString().split("T")[0]);
      setGuestMeal("Lunch");
      setCreatedPass(null);
    }
  }, [open]);

  useEffect(() => {
    if (createdPass && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, createdPass.qr_token, {
        width: 180,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
        errorCorrectionLevel: "H",
      }).catch((err) => {
        console.error("QR Code generation failed", err);
      });
    }
  }, [createdPass]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            <span>{createdPass ? "Pass Issued Successfully!" : "Issue Walk-in Ticket"}</span>
          </DialogTitle>
        </DialogHeader>

        {!createdPass ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!guestName.trim()) {
                toast.error("Please enter guest name");
                return;
              }
              if (!guestEmail.trim() && !guestMobile.trim()) {
                toast.error("Please enter either an email or mobile number");
                return;
              }
              walkInM.mutate({
                guestName: guestName.trim(),
                guestEmail: guestEmail.trim() || undefined,
                guestMobile: guestMobile.trim() || undefined,
                date: guestDate,
                meal: guestMeal,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="guestName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Guest Name
              </Label>
              <Input
                id="guestName"
                placeholder="Enter visitor name..."
                required
                className="h-10 rounded-xl"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guestEmail" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Guest Email Address
                </Label>
                <Input
                  id="guestEmail"
                  type="email"
                  placeholder="visitor@email.com"
                  className="h-10 rounded-xl"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guestMobile" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Guest Mobile Number
                </Label>
                <Input
                  id="guestMobile"
                  type="tel"
                  placeholder="+91..."
                  className="h-10 rounded-xl"
                  value={guestMobile}
                  onChange={(e) => setGuestMobile(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guestDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Date
                </Label>
                <Input
                  id="guestDate"
                  type="date"
                  required
                  className="h-10 rounded-xl cursor-pointer"
                  value={guestDate}
                  onChange={(e) => setGuestDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guestMeal" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Meal Session
                </Label>
                <select
                  id="guestMeal"
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-semibold"
                  value={guestMeal}
                  onChange={(e) => setGuestMeal(e.target.value as Meal)}
                >
                  <option value="Breakfast">Breakfast (₹{getGuestPriceOf("Breakfast")})</option>
                  <option value="Lunch">Lunch (₹{getGuestPriceOf("Lunch")})</option>
                  <option value="Dinner">Dinner (₹{getGuestPriceOf("Dinner")})</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                className="w-full h-10 rounded-xl font-bold shadow-sm"
                disabled={walkInM.isPending}
              >
                {walkInM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Confirm Payment & Issue (₹{getGuestPriceOf(guestMeal)})
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="text-center space-y-5 py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center">
              <Check className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Active Walk-in Ticket</h3>
              {guestEmail && (
                <p className="text-xs text-muted-foreground">
                  Email with instructions sent to <strong className="text-slate-700 dark:text-slate-300">{guestEmail}</strong>
                </p>
              )}
            </div>

            <div className="flex flex-col items-center">
              <canvas ref={canvasRef} className="border p-2.5 rounded-xl bg-white shadow-sm" />
              <p className="text-[10px] text-muted-foreground font-semibold mt-2.5">
                Scan this QR code directly for entry validation
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-3 text-left space-y-1.5 border border-border/40 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Guest Name:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{createdPass.guest_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Meal & Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {createdPass.meal} ({createdPass.date})
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="text-muted-foreground font-semibold">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">₹{createdPass.price}</span>
              </div>
            </div>

            {createdPass.guest_mobile && (
              <Button
                className="w-full h-10 rounded-xl font-bold shadow-sm bg-[#25D366] hover:bg-[#128C7E] text-white"
                onClick={() => {
                  const message = `Here is your Mom's Kitchen walk-in ticket for ${createdPass.meal} on ${createdPass.date}.\n\nShow this QR code at the counter: https://momskitchenalandi.com/pass/${createdPass.qr_token}`;
                  const encodedMsg = encodeURIComponent(message);
                  const cleanNumber = createdPass.guest_mobile?.replace(/\D/g, '') || '';
                  // Ensure country code is present (assuming +91 default for India if length is 10)
                  const finalNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
                  // Opens WhatsApp app
                  window.open(`whatsapp://send?text=${encodedMsg}&phone=${finalNumber}`, '_blank');
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Send Pass via WhatsApp
              </Button>
            )}

            <Button onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold shadow-sm" variant="outline">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ViewPassDialogProps {
  pass: (GuestPass & { guest_mobile?: string; host_name?: string }) | null;
  onOpenChange: (open: boolean) => void;
}

function ViewPassDialog({ pass, onOpenChange }: ViewPassDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (pass && pass.qr_token && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, pass.qr_token, {
        width: 180,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
        errorCorrectionLevel: "H",
      }).catch((err) => {
        console.error("QR Code generation failed", err);
      });
    }
  }, [pass]);

  return (
    <Dialog open={!!pass} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
        {pass && (
          <div className="text-center space-y-5 py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Ticket className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Guest Ticket Details</h3>
              <Badge
                variant="secondary"
                className={`capitalize font-bold text-[10px] py-0 px-2 mt-1 ${pass.status === "active"
                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                  : pass.status === "used"
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    : pass.status === "pending_approval"
                      ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                      : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                  }`}
              >
                {pass.status === "pending_approval" ? "Pending Cash" : pass.status}
              </Badge>
            </div>

            <div className="flex flex-col items-center">
              <canvas ref={canvasRef} className="border p-2.5 rounded-xl bg-white shadow-sm" />
              <p className="text-[10px] text-muted-foreground font-semibold mt-2.5">
                {pass.status === "active" ? "Scan this QR code directly for entry validation" : "QR code is inactive or used"}
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-3 text-left space-y-1.5 border border-border/40 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Guest Name:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{pass.guest_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Host / Issuer:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{pass.host_name || "Unknown"}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1">
                <span className="text-muted-foreground font-semibold">Meal & Date:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {pass.meal} ({pass.date})
                </span>
              </div>
            </div>

            {pass.guest_mobile && pass.status === "active" && (
              <Button
                className="w-full h-10 rounded-xl font-bold shadow-sm bg-[#25D366] hover:bg-[#128C7E] text-white"
                onClick={() => {
                  const message = `Here is your Mom's Kitchen walk-in ticket for ${pass.meal} on ${pass.date}.\n\nShow this QR code at the counter: https://momskitchenalandi.com/pass/${pass.qr_token}`;
                  const encodedMsg = encodeURIComponent(message);
                  const cleanNumber = pass.guest_mobile?.replace(/\D/g, '') || '';
                  // Ensure country code is present (assuming +91 default for India if length is 10)
                  const finalNumber = cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber;
                  // Opens WhatsApp app
                  window.open(`whatsapp://send?text=${encodedMsg}&phone=${finalNumber}`, '_blank');
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Resend Pass via WhatsApp
              </Button>
            )}

            <Button onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold shadow-sm" variant="outline">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

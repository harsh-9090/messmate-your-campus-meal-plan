import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMess } from "@/lib/messmate/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayISO, formatTimestamp } from "@/lib/messmate/dateHelpers";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/scan-logs")({
  head: () => ({ meta: [{ title: "Scan Logs — MessMate Admin" }] }),
  component: ScanLogsPage,
});

const REASONS = ["all", "UNPAID", "EXPIRED", "NOT_IN_PLAN", "WRONG_TIME", "ALREADY_USED"];

function ScanLogsPage() {
  const logs = useMess((s) => s.logs);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const today = todayISO();
  const todayLogs = logs.filter((l) => l.date === today);

  const filtered = logs.filter((l) => {
    if (search && !l.memberName.toLowerCase().includes(search.toLowerCase()) && !l.memberId.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "all") return true;
    if (filter === "allowed") return l.status === "allowed";
    return l.denialCode === filter;
  });

  const byCode: Record<string, number> = {};
  todayLogs.filter((l) => l.status === "denied").forEach((l) => {
    byCode[l.denialCode || "OTHER"] = (byCode[l.denialCode || "OTHER"] || 0) + 1;
  });

  return (
    <div className="space-y-5 p-6 md:p-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Scan Logs</h1>
        <p className="text-sm text-muted-foreground">Real-time validation history</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Allowed today</div>
          <div className="font-display text-3xl font-bold text-success">{todayLogs.filter((l) => l.status === "allowed").length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Denied today</div>
          <div className="font-display text-3xl font-bold text-destructive">{todayLogs.filter((l) => l.status === "denied").length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total scans today</div>
          <div className="font-display text-3xl font-bold">{todayLogs.length}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 font-display text-lg font-bold">Denials by reason (today)</h3>
        {Object.keys(byCode).length === 0 ? (
          <p className="text-sm text-muted-foreground">No denials today.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCode).map(([code, n]) => (
              <Badge key={code} variant="secondary" className="text-sm">
                {code} · <span className="ml-1 font-bold">{n}</span>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2 border-b p-4">
          <Input className="w-64" placeholder="Search member…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="allowed">Allowed only</SelectItem>
              {REASONS.slice(1).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Member</th>
                <th className="px-4 py-2 text-left">Meal</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatTimestamp(l.timestamp)}</td>
                  <td className="px-4 py-2"><div className="font-medium">{l.memberName}</div><div className="text-xs text-muted-foreground">{l.memberId}</div></td>
                  <td className="px-4 py-2">{l.meal}</td>
                  <td className="px-4 py-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      l.status === "allowed" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {l.status === "allowed" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {l.denialCode && <Badge variant="outline" className="mr-1 text-[10px]">{l.denialCode}</Badge>}
                    <span className="text-muted-foreground">{l.denialReason}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No scan logs yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

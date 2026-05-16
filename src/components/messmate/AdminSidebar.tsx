import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, ScanLine, BarChart3, Settings, LogOut, UtensilsCrossed, IndianRupee, TrendingUp, UserCog } from "lucide-react";
import { useAuth } from "@/lib/messmate/auth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/members", label: "Members", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: IndianRupee },
  { to: "/admin/finance", label: "Finance", icon: TrendingUp },
  { to: "/admin/scan-logs", label: "Scan Logs", icon: ScanLine },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/staff", label: "Staff", icon: UserCog },
  { to: "/admin/plan-config", label: "Plan Config", icon: Settings },
];

export function AdminSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white">
          <UtensilsCrossed className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-bold leading-none">MessMate</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Admin Console</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-1 px-3">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">
            {user?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-sidebar-foreground/50">{user?.id}</div>
          </div>
          <Link to="/login" onClick={() => logout()} className="rounded-md p-2 hover:bg-sidebar-accent" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

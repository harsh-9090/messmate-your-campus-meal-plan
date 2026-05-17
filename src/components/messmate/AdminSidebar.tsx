import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, ScanLine, BarChart3, Settings, LogOut, UtensilsCrossed, IndianRupee, TrendingUp, UserCog, Menu } from "lucide-react";
import { useAuth } from "@/lib/messmate/auth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

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

function SidebarContent({ onNavItemClick }: { onNavItemClick?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
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
              onClick={onNavItemClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary shadow-sm text-primary-foreground shadow-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 mb-2 px-2">
          <ThemeToggle />
          <span className="text-xs font-medium text-muted-foreground">Appearance</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg p-2 bg-sidebar-accent/50">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">
            {user?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-sidebar-foreground/50">{user?.id}</div>
          </div>
          <Link to="/login" onClick={() => { logout(); onNavItemClick?.(); }} className="rounded-md p-2 hover:bg-sidebar-accent" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <SidebarContent />
    </aside>
  );
}

export function MobileAdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
      <div className="flex items-center">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarContent onNavItemClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="ml-3 flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <span className="font-display font-bold">MessMate</span>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}

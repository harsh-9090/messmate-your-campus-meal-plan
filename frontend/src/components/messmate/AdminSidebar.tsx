import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  BarChart3,
  Settings,
  LogOut,
  UtensilsCrossed,
  IndianRupee,
  TrendingUp,
  UserCog,
  Menu,
  Megaphone,
  ChefHat,
  Star,
  Ticket,
  PieChart,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/messmate/auth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { renewalsApi } from "@/lib/messmate/api";
import { ThemeToggle } from "./ThemeToggle";

const groups = [
  {
    title: "Operations & Kitchen",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/menu", label: "Menu Planner", icon: UtensilsCrossed },
      { to: "/admin/headcount", label: "Kitchen Forecast", icon: ChefHat },
      { to: "/staff/scanner", label: "QR Scanner", icon: ScanLine },
      { to: "/admin/scan-logs", label: "Scan Logs", icon: ScanLine },
    ],
  },
  {
    title: "People & Comms",
    items: [
      { to: "/admin/members", label: "Members", icon: Users },
      { to: "/admin/expiring", label: "Expiring Soon", icon: Clock },
      { to: "/admin/renewals", label: "Renewals", icon: RefreshCw },
      { to: "/admin/guest-passes", label: "Guest Passes", icon: Ticket },
      { to: "/admin/staff", label: "Staff", icon: UserCog },
      { to: "/admin/notifications", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    title: "Analytics & Finance",
    items: [
      { to: "/admin/analytics", label: "Member Analytics", icon: PieChart },
      { to: "/admin/payments", label: "Payments", icon: IndianRupee },
      { to: "/admin/finance", label: "Finance", icon: TrendingUp },
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
      { to: "/admin/feedback", label: "Food Feedback", icon: Star },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/admin/plan-config", label: "Plan Config", icon: Settings },
      { to: "/admin/settings", label: "System Settings", icon: Settings },
    ],
  },
];


function SidebarContent({ onNavItemClick }: { onNavItemClick?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const pendingCountQ = useQuery({
    queryKey: ["admin-pending-renewals-count"],
    queryFn: () => renewalsApi.getPendingCount(),
    refetchInterval: 60000, // refresh every minute
  });
  const pendingCount = pendingCountQ.data?.count || 0;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 py-5">
        <img
          src="/apple-touch-icon.png"
          alt="Mom's Kitchen Logo"
          className="h-10 w-10 rounded-full border border-primary/20 object-cover shadow-sm bg-primary/10"
        />
        <div>
          <div className="font-display text-lg font-bold leading-none">Mom's Kitchen</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
            Admin Console
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto space-y-4 px-3 py-2">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-3 py-1">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((it) => {
                const active = it.exact ? path === it.to : path.startsWith(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    onClick={onNavItemClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary shadow-sm text-primary-foreground shadow-primary/20"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <it.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{it.label}</span>
                    {it.label === "Renewals" && pendingCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 mb-2 px-2">
          <ThemeToggle />
          <span className="text-xs font-medium text-muted-foreground">Appearance</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg p-2 bg-sidebar-accent/50">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">
            {user?.name
              ?.split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-sidebar-foreground/50">{user?.id}</div>
          </div>
          <Link
            to="/login"
            onClick={() => {
              logout();
              onNavItemClick?.();
            }}
            className="rounded-md p-2 hover:bg-sidebar-accent"
            aria-label="Logout"
          >
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
    <div className="sticky top-0 z-50 flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
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
          <span className="font-display font-bold">Mom's Kitchen</span>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  const pendingCountQ = useQuery({
    queryKey: ["admin-pending-renewals-count"],
    queryFn: () => renewalsApi.getPendingCount(),
    refetchInterval: 60000,
  });
  const pendingCount = pendingCountQ.data?.count || 0;

  const isScanner = path === "/staff/scanner";
  const isHome = path === "/admin";
  const isMembers = path.startsWith("/admin/members");
  const isRenewals = path.startsWith("/admin/renewals");

  return (
    <>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SidebarContent onNavItemClick={() => setMoreOpen(false)} />
        </SheetContent>
      </Sheet>

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom,0px)] md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
      >
        <div className="flex h-16 items-center justify-around px-1 relative">
          {/* Home */}
          <Link
            to="/admin"
            className={cn(
              "flex flex-1 flex-col items-center justify-center py-1 transition-colors select-none",
              isHome ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("p-1 rounded-full transition-transform", isHome && "scale-110")}>
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Home</span>
          </Link>

          {/* Members */}
          <Link
            to="/admin/members"
            className={cn(
              "flex flex-1 flex-col items-center justify-center py-1 transition-colors select-none",
              isMembers ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("p-1 rounded-full transition-transform", isMembers && "scale-110")}>
              <Users className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Members</span>
          </Link>

          {/* Center PhonePe-Style QR Scanner Button */}
          <div className="flex-1 flex flex-col items-center justify-center -mt-5 relative z-10">
            <Link
              to="/staff/scanner"
              aria-label="Scan QR Code"
              className={cn(
                "group flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 active:scale-90",
                isScanner
                  ? "bg-primary text-primary-foreground ring-4 ring-primary/30 shadow-primary/40 scale-105"
                  : "bg-primary text-primary-foreground ring-4 ring-background shadow-primary/30 hover:scale-105"
              )}
            >
              <ScanLine className="h-7 w-7 transition-transform group-hover:scale-110" />
            </Link>
            <span
              className={cn(
                "text-[10px] tracking-tight mt-1 font-semibold",
                isScanner ? "text-primary font-bold" : "text-muted-foreground"
              )}
            >
              Scan QR
            </span>
          </div>

          {/* Renewals */}
          <Link
            to="/admin/renewals"
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center py-1 transition-colors select-none",
              isRenewals ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn("relative p-1 rounded-full transition-transform", isRenewals && "scale-110")}>
              <RefreshCw className="h-5 w-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground animate-pulse">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">Renewals</span>
          </Link>

          {/* More Menu */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center py-1 text-muted-foreground hover:text-foreground transition-colors select-none cursor-pointer"
          >
            <div className="p-1 rounded-full">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}


import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/messmate/auth";
import { AdminSidebar, MobileAdminNav } from "@/components/messmate/AdminSidebar";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const user = useAuth((s) => s.user);
  const _hasHydrated = useAuth((s) => s._hasHydrated);
  const navigate = useNavigate();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user || user.role !== "admin") navigate({ to: "/login" });
  }, [user, _hasHydrated, navigate]);

  if (!_hasHydrated) return null;

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <MobileAdminNav />
      <AdminSidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

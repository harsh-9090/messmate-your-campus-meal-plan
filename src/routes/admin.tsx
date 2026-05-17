import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/messmate/auth";
import { AdminSidebar, MobileAdminNav } from "@/components/messmate/AdminSidebar";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || user.role !== "admin") navigate({ to: "/login" });
  }, [user, navigate]);

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

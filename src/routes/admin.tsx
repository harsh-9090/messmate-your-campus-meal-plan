import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMess } from "@/lib/messmate/store";
import { AdminSidebar } from "@/components/messmate/AdminSidebar";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const me = useMess((s) => s.currentUser());
  const navigate = useNavigate();
  useEffect(() => {
    if (!me || me.role !== "admin") navigate({ to: "/login" });
  }, [me, navigate]);

  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

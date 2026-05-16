import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/messmate/auth";
import { ApiError } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MessMate" },
      { name: "description", content: "MessMate hostel mess management — log in as admin, staff, or member." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [memberId, setMemberId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId.trim() || !password) { toast.error("Enter member ID and password"); return; }
    setSubmitting(true);
    try {
      const user = await login(memberId.trim(), password);
      toast.success(`Welcome, ${user.name}`);
      if (user.role === "admin") navigate({ to: "/admin" });
      else if (user.role === "staff") navigate({ to: "/staff/scanner" });
      else navigate({ to: "/member" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Login failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-white shadow-glow">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold">MessMate</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/50">Hostel Mess Management</div>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Every meal,<br />only for those who paid.
          </h1>
          <p className="max-w-md text-sidebar-foreground/70">
            Dynamic QR codes, meal-window enforcement, and zero rollover. Built for 500+ student
            hostels where kitchen planning depends on accurate counts.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[["8s", "QR refresh"], ["5", "Validation steps"], ["30d", "Rolling plan"]].map(([n, l]) => (
              <div key={n}>
                <div className="font-display text-3xl font-bold text-primary">{n}</div>
                <div className="text-xs text-sidebar-foreground/60">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-sidebar-foreground/40">v2.1</div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="font-display text-3xl font-bold">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use your member ID and password.</p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="mid">Member ID</Label>
              <Input id="mid" placeholder="e.g. STU001" autoComplete="username" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

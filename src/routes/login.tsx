import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { useAuth } from "@/lib/messmate/auth";
import { ApiError } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, LogIn, Loader2, ShieldCheck } from "lucide-react";
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
    if (!memberId.trim() || !password) { toast.error("Enter credentials"); return; }
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
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex overflow-hidden">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/moms_special_thali.png"
            className="h-full w-full object-cover opacity-80 scale-105"
            alt="Mom's Special Thali"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/40 to-transparent" />
          <div className="absolute inset-0 bg-sidebar/10 backdrop-blur-[0.5px]" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">Mom's Kitchen</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-bold">Quality meals at affordable prices</div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight">
            Fresh meals,<br />
            <span className="text-primary text-6xl">Ready for you.</span>
          </h1>
          <p className="max-w-md text-sidebar-foreground/70 text-lg leading-relaxed">
            Welcome back to your hostel's central kitchen. Access your digital QR,
            track your meals, and manage your subscription all in one place.
          </p>
          <div className="flex items-center gap-4 pt-4 text-primary font-bold">
            <ShieldCheck className="h-6 w-6" />
            <p className="text-sm">Official Secure Access</p>
          </div>
        </div>

        <div className="relative z-10 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-bold">
          © 2026 Mom's Kitchen.
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-4xl font-extrabold tracking-tight">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to your member account.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mid" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ID, Email, or Mobile</Label>
                <Input
                  id="mid"
                  placeholder="STU001 / Email / Mobile"
                  autoComplete="username"
                  className="h-12 bg-muted/50 border-transparent focus:bg-background transition-all"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 bg-muted/50 border-transparent focus:bg-background transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-lg rounded-xl shadow-xl shadow-primary/20" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Sign in
            </Button>
          </form>

          <div className="pt-8 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account? <Link to="/register" className="text-primary font-bold hover:underline">Apply for Membership</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

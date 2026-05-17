import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { useAuth } from "@/lib/messmate/auth";
import { ApiError } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, LogIn, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Mom's Kitchen" },
      { name: "description", content: "Mom's Kitchen hostel mess management — log in as admin, staff, or member." },
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
    <div className="grid min-h-screen lg:grid-cols-2 bg-background overflow-hidden">
      {/* Mobile-only Branding Header */}
      <div className="lg:hidden absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-20">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Mom's Kitchen</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Desktop Toggle (Top Right) */}
      <div className="hidden lg:flex absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

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

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">Mom's Kitchen</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-bold">Quality meals at affordable prices</div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 space-y-6"
        >
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
        </motion.div>

        <div className="relative z-10 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-bold">
          © 2026 Mom's Kitchen.
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 lg:p-12 relative overflow-hidden">
        {/* Subtle Background Elements for Mobile */}
        <div className="lg:hidden absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="lg:hidden absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm space-y-8 relative z-10"
        >
          <div className="space-y-3">
            <h2 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight">Welcome Back</h2>
            <p className="text-muted-foreground font-medium">Access your mess account to manage meals.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mid" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Member ID / Email</Label>
                <Input
                  id="mid"
                  placeholder="e.g. STU001 or name@college.edu"
                  autoComplete="username"
                  className="h-14 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Label htmlFor="pw" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">Password</Label>
                  <Link to="/forgot-password" className="text-[11px] font-bold text-primary hover:underline transition-colors">Forgot Password?</Link>
                </div>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-14 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <LogIn className="mr-2 h-6 w-6" />}
              Sign in to Dashboard
            </Button>
          </form>

          <div className="pt-8 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              New student? <Link to="/register" className="text-primary font-bold hover:underline decoration-2 underline-offset-4">Join Mom's Kitchen</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

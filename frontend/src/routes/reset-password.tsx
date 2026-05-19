import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { authApi } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Lock, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";

interface ResetSearchParams {
  token?: string;
  memberId?: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearchParams => {
    return {
      token: search.token as string | undefined,
      memberId: search.memberId as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Reset Password - Mom's Kitchen" },
      {
        name: "description",
        content: "Enter your secure token and complete resetting your account password.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, memberId } = Route.useSearch();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !memberId) {
      toast.error("Invalid reset link. Please check your email or request a new one.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(memberId, token, password);
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset password. Link may be expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background overflow-hidden">
      {/* Mobile-only Branding Header */}
      <div className="lg:hidden absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-20">
        <Link to="/login" className="flex items-center gap-2 group">
          <img
            src="/apple-touch-icon.png"
            alt="Mom's Kitchen Logo"
            className="h-10 w-10 rounded-full border border-primary/20 object-cover shadow-lg shadow-primary/10 transition-transform group-hover:scale-105 bg-primary/5"
          />
          <span className="font-display text-xl font-bold tracking-tight">Mom's Kitchen</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop Toggle (Top Right) */}
      <div className="hidden lg:flex absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Hero Left Section */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex overflow-hidden">
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
          <img
            src="/apple-touch-icon.png"
            alt="Mom's Kitchen Logo"
            className="h-11 w-11 rounded-full border border-primary/20 object-cover shadow-lg shadow-primary/10 bg-primary/5"
          />
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">Mom's Kitchen</div>
            <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-bold">
              Secure Account Management
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 space-y-6"
        >
          <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight">
            Choose a New
            <br />
            <span className="text-primary text-6xl">Password.</span>
          </h1>
          <p className="max-w-md text-sidebar-foreground/70 text-lg leading-relaxed">
            Ensure your account remains safe. Select a strong password that is easy for you to
            remember but hard for others to guess.
          </p>
        </motion.div>

        <div className="relative z-10 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-bold">
          © 2026 Mom's Kitchen.
        </div>
      </div>

      {/* Form Right Section */}
      <div className="flex items-center justify-center bg-background p-6 lg:p-12 relative overflow-hidden">
        <div className="lg:hidden absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="lg:hidden absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm space-y-8 relative z-10"
        >
          {!token || !memberId ? (
            <div className="space-y-4 text-center">
              <h2 className="font-display text-3xl font-extrabold text-destructive">
                Invalid Reset Link
              </h2>
              <p className="text-muted-foreground text-sm font-medium">
                This password reset link is missing parameters. Please request a new link from the
                forgot password screen.
              </p>
              <Button
                onClick={() => navigate({ to: "/forgot-password" })}
                className="w-full h-14 rounded-2xl mt-4"
              >
                Request New Link
              </Button>
            </div>
          ) : !success ? (
            <>
              <div className="space-y-3">
                <h2 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight">
                  Set Password
                </h2>
                <p className="text-muted-foreground font-medium">
                  Configure new credentials for ID:{" "}
                  <strong className="text-foreground">{memberId}</strong>
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleReset}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="pw"
                      className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                    >
                      New Password
                    </Label>
                    <Input
                      id="pw"
                      type="password"
                      placeholder="••••••••"
                      className="h-14 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="cpw"
                      className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                    >
                      Confirm New Password
                    </Label>
                    <Input
                      id="cpw"
                      type="password"
                      placeholder="••••••••"
                      className="h-14 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <Lock className="mr-2 h-5 w-5" />
                  )}
                  Change Password
                </Button>
              </form>
            </>
          ) : (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-6 py-8"
            >
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success/10 text-success shadow-inner animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-extrabold tracking-tight">
                  Reset Complete!
                </h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                  Your password has been successfully updated. We are redirecting you to the sign in
                  page so you can access your dashboard...
                </p>
              </div>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mt-4" />
            </motion.div>
          )}

          {!success && (
            <div className="pt-8 border-t border-border/50 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign in
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

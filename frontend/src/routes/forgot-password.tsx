import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { authApi } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Mail, Loader2, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password - Mom's Kitchen" },
      {
        name: "description",
        content: "Reset your Mom's Kitchen password securely via your registered email.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [memberId, setMemberId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId.trim()) {
      toast.error("Please enter your Member ID or Email");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.forgotPassword(memberId.trim());
      setSuccess(true);
      toast.success("Reset link dispatched!");
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
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
          <Link to="/login" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
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
            src="/images/moms_fresh_cooking.png"
            className="h-full w-full object-cover opacity-80 scale-105"
            alt="Mom's Fresh Cooking"
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
            Forgot Your
            <br />
            <span className="text-primary text-6xl">Password?</span>
          </h1>
          <p className="max-w-md text-sidebar-foreground/70 text-lg leading-relaxed">
            No worries! Simply enter your Member ID or registered email address, and we will send a
            password reset link directly to your inbox.
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
          {!success ? (
            <>
              <div className="space-y-3">
                <h2 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight">
                  Recover Account
                </h2>
                <p className="text-muted-foreground font-medium">
                  Verify your identity to choose a new password.
                </p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="mid"
                      className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                    >
                      Member ID / Registered Email
                    </Label>
                    <Input
                      id="mid"
                      placeholder="e.g. ID"
                      className="h-14 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
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
                    <Send className="mr-2 h-5 w-5" />
                  )}
                  Send Reset Link
                </Button>
              </form>
            </>
          ) : (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-6 py-8"
            >
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary shadow-inner">
                <Mail className="h-10 w-10 animate-bounce" />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-extrabold tracking-tight">
                  Check Your Inbox
                </h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                  We have dispatched a secure password reset link to your registered email address.
                  Please click the link inside to set your new password.
                </p>
              </div>
              <p className="text-xs text-muted-foreground/60">
                Didn't receive the email? Check your spam folder, or try requesting a new link.
              </p>
            </motion.div>
          )}

          <div className="pt-8 border-t border-border/50 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

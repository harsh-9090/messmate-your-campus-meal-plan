import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi, configApi } from "@/lib/messmate/api";
import { ApiError } from "@/lib/messmate/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UtensilsCrossed,
  UserPlus,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register - Mom's Kitchen" },
      { name: "description", content: "Create your student account for the hostel mess." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    planId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => configApi.listPlans(),
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.planId) {
      toast.error("Please select a meal plan");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const { confirmPassword, ...data } = formData;
      await authApi.register(data);
      setSuccess(true);
      toast.success("Registration successful!");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Registration failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md relative z-10"
        >
          <Card className="p-10 text-center space-y-6 shadow-2xl rounded-[2.5rem] border-none bg-background/80 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: 0.2 }}
              className="mx-auto h-24 w-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"
            >
              <CheckCircle2 className="h-12 w-12" />
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold tracking-tight">Registration Sent!</h2>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Your account has been created successfully with your selected plan.
                <br />
                <br />
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                  Next Step
                </span>
                <br />
                Please visit the mess office to verify your ID and pay your subscription to activate
                your account.
              </p>
            </div>
            <Link to="/login">
              <Button className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20">
                Go to Login
              </Button>
            </Link>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background">
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
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div className="font-display text-2xl font-bold tracking-tight">Mom's Kitchen</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative z-10 space-y-6"
        >
          <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight">
            Join the <br />
            <span className="text-primary text-6xl">Healthy Life.</span>
          </h1>
          <p className="max-w-md text-sidebar-foreground/70 text-lg leading-relaxed">
            Register today to start enjoying fresh, hygienic, and balanced meals.
          </p>
          <div className="space-y-4 pt-4">
            {["Digital QR for Every Meal", "Real-time Meal Tracking", "Easy Online Renewals"].map(
              (txt, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  key={i}
                  className="flex items-center gap-3 font-medium text-sm"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span>{txt}</span>
                </motion.div>
              ),
            )}
          </div>
        </motion.div>

        <div className="relative z-10 flex items-center gap-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-bold">
          <ShieldCheck className="h-3 w-3" />
          OFFICIAL MESS REGISTRATION
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 lg:p-8 relative overflow-hidden">
        {/* Subtle Background Elements for Mobile */}
        <div className="lg:hidden absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="lg:hidden absolute -bottom-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-4 py-8 relative z-10"
        >
          <div className="space-y-1">
            <h2 className="font-display text-4xl font-extrabold tracking-tight leading-none">
              New Member
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Fill in your details and pick your plan.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleRegister}>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="name"
                  className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                >
                  Full Name
                </Label>
                <Input
                  id="name"
                  required
                  placeholder="Enter your full name"
                  className="h-12 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="mobile"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                  >
                    Mobile No
                  </Label>
                  <Input
                    id="mobile"
                    required
                    placeholder="10-digit number"
                    className="h-12 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="name@college.edu"
                    className="h-12 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">
                  Choose Your Plan
                </Label>
                <Select
                  value={formData.planId}
                  onValueChange={(val) => setFormData({ ...formData, planId: val })}
                  disabled={loadingPlans}
                >
                  <SelectTrigger className="h-14 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all">
                    <SelectValue
                      placeholder={loadingPlans ? "Loading plans..." : "Select a meal plan"}
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border shadow-2xl overflow-hidden">
                    {plans?.map((plan) => (
                      <SelectItem
                        key={plan.planId}
                        value={plan.planId}
                        className="py-4 focus:bg-primary/10 rounded-xl cursor-pointer m-1 transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-foreground">
                            {plan.label} - ₹{plan.pricePerMonth}
                          </span>
                          <span className="text-[10px] opacity-70 uppercase tracking-widest font-bold mt-0.5">
                            {plan.meals.join(" • ")}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="pw"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                  >
                    Password
                  </Label>
                  <Input
                    id="pw"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="h-12 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="cpw"
                    className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1"
                  >
                    Confirm
                  </Label>
                  <Input
                    id="cpw"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="h-12 px-4 bg-muted/40 border-border/50 focus:bg-background focus:ring-2 focus:ring-primary/20 rounded-2xl transition-all text-base"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 mt-2 transition-all active:scale-[0.98]"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-6 w-6" />
              )}
              Apply for Membership
            </Button>
          </form>

          <div className="pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary font-bold hover:underline decoration-2 underline-offset-4"
              >
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

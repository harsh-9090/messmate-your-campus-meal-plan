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
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register — Mom's Kitchen" },
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
    planId: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => configApi.listPlans()
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md p-10 text-center space-y-6 shadow-2xl rounded-[2rem] border-none">
          <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight">Registration Sent!</h2>
            <p className="text-muted-foreground">
              Your account has been created successfully with your selected plan.
              <br /><br />
              <span className="font-bold text-foreground underline underline-offset-4 decoration-primary decoration-2">Next Step:</span> Please visit the mess office to verify your ID and pay your subscription to activate your account.
            </p>
          </div>
          <Link to="/login">
            <Button className="w-full h-12 rounded-xl text-lg">Go to Login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
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

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <div className="font-display text-2xl font-bold tracking-tight">Mom's Kitchen</div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight">
            Join the <br />
            <span className="text-primary text-6xl">Healthy Life.</span>
          </h1>
          <p className="max-w-md text-sidebar-foreground/70 text-lg leading-relaxed">
            Register today to start enjoying fresh, hygienic, and balanced meals
            at your campus hostel.
          </p>
          <div className="space-y-4 pt-4">
            {[
              "Digital QR for Every Meal",
              "Real-time Meal Tracking",
              "Easy Online Renewals"
            ].map((txt, i) => (
              <div key={i} className="flex items-center gap-3 font-medium text-sm">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-bold">
          <ShieldCheck className="h-3 w-3" />
          OFFICIAL MESS REGISTRATION
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 lg:p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-4 py-4">
          <div className="space-y-1">
            <Link to="/" className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors mb-2">
              <ArrowLeft className="mr-1.5 h-3 w-3" /> Back to Home
            </Link>
            <h2 className="font-display text-3xl font-extrabold tracking-tight leading-none">New Member</h2>
            <p className="text-xs text-muted-foreground">Fill in your details and pick your plan.</p>
          </div>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="grid gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Full Name</Label>
                <Input
                  id="name"
                  required
                  placeholder="Enter your full name"
                  className="h-10 bg-muted/50 border-transparent focus:bg-background transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mobile" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Mobile No</Label>
                  <Input
                    id="mobile"
                    required
                    placeholder="10-digit number"
                    className="h-10 bg-muted/50 border-transparent focus:bg-background transition-all"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="yourname@college.edu"
                    className="h-10 bg-muted/50 border-transparent focus:bg-background transition-all"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Choose Your Plan</Label>
                <Select
                  value={formData.planId}
                  onValueChange={(val) => setFormData({ ...formData, planId: val })}
                  disabled={loadingPlans}
                >
                  <SelectTrigger className="h-12 bg-muted/50 border-transparent focus:bg-background rounded-xl">
                    <SelectValue placeholder={loadingPlans ? "Loading plans..." : "Select a meal plan"} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border shadow-2xl">
                    {plans?.map((plan) => (
                      <SelectItem key={plan.planId} value={plan.planId} className="py-3 focus:bg-primary/5 rounded-lg cursor-pointer">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{plan.label} — ₹{plan.pricePerMonth}</span>
                          <span className="text-[10px] opacity-60 uppercase tracking-tight font-medium">
                            {plan.meals.join(" • ")}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pw" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Password</Label>
                  <Input
                    id="pw"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="h-10 bg-muted/50 border-transparent focus:bg-background transition-all"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpw" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Confirm</Label>
                  <Input
                    id="cpw"
                    type="password"
                    required
                    placeholder="••••••••"
                    className="h-10 bg-muted/50 border-transparent focus:bg-background transition-all"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-md rounded-xl shadow-lg shadow-primary/20 mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Register Membership
            </Button>
          </form>

          <div className="pt-4 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account? <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

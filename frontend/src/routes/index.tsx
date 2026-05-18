import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { configApi } from "@/lib/messmate/api";
import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  ChevronRight,
  QrCode,
  ShieldCheck,
  Clock,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Users,
  Sun,
  Utensils,
  Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/messmate/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { getActiveMeal, formatTime12h } from "@/lib/messmate/dateHelpers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mom's Kitchen - Best Mess in Pune" },
      { name: "description", content: "Best mess in Pune, Serving delicious and hygienic food to students." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const windowsQ = useQuery({
    queryKey: ["windows"],
    queryFn: () => configApi.listWindows(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const activeMeal = windowsQ.data ? getActiveMeal(windowsQ.data) : null;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">Mom's Kitchen</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6">
              <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About Us</a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">How to Join</a>
              <a href="#menu" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Today's Menu</a>
              <ThemeToggle />
              <Link to="/login">
                <Button variant="ghost" className="text-sm font-medium">Student Login</Button>
              </Link>
              <Link to="/register">
                <Button className="rounded-full px-6 shadow-lg shadow-primary/20">Register Now</Button>
              </Link>
            </div>
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <Link to="/login">
                <Button size="sm" variant="ghost" className="text-sm font-bold text-primary">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-8"
              >
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                  <Badge variant="secondary" className="mr-2 bg-primary text-primary-foreground">STATUS</Badge>
                  <span>
                    {activeMeal
                      ? `Kitchen is currently serving ${activeMeal}!`
                      : "Kitchen is closed now. See timings below."}
                  </span>
                </div>
                <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
                  Healthy meals for a <br />
                  <span className="text-primary">Better Life.</span>
                </h1>
                <p className="max-w-lg text-lg text-muted-foreground sm:text-xl">
                  Welcome to <span className="font-bold">Mom's Kitchen</span>. Enjoy nutritious, hygienic,
                  and delicious meals served daily.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link to="/register">
                    <Button size="lg" className="h-14 rounded-full px-8 text-lg shadow-xl shadow-primary/25">
                      Register as Member <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <a href="#menu">
                    <Button size="lg" variant="outline" className="h-14 rounded-full px-8 text-lg border-2 group transition-all hover:bg-primary/5">
                      <Clock className="mr-2 h-5 w-5 text-primary transition-transform group-hover:rotate-12" />
                      View Meal Timings
                    </Button>
                  </a>
                </div>
                <div className="flex items-center gap-6 pt-4 text-muted-foreground border-t border-border mt-8">
                  <div className="flex flex-col">
                    <span className="text-foreground font-bold text-2xl">500+</span>
                    <span className="text-xs uppercase tracking-wider">Active Students</span>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex flex-col">
                    <span className="text-foreground font-bold text-2xl">100%</span>
                    <span className="text-xs uppercase tracking-wider">Hygienic</span>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <div className="flex flex-col">
                    <span className="text-foreground font-bold text-2xl">Fresh</span>
                    <span className="text-xs uppercase tracking-wider">Daily Preparation</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-primary/10 rounded-[3rem] blur-3xl" />
                <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-8 border-background shadow-2xl shadow-primary/30">
                  <img
                    src="/images/hero_thali.png"
                    alt="Delicious Indian Thali"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between rounded-2xl bg-white/10 backdrop-blur-md p-4 border border-white/20">
                    <div className="flex items-center gap-3 text-white">
                      <Clock className="h-6 w-6 text-primary" />
                      <div>
                        <div className="text-xs uppercase tracking-wider opacity-70">Next Meal</div>
                        <div className="text-sm font-bold">Dinner at 08:00 PM</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-24 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                <h2 className="text-primary font-bold uppercase tracking-widest text-sm">About Our Mess</h2>
                <h3 className="text-4xl font-extrabold tracking-tight">Your health is our priority.</h3>
                <p className="text-muted-foreground text-lg">
                  Mom's Kitchen is dedicated to providing students with high-quality, balanced meals
                  that feel like home. We use fresh ingredients, maintain strict hygiene standards,
                  and plan our menus to ensure you have the energy needed for your academic success.
                </p>
                <ul className="space-y-4">
                  {[
                    "Standardized nutritional balance",
                    "Pure filtered water for cooking",
                    "Transparent member management",
                    "Regular quality inspections"
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 font-medium">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/5 rounded-[3rem] blur-2xl" />
                <div className="grid grid-cols-2 gap-4 sm:gap-6 relative">
                  <div className="space-y-4 sm:space-y-6">
                    <motion.div
                      whileHover={{ y: -5 }}
                      className="overflow-hidden rounded-[2rem] shadow-xl border-4 border-background"
                    >
                      <img
                        src="/images/moms_special_thali.png"
                        className="aspect-[4/5] w-full object-cover"
                        alt="Delicious Thali"
                      />
                    </motion.div>
                    <motion.div
                      whileHover={{ y: -5 }}
                      className="overflow-hidden rounded-[2rem] shadow-lg border-4 border-background"
                    >
                      <img
                        src="/images/mess_kitchen.png"
                        className="aspect-square w-full object-cover"
                        alt="Our Kitchen"
                      />
                    </motion.div>
                  </div>
                  <div className="pt-8 sm:pt-12 space-y-4 sm:space-y-6">
                    <motion.div
                      whileHover={{ y: -5 }}
                      className="overflow-hidden rounded-[2rem] shadow-xl border-4 border-background"
                    >
                      <img
                        src="/images/moms_fresh_cooking.png"
                        className="aspect-[3/4] w-full object-cover"
                        alt="Fresh Cooking"
                      />
                    </motion.div>
                    <div className="aspect-square rounded-[2rem] bg-primary/10 flex items-center justify-center p-6 text-center border-4 border-background">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-primary">100%</div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Quality<br />Assurance</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-16">
            <div className="space-y-4">
              <h2 className="text-primary font-bold uppercase tracking-widest text-sm">Onboarding</h2>
              <h3 className="text-4xl font-extrabold tracking-tight">How to join the mess?</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px border-t-2 border-dashed border-border" />
              {[
                { step: "01", title: "Register Online", desc: "Fill your details on this website to create your student account." },
                { step: "02", title: "Verify & Pay", desc: "Visit the mess office to verify your ID and pay your monthly subscription." },
                { step: "03", title: "Start Dining", desc: "Get your digital QR code and enjoy your meals instantly!" },
              ].map((s, i) => (
                <div key={i} className="relative space-y-4">
                  <div className="h-24 w-24 rounded-full bg-background border-4 border-primary text-primary text-3xl font-bold flex items-center justify-center mx-auto shadow-xl relative z-10">
                    {s.step}
                  </div>
                  <h4 className="text-xl font-bold">{s.title}</h4>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <Link to="/register">
              <Button size="lg" className="rounded-full px-12">Register as a New Member</Button>
            </Link>
          </div>
        </section>

        {/* Menu Section */}
        <section id="menu" className="py-24 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] sm:rounded-[3rem] bg-card p-8 sm:p-16 overflow-hidden relative border shadow-xl">
              {/* Decorative Background Blobs */}
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center relative z-10">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-primary font-bold uppercase tracking-widest text-xs sm:text-sm">Meal Times</h2>
                    <h3 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Daily Dining Schedule</h3>
                    <p className="text-muted-foreground text-base sm:text-lg max-w-md">
                      Punctuality ensures fresh food for everyone. Please visit the mess during
                      the following windows.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { meal: "Breakfast", label: "Breakfast", menu: "Nutritious start with milk, sprouts, and main dish.", icon: <Sun className="h-20 w-20" />, smallIcon: <Sun className="h-7 w-7" />, defaultTime: "08:00 AM - 09:30 AM" },
                      { meal: "Lunch", label: "Lunch", menu: "Full thali with seasonal veg, dal, rice, and roti.", icon: <Utensils className="h-20 w-20" />, smallIcon: <Utensils className="h-7 w-7" />, defaultTime: "12:30 PM - 02:30 PM" },
                      { meal: "Dinner", label: "Dinner", menu: "Light and healthy dinner to end your day right.", icon: <Moon className="h-20 w-20" />, smallIcon: <Moon className="h-7 w-7" />, defaultTime: "08:00 PM - 09:30 PM" },
                    ].map((m, i) => {
                      const w = windowsQ.data?.find(x => x.meal === m.meal);
                      const displayTime = w ? `${formatTime12h(w.startTime)} - ${formatTime12h(w.endTime)}` : m.defaultTime;
                      const isLive = activeMeal === m.meal;

                      return (
                        <div key={i} className={cn(
                          "group relative rounded-2xl border transition-all overflow-hidden p-6",
                          isLive
                            ? "bg-primary/5 border-primary/30 shadow-glow"
                            : "bg-muted/30 border-border/50 hover:bg-muted/50"
                        )}>
                          <div className="flex flex-col sm:flex-row gap-6 items-start relative z-10">
                            <div className={cn(
                              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm border transition-transform group-hover:scale-110",
                              isLive ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary border-primary/20"
                            )}>
                              {m.smallIcon}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl font-bold tracking-tight">{m.label}</span>
                                  {isLive && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold uppercase tracking-wider animate-pulse">
                                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                      Live Now
                                    </span>
                                  )}
                                </div>
                                <span className={cn(
                                  "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                  isLive ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary border-primary/20"
                                )}>
                                  {displayTime}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-base leading-relaxed max-w-md">
                                {m.menu}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -inset-10 bg-primary/20 rounded-full blur-[100px]" />
                  <Card className="relative overflow-hidden border-border bg-background shadow-2xl p-0">
                    <div className="p-8 space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold">Important Note</span>
                        <Badge variant="outline" className="border-amber-500 text-amber-500">Notice</Badge>
                      </div>
                      <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
                        <p>• Digital QR code is mandatory for every meal.</p>
                        <p>• Membership must be renewed before the 1st of every month.</p>
                        <p>• No food items are allowed to be taken outside the mess hall.</p>
                      </div>
                      <Link to="/login">
                        <Button className="w-full h-12 rounded-xl">Student Login</Button>
                      </Link>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Mom's Kitchen</span>
          </div>
          <p className="text-muted-foreground text-sm">© 2026 Official Mom's Kitchen. Served with care.</p>
        </div>
      </footer>
    </div>
  );
}

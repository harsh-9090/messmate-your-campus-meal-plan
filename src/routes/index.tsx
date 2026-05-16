import { createFileRoute, Link } from "@tanstack/react-router";
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
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MessMate — Smart Campus Dining" },
      { name: "description", content: "The all-in-one management system for your campus hostel mess. Smart QR check-ins, automated billing, and real-time analytics." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
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
          <div className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About Us</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">How to Join</a>
            <a href="#menu" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Today's Menu</a>
            <Link to="/login">
              <Button variant="ghost" className="text-sm font-medium">Student Login</Button>
            </Link>
            <Link to="/register">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20">Register Now</Button>
            </Link>
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
                  <span>Kitchen is currently serving Dinner!</span>
                </div>
                <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
                  Healthy meals for a <br />
                  <span className="text-primary">Better Campus Life.</span>
                </h1>
                <p className="max-w-lg text-lg text-muted-foreground sm:text-xl">
                  Welcome to your official hostel dining hub. Enjoy nutritious, hygienic,
                  and delicious meals served daily at your doorstep.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Link to="/register">
                    <Button size="lg" className="h-14 rounded-full px-8 text-lg shadow-xl shadow-primary/25">
                      Register as Member <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline" className="h-14 rounded-full px-8 text-lg border-2">
                    View Meal Timings
                  </Button>
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
                  The Campus Kitchen is dedicated to providing students with high-quality, balanced meals
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
              <div className="grid grid-cols-2 gap-4">
                <img src="/images/fresh_meal.png" className="rounded-3xl h-64 w-full object-cover" alt="Fresh Prepared Meal" />
                <img src="/images/mess_kitchen.png" className="rounded-3xl h-64 w-full object-cover mt-8 shadow-2xl" alt="Our Hygienic Kitchen" />
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
            <div className="rounded-[3rem] bg-sidebar p-12 overflow-hidden relative border border-sidebar-border">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-primary font-bold uppercase tracking-widest text-sm">Meal Times</h2>
                    <h3 className="text-4xl font-bold text-white">Daily Dining Schedule</h3>
                    <p className="text-sidebar-foreground/70 text-lg">
                      Punctuality ensures fresh food for everyone. Please visit the mess during
                      the following windows.
                    </p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { time: "08:00 AM - 09:30 AM", label: "Breakfast", menu: "Nutritious start with milk, sprouts, and main dish." },
                      { time: "12:30 PM - 02:30 PM", label: "Lunch", menu: "Full thali with seasonal veg, dal, rice, and roti." },
                      { time: "08:00 PM - 09:30 PM", label: "Dinner", menu: "Light and healthy dinner to end your day right." },
                    ].map((m, i) => (
                      <div key={i} className="flex gap-6 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                          <Clock className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-bold">{m.label}</span>
                            <span className="text-primary text-xs font-medium uppercase tracking-wider ml-auto">{m.time}</span>
                          </div>
                          <p className="text-sidebar-foreground/80 text-sm">{m.menu}</p>
                        </div>
                      </div>
                    ))}
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

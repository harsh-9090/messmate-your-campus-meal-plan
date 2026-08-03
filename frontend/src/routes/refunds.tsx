import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refunds")({
  head: () => ({ meta: [{ title: "Refund Policy - Mom's Kitchen" }] }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl">
            <span className="text-primary">Mom's Kitchen</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-12 px-4 md:px-6">
        <div className="mx-auto max-w-3xl prose prose-slate dark:prose-invert prose-headings:font-display">
          <h1 className="text-3xl font-bold tracking-tight mb-6">Refund & Cancellation Policy</h1>
          <p className="text-muted-foreground mb-8">Effective Date: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-sm md:text-base leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. General Policy</h2>
              <p>
                At Mom's Kitchen, we strive to provide the best quality food and service to all our students. However, due to the perishable nature of food and the logistics of our meal planning, our refund and cancellation policies are strictly enforced.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. Subscription Cancellations</h2>
              <p>
                Meal plan subscriptions are generally non-refundable once the billing cycle (e.g., 30 days) has commenced. 
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>If you wish to cancel your subscription prior to the start date of your billing cycle, a full refund may be issued minus any applicable processing fees.</li>
                <li>Mid-cycle cancellations are not eligible for a refund. Any remaining balance or unused meals will be forfeited at the end of the billing cycle.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Absenteeism and Missed Meals</h2>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>If you miss a meal (Breakfast, Lunch, or Dinner) without prior notification through the application's "Skip Meal" feature (if available), that meal is considered forfeited and cannot be refunded or carried over to the next day.</li>
                <li>In the event of a long-term absence (e.g., medical emergency or going home), you must notify the administration in advance. The management, at its sole discretion, may offer to pause your subscription. Retroactive pauses or refunds for unannounced absences will not be entertained.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Disciplinary Cancellations</h2>
              <p>
                If a student's subscription is terminated by the management due to a violation of the Terms of Service (e.g., sharing QR codes, misconduct in the mess hall, taking food outside), no refund will be issued for the remaining days of the subscription.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Dispute Resolution</h2>
              <p>
                Any disputes regarding payments, balances, or refunds should be raised directly with the mess administrator at the facility counter within 3 days of the incident.
              </p>
            </section>
          </div>
        </div>
      </main>
      
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-16 md:flex-row px-4 md:px-6">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            © {new Date().getFullYear()} Mom's Kitchen. Served with care.
          </p>
        </div>
      </footer>
    </div>
  );
}

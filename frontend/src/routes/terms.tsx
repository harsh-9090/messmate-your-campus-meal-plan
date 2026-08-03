import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service - Mom's Kitchen" }] }),
  component: TermsPage,
});

function TermsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight mb-6">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Effective Date: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-sm md:text-base leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
              <p>
                By registering for a meal plan and using the Mom's Kitchen web application, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. Digital QR Code and Access</h2>
              <p>
                Entry to the mess hall and meal distribution is strictly controlled via digital QR codes. 
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Your QR code must be scanned at the front desk before receiving your meal.</li>
                <li>QR codes are dynamically generated. Using screenshots, printouts, or sharing your QR code with another person is strictly prohibited.</li>
                <li>Violation of the QR code policy will result in immediate denial of the meal and potential suspension of your subscription.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Meal Windows and Conduct</h2>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Meals are only served during designated meal windows (Breakfast, Lunch, Dinner). You must arrive within the specified timings.</li>
                <li>Food must be consumed within the mess hall premises. Taking food items, utensils, or plates outside is strictly forbidden unless explicitly authorized by the management.</li>
                <li>Respectful behavior towards the staff and fellow students is expected at all times.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Subscriptions and Payments</h2>
              <p>
                Meal plan subscriptions run on a strict cycle as defined during your purchase (typically 30 days). 
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Memberships must be renewed prior to the expiration date to ensure uninterrupted service.</li>
                <li>The management reserves the right to deny service if the account has an outstanding negative balance or the subscription has expired.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Modifications to Service</h2>
              <p>
                Mom's Kitchen reserves the right to modify the daily menu, adjust meal window timings, or update subscription pricing. Members will be notified of significant changes via the dashboard or physical notice boards.
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

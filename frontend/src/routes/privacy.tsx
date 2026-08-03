import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy - Mom's Kitchen" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
          <h1 className="text-3xl font-bold tracking-tight mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-8 text-sm md:text-base leading-relaxed text-foreground/80">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">1. Information We Collect</h2>
              <p>At Mom's Kitchen, we collect information necessary to manage your meal plan effectively. This includes:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Personal Information:</strong> Name, phone number, email address, and college details provided during registration.</li>
                <li><strong>Usage Data:</strong> Meal scanning records (dates, times, and meal types) used for your subscription tracking.</li>
                <li><strong>Payment Data:</strong> Transaction history and payment status (we do not store raw credit card numbers or UPI PINs on our servers).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">2. How We Use Your Data</h2>
              <p>The information we collect is strictly used for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>To generate and validate your personal digital QR code for daily meals.</li>
                <li>To manage your active subscription, track your remaining days/meals, and process renewals.</li>
                <li>To send important notifications (e.g., holiday notices, low balance alerts, menu updates).</li>
                <li>To analyze aggregated, non-identifying headcount data to minimize food waste.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Data Security and QR Codes</h2>
              <p>
                Your digital QR code is unique to your account and is securely generated. Sharing screenshots of your QR code is strictly prohibited and our systems use timestamps to prevent unauthorized sharing. We implement industry-standard security protocols to ensure your personal data is protected against unauthorized access.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Third-Party Disclosure</h2>
              <p>
                We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. This does not include trusted third parties who assist us in operating our website, conducting our business, or servicing you (such as secure payment gateways), so long as those parties agree to keep this information confidential.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Contact Us</h2>
              <p>
                If there are any questions regarding this privacy policy or if you wish to update or delete your personal data, you may contact the mess administrator directly at the facility or via the contact details provided in the footer of our main website.
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

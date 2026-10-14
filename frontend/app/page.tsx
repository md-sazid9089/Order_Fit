import { AnnouncementBanner } from "@/components/landing/announcement-banner";
import { Navbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { SectorsMarquee } from "@/components/landing/sectors-marquee";
import { FeaturePillars } from "@/components/landing/feature-pillars";
import { ResultsSection } from "@/components/landing/results-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { OldVsNewWay } from "@/components/landing/old-vs-new-way";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { CustomerStories } from "@/components/landing/customer-stories";
import { OrderSimulator } from "@/components/landing/order-simulator";
import { SupportTiers } from "@/components/landing/support-tiers";
import { FaqSection } from "@/components/landing/faq-section";
import { InsightsSection } from "@/components/landing/insights-section";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] antialiased selection:bg-[#B5F2C6] selection:text-[#004D3B]">
      {/* Top Announcement Bar */}
      <AnnouncementBanner />

      {/* Navigation */}
      <Navbar />

      {/* Main Landing Page matching Settle.com 1-to-1 */}
      <main id="main-content">
        {/* Section 1: Hero Section */}
        <HeroSection />

        {/* Section 2: Press ticker and Brand Logos Marquee */}
        <SectorsMarquee />

        {/* Section 3: The back office built for growing brands (3 pillars + 4 capabilities) */}
        <FeaturePillars />

        {/* Section 4: Let the results speak for themselves */}
        <ResultsSection />

        {/* Section 5: OrderFit by the numbers (Settle lavender container) */}
        <MetricsSection />

        {/* Section 6: Less Busywork. More Breakthroughs. (The old way vs The OrderFit way) */}
        <OldVsNewWay />

        {/* Section 7: All the integrations you need */}
        <IntegrationsSection />

        {/* Section 8: Customer Stories */}
        <CustomerStories />

        {/* Section 9 & 10: Take an interactive product tour (Live browser container) */}
        <OrderSimulator />

        {/* Section 11: Dedicated support from real humans — not AI */}
        <SupportTiers />

        {/* Section 12: Frequently asked questions */}
        <FaqSection />

        {/* Section 13: Latest news & insights */}
        <InsightsSection />

        {/* Section 14: Insights in your inbox (Newsletter CTA) */}
        <CtaSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

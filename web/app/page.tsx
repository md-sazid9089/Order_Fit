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
import { ScrollReveal } from "@/components/ui/scroll-reveal";

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
        <ScrollReveal direction="up" distance={24} duration={0.6}>
          <SectorsMarquee />
        </ScrollReveal>

        {/* Section 3: The back office built for growing brands (3 pillars + 4 capabilities) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <FeaturePillars />
        </ScrollReveal>

        {/* Section 4: Let the results speak for themselves */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <ResultsSection />
        </ScrollReveal>

        {/* Section 5: OrderFit by the numbers (Settle lavender container) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <MetricsSection />
        </ScrollReveal>

        {/* Section 6: Less Busywork. More Breakthroughs. (The old way vs The OrderFit way) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <OldVsNewWay />
        </ScrollReveal>

        {/* Section 7: All the integrations you need */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <IntegrationsSection />
        </ScrollReveal>

        {/* Section 8: Customer Stories */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <CustomerStories />
        </ScrollReveal>

        {/* Section 9 & 10: Take an interactive product tour (Live browser container) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <OrderSimulator />
        </ScrollReveal>

        {/* Section 11: Dedicated support from real humans — not AI */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <SupportTiers />
        </ScrollReveal>

        {/* Section 12: Frequently asked questions */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <FaqSection />
        </ScrollReveal>

        {/* Section 13: Latest news & insights */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <InsightsSection />
        </ScrollReveal>

        {/* Section 14: Insights in your inbox (Newsletter CTA) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <CtaSection />
        </ScrollReveal>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

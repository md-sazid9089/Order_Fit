import { AnnouncementBanner } from "@/components/landing/announcement-banner";
import { Navbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { SectorsMarquee } from "@/components/landing/sectors-marquee";
import { FeaturePillars } from "@/components/landing/feature-pillars";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { ArchitectureSecurity } from "@/components/landing/architecture-security";
import { OldVsNewWay } from "@/components/landing/old-vs-new-way";
import { CompetitiveMatrix } from "@/components/landing/competitive-matrix";
import { OrderSimulator } from "@/components/landing/order-simulator";
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

      {/* Main Landing Page grounded in OrderFit Architecture & ADRs */}
      <main id="main-content">
        {/* Section 1: Hero Section */}
        <HeroSection />

        {/* Section 2: Supported Sectors & Architecture Principle Ticker */}
        <ScrollReveal direction="up" distance={24} duration={0.6}>
          <SectorsMarquee />
        </ScrollReveal>

        {/* Section 3: Core Decision Pillars (Feasibility, Quotes, Working Capital) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <FeaturePillars />
        </ScrollReveal>

        {/* Section 4: 4-Step Decision Workflow Journey */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <WorkflowSection />
        </ScrollReveal>

        {/* Section 5: Architecture, ADRs & Security Tiers */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <ArchitectureSecurity />
        </ScrollReveal>

        {/* Section 6: The Old Way (Spreadsheet Chaos) vs The OrderFit Way */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <OldVsNewWay />
        </ScrollReveal>

        {/* Section 7: Market & Comparative Analysis (OrderFit vs Settle vs FP&A vs Spreadsheets) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <CompetitiveMatrix />
        </ScrollReveal>

        {/* Section 8: Interactive Product Simulator (Live Cash Runway & Delay Scan) */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <OrderSimulator />
        </ScrollReveal>

        {/* Section 9: Frequently Asked Questions */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <FaqSection />
        </ScrollReveal>

        {/* Section 10: News & Perspectives */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <InsightsSection />
        </ScrollReveal>

        {/* Section 11: Insights Newsletter CTA */}
        <ScrollReveal direction="up" distance={32} duration={0.7} amount={0.1}>
          <CtaSection />
        </ScrollReveal>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

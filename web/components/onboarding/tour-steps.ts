import type { TourStep } from "./tour-types";

export const ONBOARDING_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    route: "/overview",
    selector: null,
    title: "Welcome to OrderFit",
    description:
      "OrderFit stress-tests customer contracts against your real cash runway, helping you protect liquidity and negotiate safe commercial terms. Let's take a quick 1-minute tour.",
    placement: "center",
    nextLabel: "Start Tour",
  },
  {
    id: "overview-kpis",
    route: "/overview",
    selector: '[data-tour="overview-kpis"]',
    title: "Real-Time Cash Headroom",
    description:
      "Monitor your opening cash baseline, 30-day tested order volume, pending owner reviews, and your protected cash headroom above your policy reserve floor.",
    placement: "bottom",
  },
  {
    id: "sidebar-nav",
    route: "/overview",
    selector: '[data-tour="sidebar-nav"]',
    title: "Navigate Your Workspace",
    description:
      "Switch between your Overview dashboard, Deals Pipeline, Cash & Financing baselines, customer records, and immutable audit logs.",
    placement: "right",
  },
  {
    id: "overview-cashflow",
    route: "/overview",
    selector: '[data-tour="overview-cashflow"]',
    title: "Forward Cash Flow Timeline",
    description:
      "Inspect forward-scheduled cash inflows, outflows, and net balances. Click or scrub points on the timeline to inspect liquidity troughs before committing to orders.",
    placement: "top",
  },
  {
    id: "explore-deals",
    route: "/overview",
    selector: '[data-tour="explore-deals-btn"]',
    title: "Explore Deals & Order Intake",
    description:
      "Head to the Deals pipeline to view active orders or evaluate a prospective contract. Let's proceed to create an order.",
    placement: "bottom",
    nextLabel: "Continue to Deals",
    isNavigationStep: true,
  },
  {
    id: "deals-new-header",
    route: "/deals/new",
    selector: '[data-tour="deals-new-header"]',
    title: "Evaluate a New Order",
    description:
      "Evaluate order affordability using AI Document Intake to extract terms from customer POs and supplier quotes, or use the structured Manual Order Form.",
    placement: "bottom",
  },
  {
    id: "deals-new-terms",
    route: "/deals/new",
    selector: '[data-tour="deals-new-terms"]',
    title: "Contract Terms & Milestones",
    description:
      "Configure order value, payment delay anchors, and itemized supplier costs. The deterministic engine verifies whether the contract can be accepted safely.",
    placement: "top",
  },
  {
    id: "completion",
    route: "/deals/new",
    selector: null,
    title: "You're All Set!",
    description:
      "You now know how OrderFit protects your cash runway. Explore the workspace, stress-test customer late-payment scenarios, and evaluate deals with confidence.",
    placement: "center",
    nextLabel: "Get Started",
  },
];

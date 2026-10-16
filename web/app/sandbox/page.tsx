import { UnavailablePage } from "@/components/unavailable-notice";

export default function Page() {
  return <UnavailablePage title="What-if planning" reason="What-if comparisons are run from a saved, evaluated order. Sending, payments and commitments are not available." href="/deals" linkLabel="Go to saved orders" />;
}

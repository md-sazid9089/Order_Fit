import { UnavailablePage } from "@/components/unavailable-notice";

export default function Page() {
  return <UnavailablePage title="Orders" reason="Saved orders are listed under Orders." href="/deals" linkLabel="Go to saved orders" />;
}

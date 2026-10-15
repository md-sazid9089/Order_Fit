import Link from "next/link";

// Negotiation drafting and approval arrive in P5/P6. Until then this route shows a notice for
// every id: the former demo client faked a step-up approval and must not be reachable.
export default function DealNegotiatePage() {
  return (
    <main className="space-y-3 p-8">
      <h1 className="text-xl font-semibold">Negotiation preparation is unavailable</h1>
      <p>This workflow requires P5. Saved manual order reviews and financial results are available from your orders.</p>
      <Link className="underline" href="/deals">Saved orders</Link>
    </main>
  );
}

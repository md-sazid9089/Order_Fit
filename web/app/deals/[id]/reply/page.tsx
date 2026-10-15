import Link from "next/link";

// Reply reassessment arrives in P5. Until then this route shows a notice for every id: the
// former demo client claimed a committed, hash-verified plan without calling the backend.
export default function DealReplyPage() {
  return (
    <main className="space-y-3 p-8">
      <h1 className="text-xl font-semibold">Reply reassessment is unavailable</h1>
      <p>This workflow requires P5. Saved manual order reviews and financial results are available from your orders.</p>
      <Link className="underline" href="/deals">Saved orders</Link>
    </main>
  );
}

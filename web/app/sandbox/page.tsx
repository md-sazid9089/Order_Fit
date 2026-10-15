import Link from "next/link";

export default function SandboxPage() {
  return <main className="space-y-4 p-8"><h1 className="text-2xl font-semibold">What-if planning</h1><p>Choose a saved, evaluated order to compare persisted what-if forks through the financial engine.</p><Link className="underline" href="/deals">Choose a saved order</Link><p>Sending, payments and commitment execution are disabled.</p></main>;
}

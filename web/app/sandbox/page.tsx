import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ businessId?: string }> };

// What-if planning and sandbox actions happen on a saved, evaluated order (its Negotiate page),
// so this legacy path forwards to the pipeline with the business scope intact.
export default async function SandboxRedirect({ searchParams }: Props) {
  const { businessId } = await searchParams;
  redirect(`/deals${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`);
}

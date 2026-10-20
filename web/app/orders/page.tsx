import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ businessId?: string }> };

// Saved orders live in the Deals pipeline; this legacy path forwards there with the business scope intact.
export default async function OrdersRedirect({ searchParams }: Props) {
  const { businessId } = await searchParams;
  redirect(`/deals${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`);
}

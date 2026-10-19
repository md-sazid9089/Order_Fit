import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> };

// Confirmation happens on the saved order itself (review inputs, then "Confirm and evaluate").
// The former standalone confirm screen rendered invented terms and has been removed.
export default async function DealConfirmPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { businessId } = await searchParams;
  const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  redirect(`/deals/${encodeURIComponent(id)}${query}`);
}

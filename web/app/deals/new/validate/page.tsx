import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ businessId?: string }> };

// The validate step displayed hard-coded figures and computed margins in the browser.
// Entered orders are reviewed on the saved order instead, so this route now returns to entry.
export default async function NewDealValidateRedirect({ searchParams }: Props) {
  const { businessId } = await searchParams;
  const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  redirect(`/deals/new${query}`);
}

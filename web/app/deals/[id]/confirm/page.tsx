import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ businessId?: string }> };

/** Legacy route: confirmation happens on the saved order page, against the stored inputs. */
export default async function DealConfirmPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { businessId } = await searchParams;
  redirect(`/deals/${encodeURIComponent(id)}${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`);
}

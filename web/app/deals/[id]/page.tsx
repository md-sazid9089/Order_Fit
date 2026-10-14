// Timeline, options, stress table, flags, confirm and approval.
export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main>Deal {id}</main>;
}

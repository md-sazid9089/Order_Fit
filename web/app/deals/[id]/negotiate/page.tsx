"use client";

import { use } from "react";
import { PreparationWorkspace } from "@/components/preparation-workspace";
import { useScope } from "@/components/layout/auth-shell";

export default function DealPreparationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ operationId?: string }> }) {
  const { id } = use(params);
  const { operationId } = use(searchParams);
  const { businessId } = useScope();
  return <PreparationWorkspace dealId={id} businessId={businessId} operationId={operationId} />;
}

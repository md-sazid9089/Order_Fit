"use client";

import { use } from "react";
import { PreparationWorkspace } from "@/components/preparation-workspace";
import { useScope } from "@/components/layout/auth-shell";

export default function DealPreparationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ operationId?: string; businessId?: string }> }) {
  const { id } = use(params);
  const { operationId, businessId: queryBusinessId } = use(searchParams);
  const { businessId: scopeBusinessId } = useScope();
  const businessId = queryBusinessId || scopeBusinessId;
  return <PreparationWorkspace dealId={id} businessId={businessId} operationId={operationId} />;
}

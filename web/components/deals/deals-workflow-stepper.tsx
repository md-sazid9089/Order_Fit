"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type WorkflowStep = 1 | 2 | 3 | 4 | 5;

interface DealsWorkflowStepperProps {
  currentStep: WorkflowStep;
  businessId?: string | null;
  dealId?: string | null;
  className?: string;
}

export function DealsWorkflowStepper({
  currentStep,
  businessId,
  dealId,
  className = "",
}: DealsWorkflowStepperProps) {
  const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  const po = dealId ? encodeURIComponent(dealId) : "new";

  const steps = [
    {
      step: 1 as WorkflowStep,
      label: "1. Ingest",
      href: `/deals/new${query}`,
    },
    {
      step: 2 as WorkflowStep,
      label: "2. Validate",
      href: `/deals/new/validate${query}${dealId ? `&poNumber=${encodeURIComponent(dealId)}` : ""}`,
    },
    {
      step: 3 as WorkflowStep,
      label: "3. Confirm",
      href: `/deals/${po}/confirm${query}`,
    },
    {
      step: 4 as WorkflowStep,
      label: "4. Compute",
      href: `/deals/${po}${query}`,
    },
    {
      step: 5 as WorkflowStep,
      label: "5. Approve",
      href: `/deals/${po}/negotiate${query}`,
    },
  ];

  return (
    <div
      className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] text-[10px] sm:text-[11px] font-medium text-[#737373] dark:text-neutral-400 shadow-xs max-w-full overflow-x-auto ${className}`}
    >
      {steps.map((item, index) => {
        const isCurrent = item.step === currentStep;
        const isPast = item.step < currentStep;

        return (
          <React.Fragment key={item.step}>
            {index > 0 && (
              <ChevronRight className="size-3 text-[#A3A3A3] dark:text-neutral-500 shrink-0" />
            )}

            {isCurrent ? (
              <span className="font-bold text-[#1E2021] dark:text-white flex items-center gap-1 shrink-0">
                <span className="size-1.5 rounded-full bg-[#1E2021] dark:bg-white" />
                {item.label}
              </span>
            ) : isPast ? (
              <Link
                href={item.href}
                className="hover:text-[#1E2021] dark:hover:text-white transition-colors shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              /* If a dealId exists, later steps can also be navigable or rendered consistently */
              dealId && dealId !== "new" ? (
                <Link
                  href={item.href}
                  className="hover:text-[#1E2021] dark:hover:text-white transition-colors shrink-0 text-[#737373] dark:text-neutral-400"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-[#A3A3A3] dark:text-neutral-500 shrink-0">
                  {item.label}
                </span>
              )
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

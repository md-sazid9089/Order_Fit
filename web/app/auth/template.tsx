"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-fade-in flex-1 flex flex-col min-h-full">
      {children}
    </div>
  );
}

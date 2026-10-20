"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CircleCheck, Info, TriangleAlert, OctagonX, Loader2 } from "lucide-react";
export { toast, type ToastOptions } from "@/lib/toast";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-sans"
      position="bottom-center"
      closeButton
      richColors={false}
      expand={false}
      offset="24px"
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 shrink-0 text-[#004D3B] dark:text-[#34D399]" />,
        info: <Info className="size-4 shrink-0 text-[#526975] dark:text-sky-400" />,
        warning: <TriangleAlert className="size-4 shrink-0 text-[#C97D18] dark:text-amber-400" />,
        error: <OctagonX className="size-4 shrink-0 text-[#C53030] dark:text-red-400" />,
        loading: <Loader2 className="size-4 shrink-0 animate-spin text-neutral-500" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast flex items-center gap-3 w-full max-w-[calc(100vw-32px)] sm:max-w-[420px] mx-auto rounded-2xl border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-[#1E2021] dark:text-[#F3F4F6] p-4 shadow-lg dark:shadow-2xl text-sm font-sans tracking-tight transition-all",
          title: "text-sm font-medium leading-tight text-[#1E2021] dark:text-[#F3F4F6]",
          description: "text-xs text-[#737373] dark:text-neutral-400 font-normal leading-relaxed mt-0.5",
          actionButton:
            "rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] text-xs font-semibold px-3 py-1.5 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors shadow-xs",
          cancelButton:
            "rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium px-3 py-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors",
          closeButton:
            "rounded-lg border border-[#E8E6E1] dark:border-[#2A2C2D] bg-white dark:bg-[#181A1B] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer",
          success:
            "border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20",
          error:
            "border-red-200/80 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20",
          warning:
            "border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20",
          info:
            "border-neutral-200/80 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

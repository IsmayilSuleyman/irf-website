"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revalidateSheetData } from "@/app/dashboard/refresh-actions";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justDone, setJustDone] = useState(false);

  async function handleRefresh() {
    startTransition(async () => {
      await revalidateSheetData();
      router.refresh();
      setJustDone(true);
      setTimeout(() => setJustDone(false), 1500);
    });
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      title="Məlumatı yenilə"
      className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-brand-green/60 hover:text-brand-green transition-colors disabled:opacity-40"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`}
      >
        <path d="M13.5 8A5.5 5.5 0 1 1 10 3.07" />
        <polyline points="13.5 2 13.5 5.5 10 5.5" />
      </svg>
      {justDone ? "Yeniləndi" : "Yenilə"}
    </button>
  );
}

"use client";

import type { ReactNode } from "react";
import { usePrivacy } from "@/components/PrivacyProvider";

/**
 * Renders its children normally, or a neutral "••••" when hide-amounts mode
 * is on. Wraps every figure that reveals a holder's position. The mask is a
 * plain span so it inherits the surrounding font size/weight; pass className
 * to neutralise tone colours (so green/red dots don't leak the sign).
 */
export function Masked({
  children,
  mask = "••••",
  className,
}: {
  children: ReactNode;
  mask?: string;
  className?: string;
}) {
  const { hidden } = usePrivacy();
  if (!hidden) return <>{children}</>;
  return <span className={className}>{mask}</span>;
}

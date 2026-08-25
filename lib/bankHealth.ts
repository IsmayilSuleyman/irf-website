import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";

// Pure, client-safe health math for the Ümumbank baxışı. Kept out of
// lib/bank.ts on purpose: that module drags @googleapis/sheets +
// next/cache along, and these helpers are plain arithmetic over already-
// aggregated numbers (mirrors the lib/bankTermsData split).
//
// Deliberately NO coverage-ratio math here: İsmayılBank's obligations are
// the bank's own — they are not backed by the İRF fund, and the verdict
// must never fold fund assets into the bank's standing.

export type BankHealthLevel = "saglam" | "diqqet" | "gergin";
export type BankHealthTone = "good" | "warn" | "bad";
export type BankHealthReason = { tone: BankHealthTone; text: string };
export type BankHealth = {
  level: BankHealthLevel;
  title: string;
  reasons: BankHealthReason[];
};

const az = (n: number) => formatAzn(n);

/**
 * One verdict from the three signals people actually care about. Thresholds
 * follow the established liquidityTone scale (60/30) plus the absolute red
 * line: a projection that dips below zero. Null inputs (data unavailable)
 * simply contribute no reason — the verdict never punishes a Sheets outage.
 */
export function computeBankHealth(input: {
  liquidityPct: number | null;
  overdueCount: number;
  overdueTotalAzn: number;
  projectionMinAzn: number | null;
}): BankHealth {
  const reasons: BankHealthReason[] = [];
  const push = (tone: BankHealthTone, text: string) => {
    reasons.push({ tone, text });
  };

  const lp = input.liquidityPct;
  if (lp != null) {
    const pct = `${formatGroupedTrim(lp, 0)}%`;
    if (lp >= 60) push("good", `Likvidlik nisbəti ${pct} — güclü zonada`);
    else if (lp >= 30) push("warn", `Likvidlik nisbəti ${pct} — orta zonada`);
    else push("bad", `Likvidlik nisbəti ${pct} — aşağı zonada`);
  }

  if (input.overdueCount > 0) {
    push(
      "warn",
      `${input.overdueCount} gecikmiş ödəniş — cəmi ${az(input.overdueTotalAzn)}`,
    );
  } else {
    push("good", "Gecikmiş ödəniş yoxdur");
  }

  if (input.projectionMinAzn != null) {
    if (input.projectionMinAzn < 0) {
      push(
        "bad",
        `Proqnozun ən dar nöqtəsi mənfidir (${az(input.projectionMinAzn)})`,
      );
    } else {
      push("good", "Proqnoz bütün dövr boyu müsbət qalır");
    }
  }

  const worst: BankHealthTone = reasons.some((r) => r.tone === "bad")
    ? "bad"
    : reasons.some((r) => r.tone === "warn")
      ? "warn"
      : "good";
  const level: BankHealthLevel =
    worst === "bad" ? "gergin" : worst === "warn" ? "diqqet" : "saglam";
  const title =
    level === "saglam"
      ? "Sağlam"
      : level === "diqqet"
        ? "Diqqət tələb edir"
        : "Gərgin";

  return { level, title, reasons };
}

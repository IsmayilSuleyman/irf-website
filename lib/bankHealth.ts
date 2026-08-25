import { formatAzn, formatGroupedTrim } from "@/lib/portfolio";

// Pure, client-safe health/coverage math for the Ümumbank baxışı. Kept out
// of lib/bank.ts on purpose: that module drags @googleapis/sheets +
// next/cache along, and these helpers are plain arithmetic over already-
// aggregated numbers (mirrors the lib/bankTermsData split).

export type DepositCoverage = {
  /** backing ÷ deposit obligations; null when obligations are 0. */
  ratio: number | null;
  /** True when the İRF stake was unavailable — the ratio is then a floor
   *  ("ən azı"), computed from free liquidity alone. */
  minOnly: boolean;
  backingAzn: number;
  netLiquidityAzn: number;
  principalStakeAzn: number;
  depositObligationsAzn: number;
};

/**
 * The guarantee card's number: how many manat stand behind every 1 ₼ of
 * deposit obligations. Backing = the bank's free liquidity + İsmayıl's own
 * live İRF stake (the personal guarantee made quantitative). A negative
 * net liquidity honestly REDUCES the backing rather than clamping to 0.
 */
export function computeDepositCoverage(input: {
  depositObligationsAzn: number;
  netLiquidityAzn: number;
  principalStakeAzn: number | null;
}): DepositCoverage {
  const stake = input.principalStakeAzn;
  const backingAzn = input.netLiquidityAzn + (stake ?? 0);
  return {
    ratio:
      input.depositObligationsAzn > 0
        ? backingAzn / input.depositObligationsAzn
        : null,
    minOnly: stake == null,
    backingAzn,
    netLiquidityAzn: input.netLiquidityAzn,
    principalStakeAzn: stake ?? 0,
    depositObligationsAzn: input.depositObligationsAzn,
  };
}

export type BankHealthLevel = "saglam" | "diqqet" | "gergin";
export type BankHealthTone = "good" | "warn" | "bad";
export type BankHealthReason = { tone: BankHealthTone; text: string };
export type BankHealth = {
  level: BankHealthLevel;
  title: string;
  reasons: BankHealthReason[];
};

const az = (n: number) => formatAzn(n);
const x = (r: number) => `${formatGroupedTrim(r, 2)}×`;

/**
 * One verdict from the four signals people actually care about. Thresholds
 * follow the established liquidityTone scale (60/30) plus the two absolute
 * red lines: a projection that dips below zero and deposits not fully
 * covered. Null inputs (data unavailable) simply contribute no reason —
 * the verdict never punishes a Sheets outage.
 */
export function computeBankHealth(input: {
  liquidityPct: number | null;
  overdueCount: number;
  overdueTotalAzn: number;
  projectionMinAzn: number | null;
  coverage: DepositCoverage | null;
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

  const cov = input.coverage;
  if (cov?.ratio != null) {
    const floor = cov.minOnly ? "ən azı " : "";
    if (cov.ratio >= 1.5) {
      push("good", `Depozitlərin təminat əmsalı ${floor}${x(cov.ratio)} — tam örtülür`);
    } else if (cov.ratio >= 1) {
      push("warn", `Depozitlərin təminat əmsalı ${floor}${x(cov.ratio)}`);
    } else if (cov.minOnly) {
      // A sub-1 FLOOR isn't a verdict — the stake half of the backing was
      // simply unavailable this render.
      push("warn", `Təminat əmsalı ən azı ${x(cov.ratio)} (fond payı hesablanmadı)`);
    } else {
      push("bad", `Təminat əmsalı ${x(cov.ratio)} — depozitlər tam örtülmür`);
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

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAzn } from "@/lib/portfolio";
import type { DebtProjection, DebtSchedulePoint } from "@/lib/debtSchedule";

function payoffLabel(months: number | null): string {
  if (months === null) return "10 ildən çox";
  if (months === 0) return "Ödənilib";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} ay`;
  if (rem === 0) return `${years} il`;
  return `${years} il ${rem} ay`;
}

function PaidOffBar({ remaining, original }: { remaining: number; original: number }) {
  const pct = original > 0 ? Math.max(0, Math.min(1, 1 - remaining / original)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-black/8 overflow-hidden">
      <div
        className="h-full rounded-full bg-brand-red/70 transition-all"
        style={{ width: `${(1 - pct) * 100}%` }}
      />
    </div>
  );
}

export function DebtPanel({
  projections,
  schedule,
}: {
  projections: DebtProjection[];
  schedule: DebtSchedulePoint[];
}) {
  const totalRemaining = projections.reduce((s, d) => s + d.remainingAzn, 0);
  const totalOriginal = projections.reduce((s, d) => s + d.originalAzn, 0);
  const totalMonthly = projections.reduce((s, d) => s + d.monthlyPaymentAzn, 0);

  return (
    <div className="glass p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-red/80">
          Borclar
        </div>
        <div className="num text-xs text-black/40">
          {formatAzn(totalMonthly)} / ay
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-[11px] text-black/45 mb-0.5">Ümumi Borc</div>
          <div className="num text-xl font-semibold text-black/85">{formatAzn(totalRemaining)}</div>
          {totalOriginal > 0 && (
            <div className="text-[11px] text-black/35 mt-0.5">
              {((totalRemaining / totalOriginal) * 100).toFixed(1)}% qalıb
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-black/45 mb-0.5">Ödənilmiş</div>
          <div className="num text-xl font-semibold text-black/85">{formatAzn(totalOriginal - totalRemaining)}</div>
          {totalOriginal > 0 && (
            <div className="text-[11px] text-black/35 mt-0.5">
              {(((totalOriginal - totalRemaining) / totalOriginal) * 100).toFixed(1)}% tamamlandı
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] text-black/45 mb-0.5">Aylıq Ödəniş</div>
          <div className="num text-xl font-semibold text-black/85">{formatAzn(totalMonthly)}</div>
        </div>
      </div>

      {/* Debt reduction chart */}
      {schedule.length > 1 && (
        <div>
          <div className="mb-3 text-[11px] text-black/40">Borcun azalma proqnozu</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={schedule} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgba(0,0,0,0.45)"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis hide domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255,255,255,0.96)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 12,
                    boxShadow: "0 8px 30px -12px rgba(0,0,0,0.2)",
                    fontSize: 12,
                    color: "#0a0a0a",
                  }}
                  labelStyle={{ color: "rgba(0,0,0,0.55)" }}
                  formatter={(v: number) => [formatAzn(v), "Qalan borc"]}
                />
                <Area
                  type="monotone"
                  dataKey="remaining"
                  stroke="#dc2626"
                  strokeWidth={2}
                  fill="url(#debtGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Individual debts */}
      {projections.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] text-black/40">Borcların siyahısı</div>
          <ul className="flex flex-col divide-y divide-[color:var(--glass-border)]">
            {projections.map((debt) => (
              <li key={debt.name} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-black/85 font-medium">{debt.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {debt.annualInterestRate > 0 && (
                      <span className="num text-[11px] text-black/40">
                        {(debt.annualInterestRate * 100).toFixed(1)}% il
                      </span>
                    )}
                    <span className="num text-xs text-black/50">
                      {formatAzn(debt.monthlyPaymentAzn)}/ay
                    </span>
                    <span className="num text-sm font-semibold text-brand-red/80">
                      {formatAzn(debt.remainingAzn)}
                    </span>
                  </div>
                </div>
                <PaidOffBar remaining={debt.remainingAzn} original={debt.originalAzn} />
                <div className="flex items-center justify-between text-[11px] text-black/35">
                  <span>Başlanğıc: {formatAzn(debt.originalAzn)}</span>
                  <span>Ödəniş müddəti: {payoffLabel(debt.payoffMonths)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

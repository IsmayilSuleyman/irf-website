import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAuthedContext, rpcErrorResponse } from "@/lib/api";

export const runtime = "nodejs";

// İsmayıl edits the advertised deposit/credit rate tiers. The whole tier
// list for one product is replaced atomically inside the admin RPC.
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (ctx instanceof NextResponse) return ctx;

  const body = (await req.json().catch(() => null)) as
    | { product?: unknown; terms?: unknown }
    | null;

  const product =
    body?.product === "deposit" || body?.product === "credit" ? body.product : null;
  if (!product) {
    return NextResponse.json(
      { error: "product must be 'deposit' or 'credit'" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body?.terms) || body.terms.length === 0) {
    return NextResponse.json({ error: "terms must be a non-empty array" }, { status: 400 });
  }
  const terms: { term_months: number; annual_rate_pct: number }[] = [];
  const seen = new Set<number>();
  for (const t of body.terms as Record<string, unknown>[]) {
    const months = Number(t?.termMonths);
    const rate = Number(t?.annualRatePct);
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      return NextResponse.json(
        { error: "hər sətirdə müddət 1-120 ay aralığında tam ədəd olmalıdır" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json(
        { error: "hər sətirdə faiz 0-100 aralığında olmalıdır" },
        { status: 400 },
      );
    }
    if (seen.has(months)) {
      return NextResponse.json(
        { error: `müddət təkrarlanır: ${months} ay` },
        { status: 400 },
      );
    }
    seen.add(months);
    terms.push({ term_months: months, annual_rate_pct: rate });
  }

  const { data, error } = await ctx.supabase.rpc("admin_set_bank_product_terms", {
    p_product: product,
    p_terms: terms,
  });
  if (error) return rpcErrorResponse(error);

  // The calculators read through unstable_cache; refresh them immediately.
  revalidateTag("bank-terms");

  return NextResponse.json({ result: data });
}

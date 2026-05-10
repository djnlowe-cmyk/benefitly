// Anthropic API list prices in USD per 1M tokens, captured 2026-05-10. Values
// are in **tenths of a pence GBP** (deci-pence) to keep the report integer-only
// — avoids floating-point drift in the deterministic benchmark output. Update
// alongside MODEL_PRICING_VERSION whenever the upstream price list moves.
//
// Conversion: USD/MTok -> GBP-deci-pence per token
//   usd_per_token = usd_per_mtok / 1_000_000
//   gbp_per_token = usd_per_token * USD_TO_GBP
//   deci_pence    = gbp_per_token * 1000   (1p = 10 deci-pence)
//
// We intentionally fix USD_TO_GBP for the report so a benchmark run is
// reproducible from inputs alone. Production cost dashboards live elsewhere
// and should fetch live FX.

export const MODEL_PRICING_VERSION = '2026-05-10.v1';
export const USD_TO_GBP = 0.79;

interface ModelPricing {
  inputUsdPerMtok: number;
  outputUsdPerMtok: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { inputUsdPerMtok: 3, outputUsdPerMtok: 15 },
  'claude-haiku-4-5-20251001': { inputUsdPerMtok: 1, outputUsdPerMtok: 5 },
  'claude-opus-4-7': { inputUsdPerMtok: 15, outputUsdPerMtok: 75 },
};

export function pricingFor(model: string): ModelPricing | null {
  return PRICING[model] ?? null;
}

// Returns cost in deci-pence (10ths of a UK penny). Returns null if the model
// is not in the price table — the harness records this so an unknown model
// produces a clearly-flagged "cost: unknown" row instead of silent zero.
export function costInDeciPence(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const p = pricingFor(model);
  if (!p) return null;
  const usd =
    (inputTokens * p.inputUsdPerMtok + outputTokens * p.outputUsdPerMtok) /
    1_000_000;
  const gbp = usd * USD_TO_GBP;
  return Math.round(gbp * 1000);
}

export function formatDeciPence(value: number | null): string {
  if (value === null) return 'unknown';
  const pence = value / 10;
  if (pence < 100) return `${pence.toFixed(2)}p`;
  return `£${(pence / 100).toFixed(2)}`;
}

// Centralised regional formatting. Defaults to GB / GBP for v1; the schema
// supports any ISO country/currency so we keep these as plain strings.

export const COUNTRY_LOCALES: Record<string, string> = {
  GB: 'en-GB',
  US: 'en-US',
  CA: 'en-CA',
  IE: 'en-IE',
  FR: 'fr-FR',
  DE: 'de-DE',
  ES: 'es-ES',
  NL: 'nl-NL',
};

export const COUNTRY_CURRENCIES: Record<string, string> = {
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  IE: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
};

export interface RegionContext {
  country?: string | null;
  currency?: string | null;
}

const DEFAULT_REGION: Required<RegionContext> = {
  country: 'GB',
  currency: 'GBP',
};

function resolve(region?: RegionContext) {
  const country: string = region?.country ?? DEFAULT_REGION.country;
  const currency: string =
    region?.currency ?? COUNTRY_CURRENCIES[country] ?? DEFAULT_REGION.currency;
  const locale: string = COUNTRY_LOCALES[country] ?? 'en-GB';
  return { country, currency, locale };
}

export function formatCurrency(
  amount: number | null | undefined,
  region?: RegionContext,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const { locale, currency } = resolve(region);
  const isWhole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? (isWhole ? 0 : 2),
    maximumFractionDigits: options?.maximumFractionDigits ?? (isWhole ? 0 : 2),
  }).format(amount);
}

// Parses a YYYY-MM-DD string (or ISO date) as UTC noon to avoid TZ rollovers.
function parseDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0));
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | Date | null | undefined, region?: RegionContext): string {
  const date = parseDate(value);
  if (!date) return typeof value === 'string' ? value : '';
  const { locale } = resolve(region);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateLong(value: string | Date | null | undefined, region?: RegionContext): string {
  const date = parseDate(value);
  if (!date) return typeof value === 'string' ? value : '';
  const { locale } = resolve(region);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

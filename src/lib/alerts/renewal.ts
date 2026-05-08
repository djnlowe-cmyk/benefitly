import type { PrismaClient } from '@prisma/client';
import { formatDate, type RegionContext } from '@/lib/format';

export const RENEWAL_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RenewalCoverageInput {
  id: string;
  provider: string;
  type: string;
  endDate: string | null;
}

export interface EnsureRenewalAlertArgs {
  coverage: RenewalCoverageInput;
  userId: string;
  region?: RegionContext;
  now?: Date;
}

export interface EnsureRenewalAlertResult {
  created: boolean;
  alertId?: string;
}

// Mirrors parseDate in src/lib/format.ts — anchor at UTC noon to avoid
// timezone rollover when comparing a YYYY-MM-DD date to "today".
function parseUtcNoon(input: string): Date | null {
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

function todayUtcNoon(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
}

export async function ensureRenewalAlert(
  prisma: PrismaClient,
  { coverage, userId, region, now = new Date() }: EnsureRenewalAlertArgs,
): Promise<EnsureRenewalAlertResult> {
  try {
    if (!coverage.endDate) return { created: false };
    const end = parseUtcNoon(coverage.endDate);
    if (!end) return { created: false };

    const today = todayUtcNoon(now);
    if (end.getTime() < today.getTime()) return { created: false };

    const daysOut = Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
    if (daysOut > RENEWAL_WINDOW_DAYS) return { created: false };

    const existing = await prisma.alert.findFirst({
      where: { coverageId: coverage.id, type: 'renewal' },
    });
    if (existing) return { created: false };

    const formatted = formatDate(coverage.endDate, region);
    const alert = await prisma.alert.create({
      data: {
        type: 'renewal',
        severity: 'warning',
        title: `Renewal — ${coverage.provider} ${coverage.type} expires ${formatted}`,
        detail: `Your ${coverage.provider} ${coverage.type} policy is up for renewal on ${formatted}. Review options before it lapses.`,
        date: coverage.endDate,
        read: false,
        coverageId: coverage.id,
        userId,
      },
    });
    return { created: true, alertId: alert.id };
  } catch (err) {
    // Coverage write is the source of truth — never let alert failure break the save.
    // eslint-disable-next-line no-console
    console.error('[ensureRenewalAlert] failed', err);
    return { created: false };
  }
}

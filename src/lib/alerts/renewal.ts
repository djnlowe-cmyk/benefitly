import type { Alert, PrismaClient } from '@prisma/client';
import { formatDate } from '@/lib/format';

const RENEWAL_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RenewalCoverageInput {
  id: string;
  provider: string;
  category: string;
  endDate: string;
}

export interface EnsureRenewalAlertArgs {
  coverage: RenewalCoverageInput;
  userId: string;
  now?: Date;
}

export type EnsureRenewalAlertResult =
  | { status: 'created'; alert: Alert }
  | {
      status: 'skipped';
      reason: 'expired' | 'out_of_window' | 'already_exists' | 'invalid_date' | 'error';
    };

function parseEndOfDayUtc(input: string): Date | null {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (ymd) {
    const [, y, m, d] = ymd;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999));
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function ensureRenewalAlert(
  prisma: PrismaClient,
  { coverage, userId, now = new Date() }: EnsureRenewalAlertArgs,
): Promise<EnsureRenewalAlertResult> {
  try {
    const endDate = parseEndOfDayUtc(coverage.endDate);
    if (!endDate) return { status: 'skipped', reason: 'invalid_date' };

    if (endDate.getTime() < now.getTime()) {
      return { status: 'skipped', reason: 'expired' };
    }

    const daysOut = (endDate.getTime() - now.getTime()) / MS_PER_DAY;
    if (daysOut > RENEWAL_WINDOW_DAYS) {
      return { status: 'skipped', reason: 'out_of_window' };
    }

    const existing = await prisma.alert.findFirst({
      where: { coverageId: coverage.id, type: 'renewal', read: false },
    });
    if (existing) return { status: 'skipped', reason: 'already_exists' };

    const formatted = formatDate(coverage.endDate);
    const alert = await prisma.alert.create({
      data: {
        type: 'renewal',
        severity: 'warning',
        title: `Renewal — ${coverage.provider} ${coverage.category} expires ${formatted}`,
        detail: `Your ${coverage.provider} ${coverage.category} policy expires on ${formatted}. Renew or replace before then.`,
        date: coverage.endDate,
        read: false,
        coverageId: coverage.id,
        userId,
      },
    });
    return { status: 'created', alert };
  } catch (err) {
    console.error('[ensureRenewalAlert] failed', err);
    return { status: 'skipped', reason: 'error' };
  }
}

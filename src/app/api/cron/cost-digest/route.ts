import { NextRequest, NextResponse } from 'next/server';
import { buildDigestReport, formatPence } from '@/lib/costMetrics';
import { adminEmails } from '@/lib/admin';

// Weekly digest. Mondays 09:00 UK time via Vercel Cron — see vercel.json.
// CEO ask (issue body): median £/paying-user/mo, p90, week-over-week delta,
// cache-hit %, and an explicit flag if median ≥ £1.10 for two consecutive
// weeks even when inside Phase-1 cap.
//
// Auth: Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` automatically
// when CRON_SECRET is configured; reject anything else so the route can't
// be poked publicly. In dev with no secret set, fall back to allowing
// requests with `x-cost-digest-key` matching CRON_SECRET (manual trigger).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAuthorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Hard-disable in prod-like envs (any non-development deploy).
    return process.env.NODE_ENV !== 'production';
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  if (req.headers.get('x-cost-digest-key') === expected) return true;
  return false;
}

interface DigestEmail {
  subject: string;
  recipients: string[];
  bodyMarkdown: string;
}

function renderEmail(report: Awaited<ReturnType<typeof buildDigestReport>>): DigestEmail {
  const c = report.current;
  const p = report.previous;
  const flag = report.tripWireConsecutive
    ? '🚨 TRIP-WIRE: median ≥ £1.10 for two consecutive weeks'
    : report.tripWireBreached
    ? '⚠️ Median is at the £1.10 trip-wire this week — watch next week'
    : report.overPhase1Cap
    ? '🚨 Median is OVER the Phase-1 cap (£1.20)'
    : '✓ Median inside cap';

  const wowSign = report.weekOverWeekDeltaPence >= 0 ? '+' : '';
  const wowPence = `${wowSign}${formatPence(Math.abs(report.weekOverWeekDeltaPence)).replace('£', report.weekOverWeekDeltaPence < 0 ? '-£' : '£')}`;
  const wowPct =
    report.previous.cohort.median === 0
      ? 'n/a'
      : `${(report.weekOverWeekDeltaPct * 100).toFixed(1)}%`;

  const bodyMarkdown = [
    `# Benefitly weekly AI cost digest`,
    ``,
    `**Status:** ${flag}`,
    ``,
    `Week of ${c.windowStart.toISOString().slice(0, 10)} → ${c.windowEnd.toISOString().slice(0, 10)}`,
    ``,
    `| Metric | This week | Prior week |`,
    `| --- | --- | --- |`,
    `| Median £/paying-user/mo | ${formatPence(c.cohort.median)} | ${formatPence(p.cohort.median)} |`,
    `| p90 £/paying-user/mo | ${formatPence(c.cohort.p90)} | ${formatPence(p.cohort.p90)} |`,
    `| Mean £/paying-user/mo | ${formatPence(c.cohort.mean)} | ${formatPence(p.cohort.mean)} |`,
    `| Active users | ${c.cohort.count} | ${p.cohort.count} |`,
    `| Cache-hit % | ${(c.cacheHitRate * 100).toFixed(1)}% | ${(p.cacheHitRate * 100).toFixed(1)}% |`,
    `| Total cohort spend | ${formatPence(c.cohort.totalPence)} | ${formatPence(p.cohort.totalPence)} |`,
    ``,
    `**Week-over-week median delta:** ${wowPence} (${wowPct})`,
    ``,
    `Targets: ${formatPence(report.thresholds.targetLow)}–${formatPence(report.thresholds.targetHigh)} per paying user/mo. Phase-1 cap ${formatPence(report.thresholds.phase1Cap)}, trip-wire ${formatPence(report.thresholds.tripWire)}.`,
  ].join('\n');

  return {
    subject: `[Benefitly] AI cost weekly — median ${formatPence(c.cohort.median)} ${
      report.tripWireConsecutive ? '🚨' : report.tripWireBreached ? '⚠️' : ''
    }`.trim(),
    recipients: adminEmails(),
    bodyMarkdown,
  };
}

// Email delivery is intentionally pluggable. v1 ships with two paths:
// - log-only (default): the digest is logged + returned in the JSON body
// - webhook: if COST_DIGEST_WEBHOOK_URL is set, POST {subject, body} to it
// Replacing this with Resend/SES is a one-line change once we pick a vendor.
async function deliverDigest(email: DigestEmail): Promise<{ delivered: 'webhook' | 'log' }> {
  const url = process.env.COST_DIGEST_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: email.subject,
          recipients: email.recipients,
          body: email.bodyMarkdown,
        }),
      });
      return { delivered: 'webhook' };
    } catch (err) {
      console.error('cost-digest webhook delivery failed', err);
    }
  }
  console.log('[cost-digest]', email.subject);
  console.log(email.bodyMarkdown);
  return { delivered: 'log' };
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const report = await buildDigestReport();
  const email = renderEmail(report);
  const delivery = await deliverDigest(email);

  return NextResponse.json({
    ok: true,
    delivered: delivery.delivered,
    recipients: email.recipients,
    tripWireBreached: report.tripWireBreached,
    tripWireConsecutive: report.tripWireConsecutive,
    overPhase1Cap: report.overPhase1Cap,
    medianPence: report.current.cohort.median,
    p90Pence: report.current.cohort.p90,
    weekOverWeekDeltaPence: report.weekOverWeekDeltaPence,
    cacheHitRate: report.current.cacheHitRate,
  });
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  buildAccountExportZip,
  checkExportRateLimit,
  EXPORT_AUDIT_ACTION,
} from '@/lib/account-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const userId = (session.user as unknown as { id: string }).id;

  const rate = await checkExportRateLimit(userId, prisma);
  if (!rate.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Export rate-limited; one export per hour per account.',
        retryAfterSeconds: rate.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rate.retryAfterSeconds),
        },
      },
    );
  }

  // Reserve the rate-limit slot AND record SAR evidence up-front so an
  // in-flight crash leaves a "started" row instead of vanishing. Per CTO
  // review on ALI-128: privacy-by-default, prefer over-record to under-record.
  const auditRow = await prisma.auditLog.create({
    data: {
      userId,
      action: EXPORT_AUDIT_ACTION,
      byteCount: 0,
      metadata: JSON.stringify({ status: 'started' }),
    },
  });

  let result;
  try {
    result = await buildAccountExportZip(userId, prisma);
  } catch (err) {
    console.error('[account-export] failed:', err);
    await prisma.auditLog.update({
      where: { id: auditRow.id },
      data: {
        metadata: JSON.stringify({
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      },
    }).catch((updateErr) => {
      console.error('[account-export] audit failed-status write also failed:', updateErr);
    });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

  await prisma.auditLog.update({
    where: { id: auditRow.id },
    data: {
      byteCount: result.byteCount,
      metadata: JSON.stringify({
        status: 'success',
        documentCount: result.documentCount,
        documentReadFailures: result.documentReadFailures,
      }),
    },
  });

  const filename = `benefitly-export-${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(result.byteCount),
      'Cache-Control': 'no-store',
    },
  });
}

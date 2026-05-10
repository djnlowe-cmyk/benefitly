import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  buildAccountExportZip,
  encodeAuditMetadata,
  extractRequestContext,
  reserveExportSlot,
} from '@/lib/account-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const userId = (session.user as unknown as { id: string }).id;

  const context = extractRequestContext(req);

  // Reserves the rate-limit slot AND records SAR evidence up-front so an
  // in-flight crash leaves a "started" row instead of vanishing. The gate-check
  // and audit row insert run under a per-user lock to close the TOCTOU window
  // identified on ALI-151.
  const reservation = await reserveExportSlot(userId, prisma, context);
  if (!reservation.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Export rate-limited; one export per hour per account.',
        retryAfterSeconds: reservation.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(reservation.retryAfterSeconds),
        },
      },
    );
  }
  const { auditRow } = reservation;

  let result;
  try {
    result = await buildAccountExportZip(userId, prisma);
  } catch (err) {
    console.error('[account-export] failed:', err);
    await prisma.auditLog.update({
      where: { id: auditRow.id },
      data: {
        metadata: encodeAuditMetadata({
          outcome: 'failure',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          error: err instanceof Error ? err.message : String(err),
        }),
      },
    }).catch((updateErr) => {
      console.error('[account-export] audit failure-status write also failed:', updateErr);
    });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

  await prisma.auditLog.update({
    where: { id: auditRow.id },
    data: {
      byteCount: result.byteCount,
      metadata: encodeAuditMetadata({
        outcome: 'success',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
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

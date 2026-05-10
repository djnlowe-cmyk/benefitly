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

  let result;
  try {
    result = await buildAccountExportZip(userId, prisma);
  } catch (err) {
    console.error('[account-export] failed:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: EXPORT_AUDIT_ACTION,
      byteCount: result.byteCount,
      metadata: JSON.stringify({
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

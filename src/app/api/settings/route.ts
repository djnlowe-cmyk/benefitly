import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { COUNTRY_CURRENCIES, COUNTRY_LOCALES } from '@/lib/format';

// Only GB is fully supported in v1. The rest are exposed in the picker but
// blocked here so a curl bypass can't put a user into an unsupported state.
const ENABLED_COUNTRIES = new Set(['GB']);

export async function GET() {
  const session = await requireUserId();
  if (!session.ok) return session.response;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { country: true, currency: true, name: true, email: true },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const body = (await req.json().catch(() => null)) as { country?: string } | null;
  const country = body?.country;
  if (!country || typeof country !== 'string') {
    return NextResponse.json({ error: 'country is required' }, { status: 400 });
  }
  if (!(country in COUNTRY_LOCALES)) {
    return NextResponse.json({ error: 'unknown country' }, { status: 400 });
  }
  if (!ENABLED_COUNTRIES.has(country)) {
    return NextResponse.json(
      { error: `country ${country} is not yet supported. Coming soon.` },
      { status: 400 }
    );
  }

  const currency = COUNTRY_CURRENCIES[country] || 'GBP';
  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { country, currency },
    select: { country: true, currency: true },
  });

  return NextResponse.json(updated);
}

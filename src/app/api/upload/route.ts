import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { parseDocument, type ParseMimeType } from '@/lib/ai';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

const ALLOWED_TYPES: readonly ParseMimeType[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const userId = (session.user as unknown as { id: string }).id;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type as ParseMimeType)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF or image files.' },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filepath = join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    const document = await prisma.document.create({
      data: {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath: filepath,
        userId,
      },
    });

    let parsedData = null;
    let confidence = null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your-api-key-here') {
      const result = await parseDocument({
        buffer,
        mimeType: file.type as ParseMimeType,
        country: 'GB',
        currency: 'GBP',
        apiKey,
      });
      if (result.error) {
        console.error('AI parsing failed:', result.error);
      } else if (result.parsed) {
        parsedData = result.parsed;
        confidence = parsedData.confidence ?? null;
      }
    }

    if (parsedData) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          parsedData: JSON.stringify(parsedData),
          confidence,
        },
      });
    }

    let coverage = null;
    if (parsedData) {
      coverage = await prisma.coverage.create({
        data: {
          provider: parsedData.provider || 'Unknown Provider',
          type: parsedData.type || 'Unknown',
          category: parsedData.category || 'health',
          policyNo: parsedData.policyNo || null,
          status: 'active',
          statusLabel: 'Active',
          covered: JSON.stringify(parsedData.covered || []),
          startDate: parsedData.startDate || '',
          endDate: parsedData.endDate || '',
          premium: parsedData.premium || 0,
          deductible: parsedData.deductible ?? null,
          oopMax: parsedData.oopMax ?? null,
          coverageLimit: parsedData.coverageLimit || null,
          coInsurance: parsedData.coInsurance || null,
          exclusions: JSON.stringify(parsedData.exclusions || []),
          claimPhone: parsedData.claimPhone || null,
          claimUrl: parsedData.claimUrl || null,
          summary: parsedData.summary || null,
          confidence,
          documentId: document.id,
          userId,
        },
      });

      coverage = {
        ...coverage,
        covered: JSON.parse(coverage.covered),
        exclusions: JSON.parse(coverage.exclusions),
      };
    }

    return NextResponse.json({
      document: { id: document.id, filename: document.filename },
      parsed: parsedData,
      coverage,
      needsReview: !confidence || confidence < 0.9,
    }, { status: 201 });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

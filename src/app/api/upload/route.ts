import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// The extraction prompt for Claude
const EXTRACTION_PROMPT = `You are a document parser for Benefitly, a coverage management application. 
Extract the following structured fields from this insurance policy, warranty, or coverage document.
Return ONLY valid JSON with no markdown formatting.

Required fields:
{
  "provider": "Name of the insurance company, warranty provider, or card issuer",
  "type": "Type of coverage (e.g. Health Insurance, Auto Insurance, AppleCare+, Credit Card Benefits)",
  "category": "One of: health, dental, vision, life, disability, auto, home, travel, pet, warranty, creditcard, business",
  "policyNo": "Policy number, member ID, or account number",
  "covered": ["List of covered people, vehicles, properties, or items"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD or 'Ongoing'",
  "premium": 0,
  "deductible": 0,
  "oopMax": null,
  "limit": "Coverage limit description",
  "coInsurance": "Co-insurance terms or null",
  "exclusions": ["List of exclusions"],
  "claimPhone": "Claims phone number",
  "claimUrl": "Claims website URL",
  "summary": "One-sentence plain-language summary of what this coverage does",
  "confidence": 0.0 to 1.0
}

Set confidence to:
- 0.9+ if the document is clear and all fields are explicitly stated
- 0.7-0.9 if some fields are inferred or partially visible
- Below 0.7 if the document is unclear, damaged, or missing key information

For any field you cannot find, use null (for strings/numbers) or empty array (for arrays).`;

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

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF or image files.' },
        { status: 400 }
      );
    }

    // Save file to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filepath = join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    // Create document record
    const document = await prisma.document.create({
      data: {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath: filepath,
        userId,
      },
    });

    // Call Claude API for extraction
    let parsedData = null;
    let confidence = null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== 'your-api-key-here') {
      try {
        const base64 = buffer.toString('base64');
        const mediaType = file.type as 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

        const content: Array<Record<string, unknown>> = [];

        if (file.type === 'application/pdf') {
          content.push({
            type: 'document',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          });
        } else {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          });
        }

        content.push({ type: 'text', text: EXTRACTION_PROMPT });

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{ role: 'user', content }],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const text = result.content?.[0]?.text || '';

          // Parse JSON from response (handle potential markdown wrapping)
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
            confidence = parsedData.confidence ?? null;
          }
        }
      } catch (parseError) {
        console.error('AI parsing failed:', parseError);
        // Continue without parsed data — user can enter manually
      }
    }

    // Update document with parsed data
    if (parsedData) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          parsedData: JSON.stringify(parsedData),
          confidence,
        },
      });
    }

    // If parsing succeeded, create a draft coverage record
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
          coverageLimit: parsedData.limit || null,
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

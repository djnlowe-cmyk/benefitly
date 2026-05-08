import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { getDocumentStorage } from '@/lib/storage';

// Builds an extraction prompt parameterised by the user's region. v1 ships
// with a tuned UK prompt; other locales fall back to a generic prompt that
// still asks the model to record the source currency / region cues.
function buildExtractionPrompt(country: string, currency: string) {
  const isUK = country === 'GB';
  const ukGuidance = isUK
    ? `
This document is from a UK customer. Apply UK conventions:
- Money is in pounds sterling (£, GBP). Strip any £ when populating numeric fields.
- Use UK insurer terminology: "excess" (not "deductible"), "buildings & contents" (not "homeowner's"), "motor" (not "auto"), "private medical" (not "PPO"), "income protection" (not "disability").
- For credit card benefits, surface Section 75 (joint liability with retailer for £100–£30,000 purchases) and chargeback rights where relevant.
- Health policies typically sit alongside the NHS — note this in the summary if the document refers to it.
- Common UK insurers to recognise: Aviva, Direct Line, LV=, Admiral, More Than, Bupa, AXA, Hiscox, Legal & General, Petplan, Halifax, HSBC, Barclays, NatWest, Lloyds, Monzo, Starling, RSA.
- FCA-authorised firms cite an FRN — capture into policyNo if present.
`
    : `
The user's country is ${country} and currency is ${currency}. Use local conventions where possible.
`;

  return `You are a document parser for Benefitly, a coverage management application.
Extract the following structured fields from this insurance policy, warranty, or coverage document.
Return ONLY valid JSON with no markdown formatting.
${ukGuidance}
Required fields:
{
  "provider": "Name of the insurer, warranty provider, or card issuer",
  "type": "Type of cover (e.g. Private Medical Insurance, Comprehensive Motor Insurance, AppleCare+, Card Benefits / Section 75)",
  "category": "One of: health, dental, vision, life, disability, auto, home, travel, pet, warranty, creditcard, business",
  "policyNo": "Policy number, membership number, FRN, or account reference",
  "covered": ["List of covered people, vehicles, properties, or items"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD or 'Ongoing'",
  "premium": 0,
  "deductible": 0,
  "oopMax": null,
  "limit": "Cover limit description (use the document's wording, including currency symbol)",
  "coInsurance": "Co-insurance / excess split or null",
  "exclusions": ["List of exclusions"],
  "claimPhone": "Claims phone number",
  "claimUrl": "Claims website URL",
  "summary": "One-sentence plain-language summary of what this cover does, in the user's region",
  "confidence": 0.0 to 1.0
}

Set confidence to:
- 0.9+ if the document is clear and all fields are explicitly stated
- 0.7-0.9 if some fields are inferred or partially visible
- Below 0.7 if the document is unclear, damaged, or missing key information

For any field you cannot find, use null (for strings/numbers) or empty array (for arrays).`;
}

export async function POST(req: NextRequest) {
  const session = await requireUserId();
  if (!session.ok) return session.response;

  const userId = session.userId;

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

    // Look up the user's region so the extraction prompt can be tuned for it.
    const userRegion = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true, currency: true },
    });
    const country = userRegion?.country || 'GB';
    const currency = userRegion?.currency || 'GBP';

    // Persist the file via the storage backend (Vercel Blob in prod, local
    // disk in dev). Vercel's runtime filesystem is read-only outside /tmp,
    // so a direct fs.writeFile under process.cwd() would EROFS at request time.
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const stored = await getDocumentStorage().put({
      userId,
      filename: file.name,
      contentType: file.type,
      body: buffer,
    });

    // Create document record
    const document = await prisma.document.create({
      data: {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath: stored.storagePath,
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

        content.push({ type: 'text', text: buildExtractionPrompt(country, currency) });

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

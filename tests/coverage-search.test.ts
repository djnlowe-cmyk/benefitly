import { describe, expect, it, vi } from 'vitest';
import {
  searchCoverages,
  type SearchCoveragePromptRow,
} from '@/lib/search/coverageSearch';

function row(overrides: Partial<SearchCoveragePromptRow> = {}): SearchCoveragePromptRow {
  return {
    id: 'cov-1',
    provider: 'Aviva',
    type: 'Travel — Annual Multi-Trip',
    category: 'travel',
    policyNo: null,
    summary: 'UK annual multi-trip travel insurance with £5,000 cancellation cover.',
    coverageLimit: '£5,000 cancellation',
    coInsurance: null,
    covered: ['Trip cancellation up to £5,000', 'Medical emergencies abroad'],
    exclusions: ['Pre-existing conditions undeclared'],
    ...overrides,
  };
}

function fakeFetch(claudeText: string, init: ResponseInit = { status: 200 }) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({ content: [{ type: 'text', text: claudeText }] }),
      { headers: { 'Content-Type': 'application/json' }, ...init },
    ),
  );
}

describe('searchCoverages', () => {
  it('returns valid hits when the model cites a real substring', async () => {
    const fetchImpl = fakeFetch(
      JSON.stringify({
        results: [
          {
            coverageId: 'cov-1',
            relevance: 'high',
            citedField: 'covered[0]',
            citedExcerpt: 'Trip cancellation up to £5,000',
            explanation: 'Aviva covers cancellation.',
            coordination: 'File a claim.',
          },
        ],
      }),
    );

    const result = await searchCoverages({
      coverages: [row()],
      query: 'travel cancellation',
      region: { country: 'GB', currency: 'GBP' },
      apiKey: 'sk-test',
      fetchImpl,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].citedExcerpt).toBe('Trip cancellation up to £5,000');
    expect(result.results[0].coordination).toBe('File a claim.');
    expect(result.gapAnswer).toBeUndefined();
  });

  it('drops hits whose citedExcerpt is not a verbatim substring of the source coverage', async () => {
    const fetchImpl = fakeFetch(
      JSON.stringify({
        results: [
          {
            coverageId: 'cov-1',
            relevance: 'high',
            citedField: 'covered[0]',
            citedExcerpt: 'Includes pet boarding for up to 30 days', // fabricated
            explanation: 'Should not appear.',
          },
        ],
        gapAnswer: {
          explanation: 'No matching cover.',
          recommendedTypes: ['Travel insurance'],
        },
      }),
    );

    const result = await searchCoverages({
      coverages: [row()],
      query: 'pet boarding',
      region: { country: 'GB', currency: 'GBP' },
      apiKey: 'sk-test',
      fetchImpl,
    });

    expect(result.results).toEqual([]);
    expect(result.gapAnswer?.explanation).toBe('No matching cover.');
    expect(result.gapAnswer?.recommendedTypes).toEqual(['Travel insurance']);
  });

  it('returns the parse-failure fallback when the model emits non-JSON', async () => {
    const fetchImpl = fakeFetch('I am not JSON.');
    const result = await searchCoverages({
      coverages: [row()],
      query: 'anything',
      region: { country: 'GB', currency: 'GBP' },
      apiKey: 'sk-test',
      fetchImpl,
    });
    expect(result.results).toEqual([]);
    expect(result.gapAnswer?.explanation).toMatch(/concierge/i);
  });

  it('returns the fallback when the upstream is non-2xx', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('overloaded', { status: 503 }),
    );
    const result = await searchCoverages({
      coverages: [row()],
      query: 'anything',
      region: { country: 'GB', currency: 'GBP' },
      apiKey: 'sk-test',
      fetchImpl,
    });
    expect(result.results).toEqual([]);
    expect(result.gapAnswer?.explanation).toMatch(/concierge/i);
  });

  it('returns the fallback when the fetch throws (e.g. abort/timeout)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    const result = await searchCoverages({
      coverages: [row()],
      query: 'anything',
      region: { country: 'GB', currency: 'GBP' },
      apiKey: 'sk-test',
      fetchImpl,
    });
    expect(result.results).toEqual([]);
    expect(result.gapAnswer?.explanation).toMatch(/concierge/i);
  });

  it('drops hits referencing unknown coverageIds', async () => {
    const fetchImpl = fakeFetch(
      JSON.stringify({
        results: [
          {
            coverageId: 'not-a-real-id',
            relevance: 'high',
            citedField: 'summary',
            citedExcerpt: 'whatever',
            explanation: 'should be filtered',
          },
        ],
      }),
    );
    const result = await searchCoverages({
      coverages: [row()],
      query: 'anything',
      region: { country: 'GB', currency: 'GBP' },
      apiKey: 'sk-test',
      fetchImpl,
    });
    expect(result.results).toEqual([]);
  });
});

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Coverage, SearchMatch } from '@/types/coverage';
import { apiFetch, ApiError } from '@/lib/api';

// `coverages` and `isMobile` are passed by AppShell but not needed here:
// the caller's coverages are loaded server-side in /api/search and the layout
// is responsive without needing the prop.
interface SearchViewProps {
  coverages: Coverage[];
  isMobile?: boolean;
  // Pre-fills the input and runs the search once when set; used by the
  // first-run nudge. AppShell clears it after consumption so re-mounts
  // don't replay the search.
  initialQuery?: string | null;
  onInitialQueryConsumed?: () => void;
}

const SUGGESTIONS = [
  'Am I covered for travel cancellation?',
  'My laptop screen cracked',
  'A pipe burst at home',
  'I need a knee MRI',
  'I was in a car accident',
  'Client threatening lawsuit',
];

const FIELD_LABELS: Record<SearchMatch['citedField'], string> = {
  covered: 'Covered',
  exclusions: 'Exclusion',
  summary: 'Summary',
  type: 'Type',
  coverageLimit: 'Coverage limit',
  coInsurance: 'Co-insurance',
};

const RELEVANCE_LABEL: Record<SearchMatch['relevance'], string> = {
  high: 'High relevance',
  medium: 'Medium relevance',
  low: 'Low relevance',
};

const RELEVANCE_COLOR: Record<SearchMatch['relevance'], string> = {
  high: '#059669',
  medium: '#d97706',
  low: '#6b7280',
};

const RELEVANCE_BG: Record<SearchMatch['relevance'], string> = {
  high: '#ecfdf5',
  medium: '#fffbeb',
  low: '#f3f4f6',
};

export default function SearchView({ initialQuery, onInitialQueryConsumed }: SearchViewProps) {
  const [query, setQuery] = useState(() => initialQuery ?? '');
  const [results, setResults] = useState<SearchMatch[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const initialRan = useRef(false);

  const runSearch = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setSearched(true);
    setLoading(true);
    setLastQuery(trimmed);
    try {
      const data = await apiFetch<{ matches: SearchMatch[]; error?: string }>(
        '/api/search',
        { method: 'POST', json: { query: trimmed } }
      );
      setResults(data.matches);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        console.error('search request failed', err);
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRan.current) return;
    if (!initialQuery) return;
    initialRan.current = true;
    // Defer so the synchronous setState calls inside runSearch don't run
    // during this effect (React 19 lints that as a cascading render).
    queueMicrotask(() => {
      void runSearch(initialQuery);
    });
    onInitialQueryConsumed?.();
  }, [initialQuery, runSearch, onInitialQueryConsumed]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">What&apos;s Covered?</h1>
        <p className="text-sm text-gray-500 m-0">
          Describe what happened and we&apos;ll find every coverage source that applies.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) void runSearch(query);
          }}
          disabled={loading}
          placeholder="e.g. travel cancellation, laptop screen cracked, pipe burst..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
        />
        <button
          onClick={() => void runSearch(query)}
          disabled={loading}
          className="px-6 py-3 bg-gray-900 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {!searched && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Try asking about:</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  void runSearch(s);
                }}
                className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && loading && (
        <div className="flex items-center gap-3 py-6 text-sm text-gray-600" role="status" aria-live="polite">
          <span
            className="inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"
            aria-hidden
          />
          Searching your coverage…
        </div>
      )}

      {searched && !loading && results && (
        <div>
          {results.length === 0 ? (
            <EmptyState query={lastQuery} />
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-gray-900">
                {results.length} coverage source{results.length !== 1 ? 's' : ''} found:
              </div>
              {results.map((m, i) => (
                <ResultCard key={`${m.coverageId}-${i}`} match={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCard({ match }: { match: SearchMatch }) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-5"
      style={{ borderLeft: `4px solid ${RELEVANCE_COLOR[match.relevance]}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{match.provider}</div>
          <div className="text-xs text-gray-500">{match.type}</div>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: RELEVANCE_COLOR[match.relevance],
            background: RELEVANCE_BG[match.relevance],
          }}
        >
          {RELEVANCE_LABEL[match.relevance]}
        </span>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed mb-3">{match.explanation}</div>
      <blockquote className="text-xs text-gray-700 bg-gray-50 border-l-4 border-gray-300 px-3 py-2 mb-3 rounded-r-md">
        <span className="font-semibold text-gray-900">{FIELD_LABELS[match.citedField]}:</span>{' '}
        {match.citedValue}
      </blockquote>
      <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
        <span className="font-semibold">Coordination:</span> {match.coordination}
      </div>
    </div>
  );
}

function EmptyState({ query }: { query: string }) {
  const mailto =
    'mailto:feedback@benefitly.app?subject=Search%20miss&body=Query%3A%20' +
    encodeURIComponent(query);
  return (
    <div className="text-sm text-gray-700 leading-relaxed py-8 max-w-xl">
      <p className="mb-3">
        <span className="font-semibold text-gray-900">No matching coverage in your account.</span>{' '}
        Here&apos;s what you&apos;d typically need for that situation: travel insurance, home
        contents/buildings, a private medical plan, or an extended-warranty / Section 75 credit
        card — depending on the incident.
      </p>
      <p>
        <a href={mailto} className="text-blue-600 hover:underline">
          Couldn&apos;t answer this? Tell us what you expected →
        </a>
      </p>
    </div>
  );
}

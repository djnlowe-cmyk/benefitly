'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Coverage, SearchMatch, SearchResponse, SearchGapAnswer } from '@/types/coverage';
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

type ViewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'success';
      results: SearchMatch[];
      gapAnswer?: SearchGapAnswer;
    }
  | { kind: 'error' };

export default function SearchView({ initialQuery, onInitialQueryConsumed }: SearchViewProps) {
  const [query, setQuery] = useState(() => initialQuery ?? '');
  const [view, setView] = useState<ViewState>({ kind: 'idle' });
  const [lastQuery, setLastQuery] = useState('');
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const initialRan = useRef(false);

  const runSearch = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setLastQuery(trimmed);
    setView({ kind: 'loading' });
    try {
      const data = await apiFetch<SearchResponse>('/api/search', {
        method: 'POST',
        json: { query: trimmed },
      });
      setView({
        kind: 'success',
        results: data.results,
        gapAnswer: data.gapAnswer,
      });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        console.error('search request failed', err);
      }
      setView({ kind: 'error' });
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

  const loading = view.kind === 'loading';
  const showConciergeFooter =
    view.kind === 'success' || view.kind === 'error';

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

      {view.kind === 'idle' && (
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

      {view.kind === 'loading' && (
        <div
          className="flex items-center gap-3 py-6 text-sm text-gray-600"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"
            aria-hidden
          />
          Searching your coverage…
        </div>
      )}

      {view.kind === 'success' && view.results.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-semibold text-gray-900">
            {view.results.length} coverage source{view.results.length !== 1 ? 's' : ''} found:
          </div>
          {view.results.map((m, i) => (
            <ResultCard key={`${m.coverageId}-${i}`} match={m} />
          ))}
        </div>
      )}

      {view.kind === 'success' && view.results.length === 0 && (
        <GapState query={lastQuery} gapAnswer={view.gapAnswer} />
      )}

      {view.kind === 'error' && <ErrorState />}

      {showConciergeFooter && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={() => setConciergeOpen(true)}
            className="text-sm text-blue-600 hover:underline cursor-pointer"
          >
            Couldn&apos;t answer this — tell us what you expected →
          </button>
        </div>
      )}

      {conciergeOpen && (
        <ConciergeModal
          query={lastQuery}
          onClose={() => setConciergeOpen(false)}
        />
      )}
    </div>
  );
}

function ResultCard({ match }: { match: SearchMatch }) {
  // Source-document link uses Document.id where present. P1.3 (ALI-48) will
  // ship a richer viewer; for now we point at /api/documents/{id}/source as a
  // download fallback. When the link can't be built we hide the row instead of
  // rendering a dead link.
  const sourceHref = match.sourceDocumentId
    ? `/api/documents/${match.sourceDocumentId}/source`
    : null;

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
        <span className="font-semibold text-gray-900">{match.citedField}:</span>{' '}
        “{match.citedExcerpt}”
      </blockquote>
      {match.coordination && (
        <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md mb-3">
          <span className="font-semibold">Coordination:</span> {match.coordination}
        </div>
      )}
      {sourceHref && (
        <a
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          View source document →
        </a>
      )}
    </div>
  );
}

function GapState({
  query,
  gapAnswer,
}: {
  query: string;
  gapAnswer?: SearchGapAnswer;
}) {
  if (!gapAnswer) {
    return (
      <div className="text-sm text-gray-700 leading-relaxed py-8 max-w-xl">
        <p>
          <span className="font-semibold text-gray-900">
            No matching coverage in your account
          </span>{' '}
          for &ldquo;{query}&rdquo;. Use the link below to tell us what you expected.
        </p>
      </div>
    );
  }
  return (
    <div className="text-sm text-gray-700 leading-relaxed py-6 max-w-xl">
      <p className="mb-4 text-gray-900">{gapAnswer.explanation}</p>
      {gapAnswer.recommendedTypes.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            You&apos;d typically need:
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {gapAnswer.recommendedTypes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="text-sm text-gray-700 leading-relaxed py-6 max-w-xl">
      <p className="mb-2 font-semibold text-gray-900">Search is temporarily unavailable.</p>
      <p>
        Try again in a moment, or use the concierge link below if you need an answer right now.
      </p>
    </div>
  );
}

function ConciergeModal({ query, onClose }: { query: string; onClose: () => void }) {
  const [expectedAnswer, setExpectedAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/search/concierge', {
        method: 'POST',
        json: { query, expectedAnswer: expectedAnswer.trim() || undefined },
      });
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not send right now';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [expectedAnswer, query]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Concierge feedback"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Thanks — we&apos;ll follow up.
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              We&apos;ll review your question and respond by email if we can find a coverage you missed.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              Tell us what you expected
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Question: &ldquo;{query}&rdquo;
            </p>
            <textarea
              value={expectedAnswer}
              onChange={(e) => setExpectedAnswer(e.target.value)}
              disabled={submitting}
              placeholder="Optional — what answer did you hope to see?"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
            {error && (
              <p className="text-xs text-red-600 mt-2" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

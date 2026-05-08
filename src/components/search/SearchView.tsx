'use client';

import { useState, useCallback } from 'react';
import { Coverage, SearchResult } from '@/types/coverage';
import { CATEGORIES, STATUS_STYLES } from '@/data/categories';
import { SEARCH_SCENARIOS } from '@/data/seed';

interface SearchViewProps {
  coverages: Coverage[];
  isMobile?: boolean;
}

type ScenarioEntry = {
  policyNo: string;
  relevance: 'high' | 'medium' | 'low';
  explanation: string;
  coordination: string;
};

function findScenarioMatch(query: string): ScenarioEntry[] | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const words = q.split(/\s+/);
  let bestMatch: ScenarioEntry[] | null = null;
  let bestScore = 0;
  Object.entries(SEARCH_SCENARIOS).forEach(([key, val]) => {
    const keyWords = key.split(/\s+/);
    const score = words.filter((w) => keyWords.some((kw) => kw.includes(w) || w.includes(kw))).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = val;
    }
  });
  return bestScore > 0 ? bestMatch : null;
}

export default function SearchView({ coverages }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(SearchResult & { coverage?: Coverage })[] | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(
    (raw: string) => {
      setSearched(true);
      const match = findScenarioMatch(raw);
      if (!match) {
        setResults([]);
        return;
      }
      setResults(
        match.map((r) => ({
          policyNo: r.policyNo,
          relevance: r.relevance,
          explanation: r.explanation,
          coordination: r.coordination,
          coverage: coverages.find((c) => c.policyNo === r.policyNo),
        }))
      );
    },
    [coverages]
  );

  const suggestions = [
    'My laptop screen cracked',
    'My flight was cancelled',
    'A pipe burst in my house',
    'I need a knee MRI',
    'I was in a car accident',
    'Client threatening lawsuit',
  ];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">What&apos;s Covered?</h1>
        <p className="text-sm text-gray-500 m-0">
          Describe what happened and we&apos;ll find every coverage source that applies.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
          placeholder="e.g. My laptop screen cracked, flight cancelled, pipe burst..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => runSearch(query)}
          className="px-6 py-3 bg-gray-900 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-800"
        >
          Search
        </button>
      </div>

      {/* Suggestions */}
      {!searched && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Try asking about:</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  runSearch(s);
                }}
                className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-700 cursor-pointer hover:bg-gray-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && results && (
        <div>
          {results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">⌕</div>
              <div className="text-base font-medium">No matching coverage found</div>
              <div className="text-sm mt-1">Try describing your situation differently.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-gray-900">
                {results.length} coverage source{results.length !== 1 ? 's' : ''} found:
              </div>
              {results.map((r, i) => {
                if (!r.coverage) {
                  return (
                    <div
                      key={i}
                      className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-600"
                      style={{ borderLeft: '4px solid #9ca3af' }}
                    >
                      <div className="font-semibold text-gray-900 mb-1">
                        Suggested coverage not in your dashboard
                      </div>
                      <div className="text-xs text-gray-500 mb-2">Reference policy: {r.policyNo}</div>
                      <div className="leading-relaxed">{r.explanation}</div>
                    </div>
                  );
                }
                const cat = CATEGORIES[r.coverage.category];
                const st = STATUS_STYLES[r.coverage.status];
                return (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-lg p-5"
                    style={{ borderLeft: `4px solid ${r.relevance === 'high' ? '#059669' : '#d97706'}` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-base font-bold"
                          style={{ background: cat.bg, color: cat.color }}
                        >
                          {cat.icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{r.coverage.provider}</div>
                          <div className="text-xs text-gray-500">{r.coverage.type}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: r.relevance === 'high' ? '#059669' : '#d97706',
                            background: r.relevance === 'high' ? '#ecfdf5' : '#fffbeb',
                          }}
                        >
                          {r.relevance === 'high' ? 'High relevance' : 'Medium relevance'}
                        </span>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: st.color, background: st.bg }}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 leading-relaxed mb-3">{r.explanation}</div>
                    <div className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-md">
                      <span className="font-semibold">Coordination:</span> {r.coordination}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Gap, GapEvaluationCounters, GapSeverity } from '@/types/coverage';
import { apiFetch } from '@/lib/api';

interface GapAnalysisCardProps {
  coverageId: string;
  gaps: Gap[];
  counters?: GapEvaluationCounters | null;
  onDismissed: (gapKey: string) => void;
}

const SEVERITY_STYLES: Record<GapSeverity, { color: string; bg: string; border: string; label: string }> = {
  high:   { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'High' },
  medium: { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Medium' },
  low:    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', label: 'Low' },
};

function GapRow({
  coverageId,
  gap,
  onDismissed,
}: {
  coverageId: string;
  gap: Gap;
  onDismissed: (gapKey: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sev = SEVERITY_STYLES[gap.severity];

  const dismiss = async (reason: 'have_elsewhere' | 'not_relevant') => {
    setMenuOpen(false);
    setDismissing(true);
    setError(null);
    try {
      await apiFetch(
        `/api/coverages/${encodeURIComponent(coverageId)}/gaps/${encodeURIComponent(gap.key)}/dismiss`,
        { method: 'POST', json: { reason } },
      );
      onDismissed(gap.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to dismiss');
      setDismissing(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-md p-3.5 mb-2.5 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
              style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}
            >
              {sev.label}
            </span>
            <h4 className="text-sm font-semibold text-gray-900 m-0">{gap.title}</h4>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[12px] text-gray-500 bg-transparent border-none cursor-pointer p-0 hover:text-gray-700"
            aria-expanded={expanded}
            aria-controls={`gap-rationale-${gap.key}`}
          >
            {expanded ? 'Hide why' : 'Why we flagged this'}
          </button>
          {expanded && (
            <p
              id={`gap-rationale-${gap.key}`}
              className="text-[13px] text-gray-700 leading-relaxed mt-2 mb-0"
            >
              {gap.rationale}
            </p>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={dismissing}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none p-1 cursor-pointer text-base disabled:opacity-50"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-7 z-10 bg-white border border-gray-200 rounded-md shadow-md min-w-[180px] py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => dismiss('have_elsewhere')}
                className="w-full text-left text-[13px] px-3 py-2 text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer"
              >
                I have this elsewhere
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => dismiss('not_relevant')}
                className="w-full text-left text-[13px] px-3 py-2 text-gray-700 hover:bg-gray-50 bg-transparent border-none cursor-pointer"
              >
                Not relevant to me
              </button>
            </div>
          )}
        </div>
      </div>
      {gap.action && (
        <div className="mt-2.5">
          <a
            href={gap.action.target}
            className="inline-block text-[12px] font-semibold text-gray-700 px-2.5 py-1 border border-gray-200 rounded-md hover:bg-gray-50 no-underline"
          >
            {gap.action.label}
          </a>
        </div>
      )}
      {error && <div className="text-[12px] text-red-600 mt-2">{error}</div>}
    </div>
  );
}

export default function GapAnalysisCard({
  coverageId,
  gaps,
  counters,
  onDismissed,
}: GapAnalysisCardProps) {
  if (gaps.length === 0) {
    const checked = counters
      ? `We checked ${counters.exclusionsChecked} exclusions, ${counters.limitsChecked} limits, and ${counters.pairedCategoriesChecked} related categories.`
      : 'We checked your exclusions, limits, and related categories.';
    return (
      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-emerald-900 m-0 mb-1">No gaps detected</h3>
        <p className="text-[13px] text-emerald-800 m-0">{checked}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="text-sm font-bold text-gray-900 m-0 mb-1">Coverage gaps</h3>
      <p className="text-[12px] text-gray-500 m-0 mb-3.5">
        Conservative checks based on this policy and your other active cover. Dismiss any that don&apos;t apply.
      </p>
      <div>
        {gaps.map((gap) => (
          <GapRow
            key={gap.key}
            coverageId={coverageId}
            gap={gap}
            onDismissed={onDismissed}
          />
        ))}
      </div>
    </div>
  );
}

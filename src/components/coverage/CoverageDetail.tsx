'use client';

import { useEffect, useState } from 'react';
import { Coverage, Gap, GapEvaluationCounters } from '@/types/coverage';
import { CATEGORIES, STATUS_STYLES } from '@/data/categories';
import { formatCurrency, formatDate } from '@/lib/format';
import { apiFetch } from '@/lib/api';
import GapAnalysisCard from './GapAnalysisCard';

interface CoverageDetailProps {
  coverage: Coverage;
  onBack: () => void;
  onDelete?: (id: string) => void;
  isMobile?: boolean;
}

interface CoverageWithGaps extends Coverage {
  gaps: Gap[];
  gapsChecked: GapEvaluationCounters;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mb-3.5">
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

interface GapState {
  coverageId: string;
  gaps: Gap[];
  counters: GapEvaluationCounters | null;
  error: string | null;
}

export default function CoverageDetail({ coverage, onBack, onDelete, isMobile = false }: CoverageDetailProps) {
  const cat = CATEGORIES[coverage.category];
  const st = STATUS_STYLES[coverage.status];

  const [gapState, setGapState] = useState<GapState | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    apiFetch<CoverageWithGaps>(`/api/coverages/${encodeURIComponent(coverage.id)}`, {
      signal: ctrl.signal,
    })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setGapState({
          coverageId: coverage.id,
          gaps: data.gaps ?? [],
          counters: data.gapsChecked ?? null,
          error: null,
        });
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setGapState({
          coverageId: coverage.id,
          gaps: [],
          counters: null,
          error: e instanceof Error ? e.message : 'Failed to load gaps',
        });
      });
    return () => ctrl.abort();
  }, [coverage.id]);

  const isFresh = gapState?.coverageId === coverage.id;
  const gapsLoading = !isFresh;
  const gapsError = isFresh ? gapState!.error : null;
  const gaps = isFresh ? gapState!.gaps : null;
  const counters = isFresh ? gapState!.counters : null;

  const handleDismissed = (gapKey: string) => {
    setGapState((prev) =>
      prev && prev.coverageId === coverage.id
        ? { ...prev, gaps: prev.gaps.filter((g) => g.key !== gapKey) }
        : prev,
    );
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="bg-transparent border-none cursor-pointer text-gray-500 text-[13px] p-0 mb-4 flex items-center gap-1 hover:text-gray-700"
      >
        ← Back
      </button>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-7 py-6 border-b-2" style={{ background: cat.bg, borderColor: `${cat.color}30` }}>
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: cat.color }}
              >
                {cat.label}
              </div>
              <h2 className="text-[22px] font-bold text-gray-900 m-0">{coverage.provider}</h2>
              <div className="text-sm text-gray-600 mt-0.5">{coverage.type}</div>
            </div>
            <span
              className="text-[13px] font-semibold bg-white px-3.5 py-1 rounded-2xl border"
              style={{ color: st.color, borderColor: `${st.color}40` }}
            >
              {st.label}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          <p className="text-sm text-gray-700 leading-relaxed m-0 mb-6 pb-5 border-b border-gray-100">
            {coverage.summary}
          </p>

          <div className={isMobile ? '' : 'grid grid-cols-2 gap-x-10'}>
            <div>
              <h3 className="text-[13px] font-bold text-gray-900 m-0 mb-3.5 uppercase tracking-wider">
                Policy Details
              </h3>
              <Field label="Policy Number" value={coverage.policyNo} />
              <Field label="Effective" value={`${formatDate(coverage.startDate)} → ${coverage.endDate === 'Ongoing' ? 'Ongoing' : formatDate(coverage.endDate)}`} />
              <Field label="Coverage Limit" value={coverage.coverageLimit} />
              <Field
                label="Excess"
                value={coverage.deductible != null ? formatCurrency(coverage.deductible) : undefined}
              />
              {coverage.oopMax && (
                <Field label="Annual Limit" value={formatCurrency(coverage.oopMax)} />
              )}
              {coverage.coInsurance && <Field label="Co-Insurance" value={coverage.coInsurance} />}
              <Field
                label="Monthly Premium"
                value={coverage.premium > 0 ? `${formatCurrency(coverage.premium)}/month` : 'Included'}
              />
            </div>
            <div className={isMobile ? 'mt-5' : ''}>
              <h3 className="text-[13px] font-bold text-gray-900 m-0 mb-3.5 uppercase tracking-wider">
                Covered
              </h3>
              {coverage.covered.map((c, i) => (
                <div key={i} className="text-sm text-gray-700 py-1">
                  • {c}
                </div>
              ))}

              <h3 className="text-[13px] font-bold text-gray-900 m-0 mt-5 mb-3.5 uppercase tracking-wider">
                Exclusions
              </h3>
              {coverage.exclusions.map((e, i) => (
                <div key={i} className="text-[13px] text-red-600 py-0.5 flex items-start gap-1.5">
                  <span className="text-red-300">✕</span> {e}
                </div>
              ))}

              <h3 className="text-[13px] font-bold text-gray-900 m-0 mt-5 mb-3.5 uppercase tracking-wider">
                File a Claim
              </h3>
              <Field label="Phone" value={coverage.claimPhone} />
              <Field label="Online" value={coverage.claimUrl} />
            </div>
          </div>
        </div>
      </div>

      {gapsLoading && (
        <div className="mt-6 text-[13px] text-gray-500">Checking for coverage gaps…</div>
      )}
      {gapsError && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-3 text-[13px] text-red-700">
          Could not load gaps: {gapsError}
        </div>
      )}
      {!gapsLoading && !gapsError && gaps != null && (
        <GapAnalysisCard
          coverageId={coverage.id}
          gaps={gaps}
          counters={counters}
          onDismissed={handleDismissed}
        />
      )}

      {onDelete && (
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => {
              if (window.confirm(`Delete "${coverage.provider} — ${coverage.type}"? This cannot be undone.`)) {
                onDelete(coverage.id);
              }
            }}
            className="px-3.5 py-2 bg-white border border-red-200 rounded-md text-red-600 text-[13px] font-semibold cursor-pointer hover:bg-red-50"
          >
            Delete coverage
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { Coverage } from '@/types/coverage';
import { CATEGORIES, STATUS_STYLES } from '@/data/categories';

interface CoverageDetailProps {
  coverage: Coverage;
  onBack: () => void;
  onDelete?: (id: number) => void;
  isMobile?: boolean;
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

export default function CoverageDetail({ coverage, onBack, onDelete, isMobile = false }: CoverageDetailProps) {
  const cat = CATEGORIES[coverage.category];
  const st = STATUS_STYLES[coverage.status];

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
              <Field label="Effective" value={`${coverage.startDate} → ${coverage.endDate}`} />
              <Field label="Coverage Limit" value={coverage.limit} />
              <Field
                label="Deductible"
                value={coverage.deductible != null ? `$${coverage.deductible.toLocaleString()}` : undefined}
              />
              {coverage.oopMax && (
                <Field label="Out-of-Pocket Max" value={`$${coverage.oopMax.toLocaleString()}`} />
              )}
              {coverage.coInsurance && <Field label="Co-Insurance" value={coverage.coInsurance} />}
              <Field
                label="Monthly Premium"
                value={coverage.premium > 0 ? `$${coverage.premium}/month` : 'Included'}
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

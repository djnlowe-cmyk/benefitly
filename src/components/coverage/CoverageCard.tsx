'use client';

import { Coverage } from '@/types/coverage';
import { CATEGORIES, STATUS_STYLES } from '@/data/categories';
import { formatCurrency } from '@/lib/format';

interface CoverageCardProps {
  coverage: Coverage;
  onClick: () => void;
}

export default function CoverageCard({ coverage, onClick }: CoverageCardProps) {
  const cat = CATEGORIES[coverage.category];
  const st = STATUS_STYLES[coverage.status];

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-0 cursor-pointer text-left w-full overflow-hidden transition-shadow hover:shadow-md hover:border-gray-300"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-base font-bold"
              style={{ background: cat.bg, color: cat.color }}
            >
              {cat.icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{coverage.provider}</div>
              <div className="text-xs text-gray-500">{coverage.type}</div>
            </div>
          </div>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: st.color, background: st.bg }}
          >
            {st.label}
          </span>
        </div>
        <div className="text-xs text-gray-600 leading-relaxed mb-2.5">{coverage.summary}</div>
        <div className="flex gap-4 text-[11px] text-gray-500">
          {coverage.deductible != null && (
            <div>
              <span className="font-semibold text-gray-700">{formatCurrency(coverage.deductible)}</span>{' '}
              excess
            </div>
          )}
          {coverage.premium > 0 && (
            <div>
              <span className="font-semibold text-gray-700">{formatCurrency(coverage.premium)}/mo</span>
            </div>
          )}
          <div className="ml-auto text-gray-400">{coverage.policyNo}</div>
        </div>
      </div>
    </button>
  );
}

'use client';

import { Coverage } from '@/types/coverage';
import { formatCurrency } from '@/lib/format';

interface OptimiserViewProps {
  coverages: Coverage[];
  isMobile?: boolean;
}

export default function OptimiserView({ coverages, isMobile = false }: OptimiserViewProps) {
  const totalPremium = coverages.reduce((s, c) => s + (c.premium || 0), 0);

  // Mock optimiser data
  const score = 72;
  const recommendations = [
    { type: 'redundancy', title: 'Potential overlap: travel coverage', detail: 'Your Aviva travel policy and Barclaycard Avios Plus both cover trip cancellation. If you always book travel on the Barclaycard, the standalone policy may be redundant — saving £149/trip.', savings: 149, priority: 'medium' as const },
    { type: 'gap', title: 'No flood insurance', detail: "Your Aviva home policy excludes escape-of-water from groundwater flooding. If your property is in an Environment Agency flood-risk zone, consider a separate flood add-on or specialist policy.", savings: 0, priority: 'high' as const },
    { type: 'payment', title: 'Use Section 75 protection on credit', detail: 'You spent £1,099 on electronics via debit last month. Paying with a credit card on purchases over £100 triggers Section 75 protection — at no extra cost.', savings: 0, priority: 'medium' as const },
    { type: 'benefit', title: 'Unused: rental car CDW', detail: "Your Barclaycard Avios Plus includes primary rental car CDW. You don't need to buy the rental company's collision damage waiver — decline it next time and save £12–£25/day.", savings: 160, priority: 'low' as const },
  ];

  const PRIORITY_STYLES = {
    high: { color: '#dc2626', bg: '#fef2f2' },
    medium: { color: '#d97706', bg: '#fffbeb' },
    low: { color: '#059669', bg: '#ecfdf5' },
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Coverage Optimiser</h1>
        <p className="text-sm text-gray-500 m-0">
          Reduce costs, close gaps, and maximise the benefits you&apos;re already paying for.
        </p>
      </div>

      {/* Score card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 text-center">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Optimisation Score</div>
        <div className="text-5xl font-bold text-gray-900">{score}</div>
        <div className="text-sm text-gray-500 mt-1">out of 100</div>
        <div className="w-full max-w-xs mx-auto h-3 bg-gray-100 rounded-full overflow-hidden mt-4">
          <div
            className="h-full rounded-full"
            style={{
              width: `${score}%`,
              background: score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626',
            }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-2">{formatCurrency(totalPremium)}/mo in premiums across {coverages.length} sources</div>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Recommendations</div>
        {recommendations.map((r, i) => {
          const ps = PRIORITY_STYLES[r.priority];
          return (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4" style={{ borderLeft: `4px solid ${ps.color}` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ color: ps.color, background: ps.bg }}>
                  {r.priority}
                </span>
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">{r.detail}</div>
              {r.savings > 0 && (
                <div className="text-xs text-green-700 mt-2 font-medium">Potential savings: {formatCurrency(r.savings)}/year</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

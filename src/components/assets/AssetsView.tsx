'use client';

import { Asset } from '@/types/coverage';

interface AssetsViewProps {
  assets: Asset[];
  isMobile?: boolean;
}

const RISK_COLORS = {
  low: { color: '#059669', bg: '#ecfdf5' },
  medium: { color: '#d97706', bg: '#fffbeb' },
  high: { color: '#dc2626', bg: '#fef2f2' },
};

export default function AssetsView({ assets, isMobile = false }: AssetsViewProps) {
  const totalValue = assets.reduce((s, a) => s + a.value, 0);
  const highRisk = assets.filter((a) => a.riskLevel === 'high').length;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Asset Registry</h1>
        <p className="text-sm text-gray-500 m-0">
          {assets.length} assets tracked · ${totalValue.toLocaleString()} total value
          {highRisk > 0 && ` · ${highRisk} need attention`}
        </p>
      </div>

      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}
      >
        {assets.map((a) => {
          const risk = RISK_COLORS[a.riskLevel];
          return (
            <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                  <div className="text-xs text-gray-500">{a.category}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">${a.value.toLocaleString()}</div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                    style={{ color: risk.color, background: risk.bg }}
                  >
                    {a.riskLevel} risk
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-2">
                {a.photos} photo{a.photos !== 1 ? 's' : ''} on file
                {a.lastPhotoUpdate && ` · Last updated ${a.lastPhotoUpdate}`}
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {a.coverages.map((c, i) => (
                  <span key={i} className="text-[11px] bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                    {c}
                  </span>
                ))}
              </div>

              {a.riskNote && (
                <div
                  className="text-xs px-2.5 py-1.5 rounded-md mt-1"
                  style={{ color: risk.color, background: risk.bg }}
                >
                  {a.riskNote}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

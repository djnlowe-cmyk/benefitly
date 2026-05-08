'use client';

import { useMemo } from 'react';
import { Coverage, CoverageCategory } from '@/types/coverage';
import { CATEGORIES } from '@/data/categories';
import { formatCurrency } from '@/lib/format';
import CoverageCard from '@/components/coverage/CoverageCard';

interface DashboardViewProps {
  coverages: Coverage[];
  onSelectCoverage: (coverage: Coverage) => void;
  isMobile?: boolean;
}

export default function DashboardView({ coverages, onSelectCoverage, isMobile = false }: DashboardViewProps) {
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CoverageCategory, number>> = {};
    coverages.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return counts;
  }, [coverages]);

  const totalPremium = coverages.reduce((s, c) => s + (c.premium || 0), 0);
  const activeCount = coverages.filter((c) => c.status === 'active').length;
  const expiringCount = coverages.filter((c) => c.status === 'expiring').length;

  const summaryCards = [
    { label: 'Total Sources', value: String(coverages.length), sub: 'across all categories' },
    { label: 'Active', value: String(activeCount), sub: 'currently in force', color: '#059669' },
    { label: 'Expiring Soon', value: String(expiringCount), sub: 'action needed', color: '#d97706' },
    { label: 'Monthly Premiums', value: formatCurrency(totalPremium), sub: 'combined total' },
  ];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Coverage Dashboard</h1>
        <p className="text-sm text-gray-500 m-0">Your complete coverage landscape at a glance.</p>
      </div>

      {/* Summary cards */}
      <div
        className="grid gap-3.5 mb-7"
        style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)' }}
      >
        {summaryCards.map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-4 py-4">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{s.label}</div>
            <div className="text-[26px] font-bold" style={{ color: s.color || '#111827' }}>
              {s.value}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Category pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(Object.entries(CATEGORIES) as [CoverageCategory, (typeof CATEGORIES)[CoverageCategory]][]).map(
          ([key, cat]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium border"
              style={{
                background: cat.bg,
                color: cat.color,
                borderColor: `${cat.color}20`,
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="font-bold">{categoryCounts[key] || 0}</span>
            </div>
          )
        )}
      </div>

      {/* Coverage cards grid */}
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}
      >
        {coverages.map((c) => (
          <CoverageCard key={c.id} coverage={c} onClick={() => onSelectCoverage(c)} />
        ))}
      </div>
    </div>
  );
}

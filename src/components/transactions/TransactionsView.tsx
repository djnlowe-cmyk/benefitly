'use client';

import { Transaction } from '@/types/coverage';

interface TransactionsViewProps {
  transactions: Transaction[];
  isMobile?: boolean;
}

const STATUS_COLORS = {
  covered: { color: '#059669', bg: '#ecfdf5', label: 'Covered' },
  partial: { color: '#d97706', bg: '#fffbeb', label: 'Partial' },
  uncovered: { color: '#dc2626', bg: '#fef2f2', label: 'Uncovered' },
};

export default function TransactionsView({ transactions, isMobile = false }: TransactionsViewProps) {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Transaction Coverage</h1>
        <p className="text-sm text-gray-500 m-0">See which purchases are protected — and which aren&apos;t.</p>
      </div>

      <div className="space-y-3">
        {transactions.map((t) => {
          const sc = STATUS_COLORS[t.coverageStatus];
          return (
            <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.merchant}</div>
                  <div className="text-xs text-gray-500">
                    {t.date} · {t.card}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">${t.amount.toLocaleString()}</div>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: sc.color, background: sc.bg }}
                  >
                    {sc.label}
                  </span>
                </div>
              </div>

              {t.benefits.length > 0 && (
                <div className="text-xs text-gray-600 mt-2">
                  {t.benefits.map((b, i) => (
                    <span key={i} className="inline-block bg-gray-100 rounded px-2 py-0.5 mr-1.5 mb-1">
                      {b}
                    </span>
                  ))}
                </div>
              )}

              {t.missedOpp && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  💡 {t.missedOpp}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { Coverage } from '@/types/coverage';
import { resolveCategory } from '@/data/categories';
import { formatDate } from '@/lib/format';

interface VaultViewProps {
  coverages: Coverage[];
  isMobile?: boolean;
}

export default function VaultView({ coverages, isMobile = false }: VaultViewProps) {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Document Vault</h1>
        <p className="text-sm text-gray-500 m-0">
          All your coverage documents in one searchable place. {coverages.length} documents stored.
        </p>
      </div>

      <div className="space-y-3">
        {coverages.map((c) => {
          const cat = resolveCategory(c.category);
          return (
            <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center text-lg font-bold shrink-0"
                style={{ background: cat.bg, color: cat.color }}
              >
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{c.provider}</div>
                <div className="text-xs text-gray-500">{c.type} · {c.policyNo}</div>
              </div>
              <div className="text-xs text-gray-400">{formatDate(c.startDate)}</div>
              <button className="text-xs text-blue-600 bg-transparent border-none cursor-pointer p-0 hover:underline shrink-0">
                View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

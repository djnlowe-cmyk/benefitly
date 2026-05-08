'use client';

import { CATEGORIES } from '@/data/categories';
import type { CoverageCategory } from '@/types/coverage';

// Day-1 categories — the policy types Benefitly's parser is reliable on for v1.
// Surfaced on the empty-state so a new user can see whether their documents fit
// before they upload.
const DAY_1_CATEGORIES: CoverageCategory[] = [
  'home',
  'auto',
  'travel',
  'health',
  'life',
  'creditcard',
];

interface EmptyDashboardProps {
  onUpload: () => void;
}

export default function EmptyDashboard({ onUpload }: EmptyDashboardProps) {
  return (
    <div className="max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Welcome to Benefitly</h1>
        <p className="text-sm text-gray-500 m-0">
          Benefitly reads your insurance and benefit documents so you can ask plain-English
          questions and get a clear answer about what&apos;s actually covered.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 m-0 mb-1">
          Start by uploading your first policy
        </h2>
        <p className="text-sm text-gray-600 m-0 mb-4">
          A PDF or photo of any policy document — home, motor, travel, private health, life, or a
          credit-card benefits summary. We&apos;ll read it and let you check what came through
          before saving.
        </p>
        <button
          onClick={onUpload}
          className="px-5 py-3 bg-gray-900 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-800"
        >
          Upload your first policy
        </button>
      </div>

      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Document types that work today
        </div>
        <div className="flex gap-2 flex-wrap">
          {DAY_1_CATEGORIES.map((key) => {
            const cat = CATEGORIES[key];
            return (
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

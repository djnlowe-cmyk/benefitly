'use client';

import { Claim } from '@/types/coverage';

interface ClaimsViewProps {
  claims: Claim[];
  isMobile?: boolean;
}

const CLAIM_STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  not_started: { color: '#6b7280', bg: '#f3f4f6', label: 'Not Started' },
  in_progress: { color: '#2563eb', bg: '#eff6ff', label: 'In Progress' },
  submitted: { color: '#7c3aed', bg: '#f5f3ff', label: 'Submitted' },
  approved: { color: '#059669', bg: '#ecfdf5', label: 'Approved' },
  denied: { color: '#dc2626', bg: '#fef2f2', label: 'Denied' },
  paid: { color: '#059669', bg: '#ecfdf5', label: 'Paid' },
};

export default function ClaimsView({ claims, isMobile = false }: ClaimsViewProps) {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Claims</h1>
        <p className="text-sm text-gray-500 m-0">Track your active and past claims.</p>
      </div>

      <div className="space-y-4">
        {claims.map((claim) => {
          const cs = CLAIM_STATUS_COLORS[claim.status] || CLAIM_STATUS_COLORS.not_started;
          const progress = Math.round((claim.step / claim.totalSteps) * 100);
          return (
            <div key={claim.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{claim.incident}</div>
                  <div className="text-xs text-gray-500">
                    {claim.date} · {claim.provider}
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: cs.color, background: cs.bg }}
                >
                  {cs.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                  <span>
                    Step {claim.step} of {claim.totalSteps}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: cs.color }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="flex gap-1 mb-3 flex-wrap">
                {claim.steps.map((step, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded"
                    style={{
                      background: i < claim.step ? cs.bg : '#f3f4f6',
                      color: i < claim.step ? cs.color : '#9ca3af',
                      fontWeight: i < claim.step ? 600 : 400,
                    }}
                  >
                    {step}
                  </span>
                ))}
              </div>

              <div className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
                <span className="font-medium">Next:</span> {claim.nextAction}
              </div>

              {claim.deadline && (
                <div className="text-xs text-amber-700 mt-2">Deadline: {claim.deadline}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

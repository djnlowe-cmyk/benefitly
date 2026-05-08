'use client';

interface EmptyDashboardProps {
  onUpload: () => void;
}

// Fresh-state dashboard per CPO copy doc on ALI-47.
// Single primary CTA — every other dashboard widget is hidden in this state
// to keep time-to-first-value as short as possible.
export default function EmptyDashboard({ onUpload }: EmptyDashboardProps) {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">
          Let&apos;s see what you&apos;re covered for.
        </h1>
        <p className="text-sm text-gray-500 m-0">
          Drop in a policy PDF and we&apos;ll pull out the cover details in about a minute.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-xl text-center">
        <button
          onClick={onUpload}
          className="px-6 py-3 bg-gray-900 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-800"
        >
          Upload your first policy
        </button>
        <div className="mt-4 text-xs text-gray-500">
          Your documents stay private to your account.
        </div>
      </div>
    </div>
  );
}

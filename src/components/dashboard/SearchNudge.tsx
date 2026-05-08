'use client';

interface SearchNudgeProps {
  example: string;
  onTry: () => void;
  onDismiss: () => void;
}

export default function SearchNudge({ example, onTry, onDismiss }: SearchNudgeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5 flex items-start gap-4"
    >
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-900 mb-1">Your first policy is in.</div>
        <div className="text-sm text-gray-700 mb-3">
          Now ask Benefitly a real question. Try:{' '}
          <span className="font-medium text-gray-900">&ldquo;{example}&rdquo;</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onTry}
            className="px-4 py-2 bg-gray-900 text-white border-none rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-800"
          >
            Try this question
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-gray-400 hover:text-gray-600 text-sm cursor-pointer bg-transparent border-none p-1"
      >
        ✕
      </button>
    </div>
  );
}

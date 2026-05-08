'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { apiFetch, ApiError } from '@/lib/api';

export default function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>('/api/account', { method: 'DELETE' });
      await signOut({ callbackUrl: '/login' });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not delete account. Please try again.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold cursor-pointer hover:bg-red-700"
      >
        Delete account
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete your account?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This is permanent and cannot be undone. All your coverages, documents, alerts, and account data will be erased.
            </p>
            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm cursor-pointer hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold cursor-pointer hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

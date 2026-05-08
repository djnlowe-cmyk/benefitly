'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export default function DeleteAccountButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setTyped('');
    setError(null);
  };

  const confirm = async () => {
    if (typed !== email || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) {
        let message = 'Delete failed.';
        try {
          const body = await res.json();
          if (body && typeof body.error === 'string') message = body.error;
        } catch {
          // ignore parse failure, keep default message
        }
        setError(message);
        setSubmitting(false);
        return;
      }
      await signOut({ callbackUrl: '/login' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 cursor-pointer"
      >
        Delete my account…
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-account-title" className="text-lg font-semibold text-gray-900 mb-2">
              Delete account
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              This permanently deletes your account, all uploaded documents, coverage records, alerts, family
              members, transactions, assets, and claims. This cannot be undone.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type your email to confirm: <span className="font-mono text-gray-900">{email}</span>
            </label>
            <input
              type="email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-3"
            />
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-700 mb-3">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={typed !== email || submitting}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

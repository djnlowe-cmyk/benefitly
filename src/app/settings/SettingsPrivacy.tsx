'use client';

import { useState } from 'react';

export default function SettingsPrivacy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/export', { method: 'GET' });
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const minutes = retryAfter ? Math.ceil(Number(retryAfter) / 60) : 60;
        setError(
          `You can only export once per hour. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        );
        return;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        setError(`Export failed (HTTP ${res.status}). ${detail}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benefitly-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Privacy</h2>
      <p className="text-sm text-gray-600 mb-4">
        Download a ZIP containing every piece of data Benefitly holds about your
        account. Includes your coverages, alerts, transactions, assets, claims,
        family members, and uploaded documents (with the original files).
      </p>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="rounded-md bg-gray-900 text-white text-sm font-medium px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Preparing your export…' : 'Download my data'}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          Limited to one export per hour per account.
        </p>
      )}
    </section>
  );
}

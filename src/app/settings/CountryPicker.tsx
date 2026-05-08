'use client';

import { useState } from 'react';

const COUNTRY_OPTIONS: { code: string; label: string; currency: string; enabled: boolean }[] = [
  { code: 'GB', label: 'United Kingdom', currency: 'GBP', enabled: true },
  { code: 'US', label: 'United States', currency: 'USD', enabled: false },
  { code: 'CA', label: 'Canada', currency: 'CAD', enabled: false },
  { code: 'IE', label: 'Ireland', currency: 'EUR', enabled: false },
  { code: 'FR', label: 'France', currency: 'EUR', enabled: false },
  { code: 'DE', label: 'Germany', currency: 'EUR', enabled: false },
  { code: 'ES', label: 'Spain', currency: 'EUR', enabled: false },
  { code: 'NL', label: 'Netherlands', currency: 'EUR', enabled: false },
];

interface CountryPickerProps {
  initialCountry: string;
  initialCurrency: string;
}

export default function CountryPicker({ initialCountry, initialCurrency }: CountryPickerProps) {
  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState(initialCurrency);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (code: string, enabled: boolean) => {
    if (!enabled || code === country || saving) return;
    setSaving(true);
    setStatus('idle');
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Could not save country');
      }
      const updated = (await res.json()) as { country: string; currency: string };
      setCountry(updated.country);
      setCurrency(updated.currency);
      setStatus('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save country');
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium">Country</label>
        <span className="text-xs text-gray-500">Current: {country} · {currency}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {COUNTRY_OPTIONS.map((opt) => {
          const selected = opt.code === country;
          return (
            <button
              key={opt.code}
              type="button"
              disabled={!opt.enabled || saving}
              onClick={() => handleSelect(opt.code, opt.enabled)}
              title={opt.enabled ? `Switch to ${opt.label}` : `${opt.label} — coming soon`}
              className={[
                'text-left border rounded-md px-3 py-2 text-sm transition-colors',
                selected
                  ? 'bg-gray-900 text-white border-gray-900'
                  : opt.enabled
                  ? 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50 cursor-pointer'
                  : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{opt.label}</span>
                <span className={selected ? 'text-gray-200 text-[11px]' : 'text-gray-400 text-[11px]'}>
                  {opt.currency}
                </span>
              </div>
              {!opt.enabled && (
                <div className="text-[11px] text-gray-400 mt-0.5">Coming soon</div>
              )}
            </button>
          );
        })}
      </div>
      {status === 'saved' && (
        <div className="text-xs text-green-700 mt-3">Saved.</div>
      )}
      {status === 'error' && error && (
        <div className="text-xs text-red-600 mt-3">{error}</div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Coverage,
  CoverageCategory,
  CoverageDetailResponse,
  CoverageDocument,
} from '@/types/coverage';
import { CATEGORIES, STATUS_STYLES } from '@/data/categories';
import { formatCurrency, formatDate } from '@/lib/format';
import { apiFetch, ApiError } from '@/lib/api';

interface CoverageDetailProps {
  coverage: Coverage;
  onBack: () => void;
  onDelete?: (id: string) => void;
  onUpdate?: (coverage: Coverage) => void;
  isMobile?: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const ALL_CATEGORY_KEYS = Object.keys(CATEGORIES) as CoverageCategory[];

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="mb-3.5">
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

interface EditableFields {
  provider: string;
  type: string;
  category: CoverageCategory;
  policyNo: string;
  covered: string[];
  startDate: string;
  endDate: string;
  premium: number;
  deductible: number | null;
  oopMax: number | null;
  coverageLimit: string;
  coInsurance: string | null;
  exclusions: string[];
  claimPhone: string;
  claimUrl: string;
  summary: string;
}

function fieldsFromCoverage(c: Coverage): EditableFields {
  return {
    provider: c.provider,
    type: c.type,
    category: c.category,
    policyNo: c.policyNo ?? '',
    covered: c.covered ?? [],
    startDate: c.startDate,
    endDate: c.endDate,
    premium: c.premium ?? 0,
    deductible: c.deductible,
    oopMax: c.oopMax,
    coverageLimit: c.coverageLimit ?? '',
    coInsurance: c.coInsurance,
    exclusions: c.exclusions ?? [],
    claimPhone: c.claimPhone ?? '',
    claimUrl: c.claimUrl ?? '',
    summary: c.summary ?? '',
  };
}

function payloadFromFields(f: EditableFields) {
  return {
    provider: f.provider,
    type: f.type,
    category: f.category,
    policyNo: f.policyNo || null,
    covered: f.covered,
    startDate: f.startDate,
    endDate: f.endDate,
    premium: f.premium,
    deductible: f.deductible,
    oopMax: f.oopMax,
    coverageLimit: f.coverageLimit || null,
    coInsurance: f.coInsurance,
    exclusions: f.exclusions,
    claimPhone: f.claimPhone || null,
    claimUrl: f.claimUrl || null,
    summary: f.summary || null,
  };
}

export default function CoverageDetail({
  coverage,
  onBack,
  onDelete,
  onUpdate,
  isMobile = false,
}: CoverageDetailProps) {
  const [current, setCurrent] = useState<Coverage>(coverage);
  const [document, setDocument] = useState<CoverageDocument | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Refresh from the server once on mount so the UI gets the document join,
  // any fields that changed since the list fetch, and the confidence value.
  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      try {
        const data = await apiFetch<CoverageDetailResponse>(
          `/api/coverages/${encodeURIComponent(coverage.id)}`,
          { signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        const { document: doc, ...rest } = data;
        setCurrent(rest as Coverage);
        setDocument(doc);
        setRefreshError(null);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        // Non-fatal: the detail view falls back to the seeded coverage from
        // the dashboard list, just without the document join or freshest fields.
        setRefreshError(e instanceof Error ? e.message : 'Could not refresh');
      }
    })();
    return () => ctrl.abort();
  }, [coverage.id]);

  const cat = CATEGORIES[current.category];
  const st = STATUS_STYLES[current.status];
  const lowConfidence =
    current.confidence != null && current.confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div>
      <button
        onClick={onBack}
        className="bg-transparent border-none cursor-pointer text-gray-500 text-[13px] p-0 mb-4 flex items-center gap-1 hover:text-gray-700"
      >
        ← Back
      </button>

      {refreshError && (
        <div role="alert" className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3 py-2 text-xs">
          Couldn&apos;t refresh from server — showing the last loaded version. ({refreshError})
        </div>
      )}

      {lowConfidence && !editing && (
        <div role="alert" className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-4 py-3 text-sm">
          <div className="font-semibold mb-1">Needs review</div>
          <div className="text-xs">
            Some fields were extracted with low confidence ({Math.round((current.confidence ?? 0) * 100)}%).
            Open the original document and double-check before relying on these values.
          </div>
        </div>
      )}

      {editing ? (
        <EditCard
          coverage={current}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setCurrent(updated);
            setEditing(false);
            onUpdate?.(updated);
          }}
          isMobile={isMobile}
        />
      ) : (
        <ViewCard
          coverage={current}
          document={document}
          isMobile={isMobile}
          cat={cat}
          st={st}
          onEdit={() => setEditing(true)}
        />
      )}

      {!editing && <GapAnalysisCard />}

      {!editing && onDelete && (
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => {
              if (window.confirm(`Delete "${current.provider} — ${current.type}"? This cannot be undone.`)) {
                onDelete(current.id);
              }
            }}
            className="px-3.5 py-2 bg-white border border-red-200 rounded-md text-red-600 text-[13px] font-semibold cursor-pointer hover:bg-red-50"
          >
            Delete coverage
          </button>
        </div>
      )}
    </div>
  );
}

function ViewCard({
  coverage,
  document,
  isMobile,
  cat,
  st,
  onEdit,
}: {
  coverage: Coverage;
  document: CoverageDocument | null;
  isMobile: boolean;
  cat: { color: string; bg: string; label: string };
  st: { color: string; label: string };
  onEdit: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-7 py-6 border-b-2" style={{ background: cat.bg, borderColor: `${cat.color}30` }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: cat.color }}
            >
              {cat.label}
            </div>
            <h2 className="text-[22px] font-bold text-gray-900 m-0">{coverage.provider}</h2>
            <div className="text-sm text-gray-600 mt-0.5">{coverage.type}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[13px] font-semibold bg-white px-3.5 py-1 rounded-2xl border"
              style={{ color: st.color, borderColor: `${st.color}40` }}
            >
              {st.label}
            </span>
            <button
              onClick={onEdit}
              className="text-[13px] font-semibold bg-white px-3.5 py-1 rounded-2xl border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-7 py-6">
        {coverage.summary && (
          <p className="text-sm text-gray-700 leading-relaxed m-0 mb-6 pb-5 border-b border-gray-100">
            {coverage.summary}
          </p>
        )}

        <div className={isMobile ? '' : 'grid grid-cols-2 gap-x-10'}>
          <div>
            <h3 className="text-[13px] font-bold text-gray-900 m-0 mb-3.5 uppercase tracking-wider">
              Policy Details
            </h3>
            <Field label="Policy Number" value={coverage.policyNo} />
            <Field label="Effective" value={`${formatDate(coverage.startDate)} → ${coverage.endDate === 'Ongoing' ? 'Ongoing' : formatDate(coverage.endDate)}`} />
            <Field label="Coverage Limit" value={coverage.coverageLimit} />
            <Field
              label="Excess"
              value={coverage.deductible != null ? formatCurrency(coverage.deductible) : undefined}
            />
            {coverage.oopMax && (
              <Field label="Annual Limit" value={formatCurrency(coverage.oopMax)} />
            )}
            {coverage.coInsurance && <Field label="Co-Insurance" value={coverage.coInsurance} />}
            <Field
              label="Monthly Premium"
              value={coverage.premium > 0 ? `${formatCurrency(coverage.premium)}/month` : 'Included'}
            />

            {document && (
              <div className="mt-5">
                <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">
                  Original document
                </div>
                {document.url ? (
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {document.filename}
                  </a>
                ) : (
                  <div className="text-sm text-gray-700">
                    {document.filename}
                    <span className="text-xs text-gray-400 ml-2">(stored locally)</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={isMobile ? 'mt-5' : ''}>
            <h3 className="text-[13px] font-bold text-gray-900 m-0 mb-3.5 uppercase tracking-wider">
              Covered
            </h3>
            {coverage.covered.map((c, i) => (
              <div key={i} className="text-sm text-gray-700 py-1">
                • {c}
              </div>
            ))}

            <h3 className="text-[13px] font-bold text-gray-900 m-0 mt-5 mb-3.5 uppercase tracking-wider">
              Exclusions
            </h3>
            {coverage.exclusions.map((e, i) => (
              <div key={i} className="text-[13px] text-red-600 py-0.5 flex items-start gap-1.5">
                <span className="text-red-300">✕</span> {e}
              </div>
            ))}

            <h3 className="text-[13px] font-bold text-gray-900 m-0 mt-5 mb-3.5 uppercase tracking-wider">
              File a Claim
            </h3>
            <Field label="Phone" value={coverage.claimPhone} />
            <Field label="Online" value={coverage.claimUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GapAnalysisCard() {
  return (
    <div className="mt-5 bg-white border border-gray-200 border-dashed rounded-lg px-5 py-4">
      <div className="text-sm font-semibold text-gray-900 mb-1">Coverage gap analysis</div>
      <div className="text-xs text-gray-500">
        Coming soon — we&apos;ll surface the gaps in this policy and where your other coverages step in.
      </div>
    </div>
  );
}

function EditCard({
  coverage,
  onCancel,
  onSaved,
  isMobile,
}: {
  coverage: Coverage;
  onCancel: () => void;
  onSaved: (updated: Coverage) => void;
  isMobile: boolean;
}) {
  const [fields, setFields] = useState<EditableFields>(() => fieldsFromCoverage(coverage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const canSave =
    !!fields.provider && !!fields.type && !!fields.startDate && !!fields.endDate && !saving;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Coverage>(
        `/api/coverages/${encodeURIComponent(coverage.id)}`,
        { method: 'PATCH', json: payloadFromFields(fields) },
      );
      onSaved(updated);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to save changes';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [coverage.id, fields, onSaved]);

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="text-sm font-semibold text-gray-900 mb-4">Edit coverage</div>

      {error && (
        <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-4`}>
        <EditField label="Provider" required>
          <input
            className={inputClass}
            value={fields.provider}
            onChange={(e) => patch('provider', e.target.value)}
          />
        </EditField>
        <EditField label="Coverage Type" required>
          <input
            className={inputClass}
            value={fields.type}
            onChange={(e) => patch('type', e.target.value)}
          />
        </EditField>
        <EditField label="Category">
          <select
            className={inputClass}
            value={fields.category}
            onChange={(e) => patch('category', e.target.value as CoverageCategory)}
          >
            {ALL_CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {CATEGORIES[key].label}
              </option>
            ))}
          </select>
        </EditField>
        <EditField label="Policy Number">
          <input
            className={inputClass}
            value={fields.policyNo}
            onChange={(e) => patch('policyNo', e.target.value)}
          />
        </EditField>
        <EditField label="Start Date" required>
          <input
            className={inputClass}
            type="date"
            value={fields.startDate}
            onChange={(e) => patch('startDate', e.target.value)}
          />
        </EditField>
        <EditField label="End Date" required>
          <input
            className={inputClass}
            value={fields.endDate}
            onChange={(e) => patch('endDate', e.target.value)}
            placeholder="YYYY-MM-DD or 'Ongoing'"
          />
        </EditField>
        <EditField label="Monthly Premium">
          <input
            className={inputClass}
            type="number"
            value={fields.premium || 0}
            onChange={(e) => patch('premium', Number(e.target.value) || 0)}
          />
        </EditField>
        <EditField label="Deductible">
          <input
            className={inputClass}
            type="number"
            value={fields.deductible ?? ''}
            onChange={(e) =>
              patch('deductible', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </EditField>
        <EditField label="OOP Max">
          <input
            className={inputClass}
            type="number"
            value={fields.oopMax ?? ''}
            onChange={(e) =>
              patch('oopMax', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </EditField>
        <EditField label="Co-insurance">
          <input
            className={inputClass}
            value={fields.coInsurance ?? ''}
            onChange={(e) =>
              patch('coInsurance', e.target.value === '' ? null : e.target.value)
            }
          />
        </EditField>
      </div>

      <EditField label="Coverage Limit">
        <input
          className={inputClass}
          value={fields.coverageLimit}
          onChange={(e) => patch('coverageLimit', e.target.value)}
        />
      </EditField>

      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4 my-4`}>
        <EditField label="Covered (comma separated)">
          <input
            className={inputClass}
            value={fields.covered.join(', ')}
            onChange={(e) =>
              patch(
                'covered',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </EditField>
        <EditField label="Exclusions (comma separated)">
          <input
            className={inputClass}
            value={fields.exclusions.join(', ')}
            onChange={(e) =>
              patch(
                'exclusions',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </EditField>
        <EditField label="Claims Phone">
          <input
            className={inputClass}
            value={fields.claimPhone}
            onChange={(e) => patch('claimPhone', e.target.value)}
          />
        </EditField>
        <EditField label="Claims URL">
          <input
            className={inputClass}
            value={fields.claimUrl}
            onChange={(e) => patch('claimUrl', e.target.value)}
          />
        </EditField>
      </div>

      <EditField label="Summary">
        <textarea
          className={`${inputClass} h-20 resize-none`}
          value={fields.summary}
          onChange={(e) => patch('summary', e.target.value)}
        />
      </EditField>

      <div className="flex flex-wrap gap-3 justify-end mt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-6 py-2 bg-gray-900 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function EditField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

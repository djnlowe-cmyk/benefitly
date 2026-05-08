'use client';

import { useCallback, useRef, useState } from 'react';
import { Coverage, CoverageCategory } from '@/types/coverage';
import { CATEGORIES } from '@/data/categories';

interface DocumentUploadViewProps {
  onSaved: (coverage: Coverage) => void;
  onCancel: () => void;
}

type Stage = 'idle' | 'uploading' | 'parsing' | 'review' | 'saving' | 'error';

interface ReviewFields {
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

interface UploadCoverage {
  id: string;
  provider: string | null;
  type: string | null;
  category: string | null;
  policyNo: string | null;
  status: string;
  statusLabel: string;
  covered: string[];
  startDate: string;
  endDate: string;
  premium: number | null;
  deductible: number | null;
  oopMax: number | null;
  coverageLimit: string | null;
  coInsurance: string | null;
  exclusions: string[];
  claimPhone: string | null;
  claimUrl: string | null;
  summary: string | null;
  confidence: number | null;
  documentId: string | null;
}

interface UploadResponse {
  document: { id: string; filename: string };
  parsed: Record<string, unknown> | null;
  coverage: UploadCoverage | null;
  needsReview: boolean;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];
const MAX_BYTES = 25 * 1024 * 1024;
const ALL_CATEGORY_KEYS = Object.keys(CATEGORIES) as CoverageCategory[];

function emptyFields(): ReviewFields {
  return {
    provider: '',
    type: '',
    category: 'health',
    policyNo: '',
    covered: [],
    startDate: '',
    endDate: '',
    premium: 0,
    deductible: null,
    oopMax: null,
    coverageLimit: '',
    coInsurance: null,
    exclusions: [],
    claimPhone: '',
    claimUrl: '',
    summary: '',
  };
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function pickNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
function pickArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
}

function fieldsFromCoverage(c: UploadCoverage | null, parsed: Record<string, unknown> | null): ReviewFields {
  if (c) {
    const cat = pickString(c.category);
    return {
      provider: pickString(c.provider),
      type: pickString(c.type),
      category: (ALL_CATEGORY_KEYS as string[]).includes(cat) ? (cat as CoverageCategory) : 'health',
      policyNo: c.policyNo ?? '',
      covered: c.covered ?? [],
      startDate: c.startDate ?? '',
      endDate: c.endDate ?? '',
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
  if (parsed) {
    const cat = pickString(parsed.category);
    return {
      provider: pickString(parsed.provider),
      type: pickString(parsed.type),
      category: (ALL_CATEGORY_KEYS as string[]).includes(cat) ? (cat as CoverageCategory) : 'health',
      policyNo: pickString(parsed.policyNo),
      covered: pickArray(parsed.covered),
      startDate: pickString(parsed.startDate),
      endDate: pickString(parsed.endDate),
      premium: pickNumber(parsed.premium) ?? 0,
      deductible: pickNumber(parsed.deductible),
      oopMax: pickNumber(parsed.oopMax),
      coverageLimit: pickString(parsed.limit),
      coInsurance: pickString(parsed.coInsurance) || null,
      exclusions: pickArray(parsed.exclusions),
      claimPhone: pickString(parsed.claimPhone),
      claimUrl: pickString(parsed.claimUrl),
      summary: pickString(parsed.summary),
    };
  }
  return emptyFields();
}

export default function DocumentUploadView({ onSaved, onCancel }: DocumentUploadViewProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [coverageId, setCoverageId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [fields, setFields] = useState<ReviewFields>(emptyFields());
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage('idle');
    setError(null);
    setFile(null);
    setCoverageId(null);
    setDocumentId(null);
    setConfidence(null);
    setFields(emptyFields());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const startUpload = useCallback(async (selected: File) => {
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Unsupported file type. Upload a PDF, PNG, JPG, WEBP, or GIF.');
      setStage('error');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError(`File too large. Max ${MAX_BYTES / (1024 * 1024)} MB.`);
      setStage('error');
      return;
    }

    setFile(selected);
    setError(null);
    setStage('uploading');

    const body = new FormData();
    body.append('file', selected);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body });
      setStage('parsing');

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || `Upload failed (${res.status}).`);
        setStage('error');
        return;
      }

      const data: UploadResponse = await res.json();
      setDocumentId(data.document.id);
      setCoverageId(data.coverage?.id ?? null);
      setConfidence(data.coverage?.confidence ?? null);
      setFields(fieldsFromCoverage(data.coverage, data.parsed));

      if (!data.coverage && !data.parsed) {
        setError('AI parsing was unavailable — please fill in the fields manually.');
      }
      setStage('review');
    } catch (e) {
      console.error(e);
      setError('Network error during upload.');
      setStage('error');
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) startUpload(dropped);
    },
    [startUpload]
  );

  const handleSave = useCallback(async () => {
    setStage('saving');
    setError(null);

    try {
      // If the upload pipeline auto-created a draft coverage, PATCH it with the
      // user's reviewed values. Otherwise (parsing unavailable), POST a new one.
      let res: Response;
      const payload = {
        provider: fields.provider,
        type: fields.type,
        category: fields.category,
        policyNo: fields.policyNo || null,
        status: 'active',
        statusLabel: 'Active',
        covered: fields.covered,
        startDate: fields.startDate,
        endDate: fields.endDate,
        premium: fields.premium,
        deductible: fields.deductible,
        oopMax: fields.oopMax,
        coverageLimit: fields.coverageLimit || null,
        coInsurance: fields.coInsurance,
        exclusions: fields.exclusions,
        claimPhone: fields.claimPhone || null,
        claimUrl: fields.claimUrl || null,
        summary: fields.summary || null,
        confidence,
        documentId,
      };

      if (coverageId) {
        res = await fetch(`/api/coverages?id=${encodeURIComponent(coverageId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/coverages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || `Save failed (${res.status}).`);
        setStage('review');
        return;
      }

      const saved = await res.json();
      const coverage: Coverage = {
        id: saved.id,
        provider: saved.provider,
        type: saved.type,
        category: saved.category as CoverageCategory,
        policyNo: saved.policyNo ?? null,
        status: saved.status ?? 'active',
        statusLabel: saved.statusLabel ?? 'Active',
        covered: Array.isArray(saved.covered) ? saved.covered : [],
        startDate: saved.startDate ?? '',
        endDate: saved.endDate ?? '',
        premium: saved.premium ?? 0,
        deductible: saved.deductible ?? null,
        oopMax: saved.oopMax ?? null,
        coverageLimit: saved.coverageLimit ?? null,
        coInsurance: saved.coInsurance ?? null,
        exclusions: Array.isArray(saved.exclusions) ? saved.exclusions : [],
        claimPhone: saved.claimPhone ?? null,
        claimUrl: saved.claimUrl ?? null,
        summary: saved.summary ?? null,
      };
      onSaved(coverage);
    } catch (e) {
      console.error(e);
      setError('Network error while saving.');
      setStage('review');
    }
  }, [coverageId, confidence, documentId, fields, onSaved]);

  const handleDiscard = useCallback(async () => {
    if (coverageId) {
      try {
        await fetch(`/api/coverages?id=${encodeURIComponent(coverageId)}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to discard draft coverage', e);
      }
    }
    reset();
    onCancel();
  }, [coverageId, onCancel, reset]);

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Upload Document</h1>
        <p className="text-sm text-gray-500 m-0">
          Drop a policy, warranty, or benefits document. We extract the fields, you review and save.
        </p>
      </div>

      {(stage === 'idle' || stage === 'error') && (
        <Dropzone
          isDragOver={isDragOver}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onPickFile={() => fileInputRef.current?.click()}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) startUpload(f);
        }}
      />

      {error && (
        <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm">
          {error}
          {(stage === 'error' || stage === 'review') && (
            <button
              onClick={reset}
              className="ml-3 underline text-red-700 bg-transparent border-none cursor-pointer p-0 text-sm"
            >
              Try another file
            </button>
          )}
        </div>
      )}

      {(stage === 'uploading' || stage === 'parsing' || stage === 'saving') && file && (
        <ProgressPanel stage={stage} filename={file.name} />
      )}

      {stage === 'review' && (
        <ReviewForm
          fields={fields}
          confidence={confidence}
          filename={file?.name ?? ''}
          onChange={setFields}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onTryAnother={reset}
        />
      )}
    </div>
  );
}

function Dropzone({
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onPickFile,
}: {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onPickFile: () => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onPickFile}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPickFile();
        }
      }}
      className={[
        'flex flex-col items-center justify-center text-center cursor-pointer',
        'border-2 border-dashed rounded-xl px-6 py-14 transition-colors',
        isDragOver
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50',
      ].join(' ')}
    >
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl text-gray-500 mb-3">
        ↑
      </div>
      <div className="text-base font-semibold text-gray-900">Drop your document here</div>
      <div className="text-sm text-gray-500 mt-1">
        or <span className="text-blue-600 underline">browse files</span>
      </div>
      <div className="text-xs text-gray-400 mt-3">PDF, PNG, JPG, WEBP, or GIF — up to 25 MB</div>
    </div>
  );
}

function ProgressPanel({ stage, filename }: { stage: Stage; filename: string }) {
  const isUploading = stage === 'uploading';
  const isParsing = stage === 'parsing';
  const isSaving = stage === 'saving';
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="text-sm font-semibold text-gray-900 mb-3 truncate">
        {isSaving ? 'Saving coverage' : filename}
      </div>
      <ProgressStep label="Uploading file" state={isUploading ? 'active' : 'done'} />
      <ProgressStep
        label="Extracting fields with AI"
        state={isParsing ? 'active' : isUploading ? 'pending' : 'done'}
      />
      {isSaving && <ProgressStep label="Saving coverage record" state="active" />}
    </div>
  );
}

function ProgressStep({ label, state }: { label: string; state: 'pending' | 'active' | 'done' }) {
  const icon = state === 'done' ? '✓' : state === 'active' ? '◐' : '○';
  const colour =
    state === 'done' ? 'text-green-600' : state === 'active' ? 'text-blue-600' : 'text-gray-400';
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-sm">
      <span className={`text-base w-5 text-center ${colour} ${state === 'active' ? 'animate-pulse' : ''}`}>
        {icon}
      </span>
      <span className={state === 'pending' ? 'text-gray-400' : 'text-gray-800'}>{label}</span>
    </div>
  );
}

function ReviewForm({
  fields,
  confidence,
  filename,
  onChange,
  onSave,
  onDiscard,
  onTryAnother,
}: {
  fields: ReviewFields;
  confidence: number | null;
  filename: string;
  onChange: (next: ReviewFields) => void;
  onSave: () => void;
  onDiscard: () => void;
  onTryAnother: () => void;
}) {
  const lowConfidence = confidence != null && confidence < 0.7;
  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  function patch<K extends keyof ReviewFields>(key: K, value: ReviewFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  const canSave = !!fields.provider && !!fields.type && !!fields.startDate && !!fields.endDate;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">Review extracted fields</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">From {filename}</div>
        </div>
        {confidence != null && <ConfidenceBadge value={confidence} />}
      </div>

      {lowConfidence && (
        <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3 py-2 text-xs">
          Low confidence extraction. Double-check every field before saving.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Provider" required>
          <input
            className={inputClass}
            value={fields.provider}
            onChange={(e) => patch('provider', e.target.value)}
            placeholder="e.g. Allstate, Chase, Apple"
          />
        </Field>
        <Field label="Coverage Type" required>
          <input
            className={inputClass}
            value={fields.type}
            onChange={(e) => patch('type', e.target.value)}
            placeholder="e.g. Auto Insurance, AppleCare+"
          />
        </Field>
        <Field label="Category">
          <select
            className={inputClass}
            value={fields.category}
            onChange={(e) => patch('category', e.target.value as CoverageCategory)}
          >
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <option key={key} value={key}>
                {cat.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Policy Number">
          <input
            className={inputClass}
            value={fields.policyNo}
            onChange={(e) => patch('policyNo', e.target.value)}
          />
        </Field>
        <Field label="Start Date" required>
          <input
            className={inputClass}
            type="date"
            value={fields.startDate}
            onChange={(e) => patch('startDate', e.target.value)}
          />
        </Field>
        <Field label="End Date" required>
          <input
            className={inputClass}
            value={fields.endDate}
            onChange={(e) => patch('endDate', e.target.value)}
            placeholder="YYYY-MM-DD or 'Ongoing'"
          />
        </Field>
        <Field label="Monthly Premium ($)">
          <input
            className={inputClass}
            type="number"
            value={fields.premium || 0}
            onChange={(e) => patch('premium', Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Deductible ($)">
          <input
            className={inputClass}
            type="number"
            value={fields.deductible ?? ''}
            onChange={(e) =>
              patch('deductible', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="OOP Max ($)">
          <input
            className={inputClass}
            type="number"
            value={fields.oopMax ?? ''}
            onChange={(e) =>
              patch('oopMax', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Co-insurance">
          <input
            className={inputClass}
            value={fields.coInsurance ?? ''}
            onChange={(e) =>
              patch('coInsurance', e.target.value === '' ? null : e.target.value)
            }
            placeholder="e.g. 80/20 after deductible"
          />
        </Field>
      </div>

      <Field label="Coverage Limit">
        <input
          className={inputClass}
          value={fields.coverageLimit}
          onChange={(e) => patch('coverageLimit', e.target.value)}
          placeholder="e.g. $500,000 dwelling / $250,000 personal property"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        <Field label="Covered (comma separated)">
          <input
            className={inputClass}
            value={fields.covered.join(', ')}
            onChange={(e) =>
              patch(
                'covered',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </Field>
        <Field label="Exclusions (comma separated)">
          <input
            className={inputClass}
            value={fields.exclusions.join(', ')}
            onChange={(e) =>
              patch(
                'exclusions',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </Field>
        <Field label="Claims Phone">
          <input
            className={inputClass}
            value={fields.claimPhone}
            onChange={(e) => patch('claimPhone', e.target.value)}
          />
        </Field>
        <Field label="Claims URL">
          <input
            className={inputClass}
            value={fields.claimUrl}
            onChange={(e) => patch('claimUrl', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Summary">
        <textarea
          className={`${inputClass} h-20 resize-none`}
          value={fields.summary}
          onChange={(e) => patch('summary', e.target.value)}
          placeholder="One-sentence plain-language summary of what this coverage does"
        />
      </Field>

      <div className="flex flex-wrap gap-3 justify-end mt-6">
        <button
          type="button"
          onClick={onTryAnother}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
        >
          Try another file
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="px-6 py-2 bg-gray-900 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save coverage
        </button>
      </div>
    </div>
  );
}

function Field({
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

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.9
      ? { bg: '#ecfdf5', fg: '#059669', label: 'High confidence' }
      : value >= 0.7
        ? { bg: '#fffbeb', fg: '#b45309', label: 'Medium confidence' }
        : { bg: '#fef2f2', fg: '#b91c1c', label: 'Low confidence' };
  return (
    <div
      className="px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {tone.label} · {pct}%
    </div>
  );
}

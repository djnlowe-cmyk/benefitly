'use client';

import { useState } from 'react';
import { Coverage, CoverageCategory, CoverageStatus } from '@/types/coverage';
import { CATEGORIES } from '@/data/categories';

interface AddCoverageViewProps {
  onAdd: (coverage: Omit<Coverage, 'id'>) => void;
  onCancel: () => void;
}

export default function AddCoverageView({ onAdd, onCancel }: AddCoverageViewProps) {
  const [provider, setProvider] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState<CoverageCategory>('health');
  const [policyNo, setPolicyNo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');
  const [deductible, setDeductible] = useState('');
  const [limit, setLimit] = useState('');
  const [summary, setSummary] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      provider,
      type,
      category,
      policyNo,
      status: 'active' as CoverageStatus,
      statusLabel: 'Active',
      covered: [],
      startDate,
      endDate,
      premium: Number(premium) || 0,
      deductible: Number(deductible) || 0,
      oopMax: null,
      limit,
      coInsurance: null,
      exclusions: [],
      claimPhone: '',
      claimUrl: '',
      summary,
    });
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'block text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium';

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Add Coverage</h1>
        <p className="text-sm text-gray-500 m-0">Manually add a coverage source to your dashboard.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className={labelClass}>Provider</label>
            <input className={inputClass} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Allstate, Chase, Apple" required />
          </div>
          <div>
            <label className={labelClass}>Coverage Type</label>
            <input className={inputClass} value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Auto Insurance, AppleCare+" required />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as CoverageCategory)}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <option key={key} value={key}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Policy Number</label>
            <input className={inputClass} value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder="e.g. POL-12345" />
          </div>
          <div>
            <label className={labelClass}>Start Date</label>
            <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input className={inputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Monthly Premium ($)</label>
            <input className={inputClass} type="number" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className={labelClass}>Deductible ($)</label>
            <input className={inputClass} type="number" value={deductible} onChange={(e) => setDeductible(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Coverage Limit</label>
          <input className={inputClass} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="e.g. $500,000 dwelling / $250,000 personal property" />
        </div>

        <div className="mb-6">
          <label className={labelClass}>Summary</label>
          <textarea className={`${inputClass} h-20 resize-none`} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief description of this coverage..." />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="px-6 py-2 bg-gray-900 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-800">
            Add Coverage
          </button>
        </div>
      </form>
    </div>
  );
}

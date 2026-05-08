'use client';

import { useState } from 'react';
import { FamilyMember } from '@/types/coverage';

interface FamilyMembersViewProps {
  members: FamilyMember[];
  onAdd: (name: string, relation: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const RELATIONS = ['spouse', 'partner', 'child', 'parent', 'sibling', 'other'];

export default function FamilyMembersView({ members, onAdd, onDelete }: FamilyMembersViewProps) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('spouse');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(name.trim(), relation);
      setName('');
      setRelation('spouse');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Family Members</h1>
        <p className="text-sm text-gray-500 m-0">
          Track who&apos;s covered by each policy. Up to 5 household members.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 mb-6 max-w-2xl">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Lowe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">
              Relation
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={submitting}
            >
              {RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim() || members.length >= 5}
            className="px-5 py-2 bg-gray-900 text-white border-none rounded-md text-sm font-semibold cursor-pointer hover:bg-gray-800 disabled:opacity-60"
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
        {error && (
          <div className="mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        {members.length >= 5 && (
          <div className="mt-3 text-xs text-gray-500">
            Maximum of 5 family members reached.
          </div>
        )}
      </form>

      {members.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-base font-medium">No family members yet</div>
          <div className="text-sm mt-1">Add the people you cover with the form above.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
                {m.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{m.name}</div>
                <div className="text-xs text-gray-500 capitalize">{m.relation}</div>
              </div>
              <button
                onClick={() => onDelete(m.id)}
                className="text-xs text-red-600 bg-transparent border-none cursor-pointer p-0 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

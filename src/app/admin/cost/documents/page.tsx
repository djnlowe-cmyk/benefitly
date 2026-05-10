import { requireAdmin } from '@/lib/admin';
import { getDocumentRows, formatPence, type DocumentRow } from '@/lib/costMetrics';

export const dynamic = 'force-dynamic';

const ROW_LIMIT = 200;

const VALID_SORT = new Set(['createdAt', 'cost', 'tokens', 'cache']);
const VALID_FILTERS = new Set(['all', 'parse', 'search-rerank', 're-extract']);

interface PageProps {
  searchParams: Promise<{ sort?: string; task?: string; category?: string }>;
}

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  marginTop: '12px',
  fontSize: '13px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'top',
};

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtRelative(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function applySortFilter(
  rows: DocumentRow[],
  sort: string,
  task: string,
  category: string,
): DocumentRow[] {
  let out = rows;
  if (task !== 'all') out = out.filter((r) => r.task === task);
  if (category) out = out.filter((r) => r.category === category);
  switch (sort) {
    case 'cost':
      return [...out].sort((a, b) => b.costPence - a.costPence);
    case 'tokens':
      return [...out].sort(
        (a, b) =>
          (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens),
      );
    case 'cache':
      return [...out].sort((a, b) => b.cacheHitRate - a.cacheHitRate);
    case 'createdAt':
    default:
      return out;
  }
}

export default async function CostDocumentsPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const rawSort = params.sort && VALID_SORT.has(params.sort) ? params.sort : 'createdAt';
  const rawTask = params.task && VALID_FILTERS.has(params.task) ? params.task : 'all';
  const rawCategory = (params.category ?? '').slice(0, 32);

  const allRows = await getDocumentRows({ limit: ROW_LIMIT });
  const rows = applySortFilter(allRows, rawSort, rawTask, rawCategory);
  const totalPence = rows.reduce((s, r) => s + r.costPence, 0);

  const categories = Array.from(
    new Set(allRows.map((r) => r.category).filter((c): c is string => Boolean(c))),
  ).sort();

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        AI cost — per-document
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        Most recent {rows.length} of {allRows.length} Claude calls (window: last {ROW_LIMIT}{' '}
        rows). Total visible: {formatPence(totalPence)}.
      </p>

      <form method="GET" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ fontSize: 13 }}>
          Sort by:{' '}
          <select name="sort" defaultValue={rawSort}>
            <option value="createdAt">Newest first</option>
            <option value="cost">Highest cost</option>
            <option value="tokens">Most tokens</option>
            <option value="cache">Best cache-hit</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Task:{' '}
          <select name="task" defaultValue={rawTask}>
            <option value="all">All</option>
            <option value="parse">Parse</option>
            <option value="search-rerank">Search-rerank</option>
            <option value="re-extract">Re-extract</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Doc category:{' '}
          <select name="category" defaultValue={rawCategory}>
            <option value="">Any</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ fontSize: 13 }}>
          Apply
        </button>
      </form>

      <table style={tableStyle} data-testid="cost-documents-table">
        <thead>
          <tr>
            <th style={thStyle}>When</th>
            <th style={thStyle}>User</th>
            <th style={thStyle}>Document</th>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Task</th>
            <th style={thStyle}>Model</th>
            <th style={thStyle}>In</th>
            <th style={thStyle}>Out</th>
            <th style={thStyle}>Cache</th>
            <th style={thStyle}>Cost</th>
            <th style={thStyle}>OK?</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ ...tdStyle, color: '#6b7280' }}>
                No Claude usage rows match these filters.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={`${r.documentId ?? 'no-doc'}-${i}`}>
                <td style={tdStyle} title={r.createdAt.toISOString()}>
                  {fmtRelative(r.createdAt)}
                </td>
                <td style={tdStyle}>{r.userEmail ?? '—'}</td>
                <td style={tdStyle}>{r.filename ?? '—'}</td>
                <td style={tdStyle}>{r.category ?? '—'}</td>
                <td style={tdStyle}>{r.task}</td>
                <td style={tdStyle}>{r.model}</td>
                <td style={tdStyle}>{fmtTokens(r.inputTokens)}</td>
                <td style={tdStyle}>{fmtTokens(r.outputTokens)}</td>
                <td style={tdStyle}>{fmtPct(r.cacheHitRate)}</td>
                <td style={tdStyle}>{formatPence(r.costPence)}</td>
                <td style={tdStyle}>{r.successful ? '✓' : '✗'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p style={{ color: '#6b7280', fontSize: 12, marginTop: 24 }}>
        v1: bounded list, no pagination. Pricing snapshot 2026-05 — see
        src/lib/claudeUsage.ts to refresh. No Claude prompt/response text is stored.
      </p>
    </main>
  );
}

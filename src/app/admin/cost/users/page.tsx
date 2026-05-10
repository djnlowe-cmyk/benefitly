import { requireAdmin } from '@/lib/admin';
import {
  COST_THRESHOLDS_PENCE,
  computeStats,
  formatPence,
  getUserRows,
} from '@/lib/costMetrics';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;

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
};

const summaryCellStyle = (pass: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: pass ? '#dcfce7' : '#fee2e2',
  color: pass ? '#14532d' : '#7f1d1d',
  fontWeight: 600,
});

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export default async function CostUsersPage() {
  await requireAdmin();
  const userRows = await getUserRows({ windowDays: WINDOW_DAYS });
  const stats = computeStats(userRows.map((u) => u.totalPence));

  const tripWireBreached = stats.median >= COST_THRESHOLDS_PENCE.tripWire;
  const overPhase1Cap = stats.median > COST_THRESHOLDS_PENCE.phase1Cap;
  const insideTarget = stats.median <= COST_THRESHOLDS_PENCE.targetHigh;

  return (
    <main
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        AI cost — per-user (last {WINDOW_DAYS} days)
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>
        £/paying-user/mo (any user with ≥1 Claude call counts in v1). Targets:{' '}
        {formatPence(COST_THRESHOLDS_PENCE.targetLow)}–
        {formatPence(COST_THRESHOLDS_PENCE.targetHigh)}; Phase-1 cap{' '}
        {formatPence(COST_THRESHOLDS_PENCE.phase1Cap)}; trip-wire{' '}
        {formatPence(COST_THRESHOLDS_PENCE.tripWire)}.
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Cohort summary</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Metric</th>
            <th style={thStyle}>Value</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Median £/user</td>
            <td style={tdStyle} data-testid="median-pence">
              {formatPence(stats.median)}
            </td>
            <td style={summaryCellStyle(insideTarget && !tripWireBreached)}>
              {overPhase1Cap
                ? 'OVER PHASE-1 CAP'
                : tripWireBreached
                ? 'TRIP-WIRE BREACHED'
                : insideTarget
                ? 'INSIDE TARGET'
                : 'INSIDE CAP'}
            </td>
          </tr>
          <tr>
            <td style={tdStyle}>p90 £/user</td>
            <td style={tdStyle} data-testid="p90-pence">{formatPence(stats.p90)}</td>
            <td style={tdStyle}>—</td>
          </tr>
          <tr>
            <td style={tdStyle}>Mean £/user</td>
            <td style={tdStyle}>{formatPence(stats.mean)}</td>
            <td style={tdStyle}>—</td>
          </tr>
          <tr>
            <td style={tdStyle}>Active users (n)</td>
            <td style={tdStyle} data-testid="user-count">{stats.count}</td>
            <td style={tdStyle}>—</td>
          </tr>
          <tr>
            <td style={tdStyle}>Total cohort spend</td>
            <td style={tdStyle}>{formatPence(stats.totalPence)}</td>
            <td style={tdStyle}>—</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>
        Top spenders
      </h2>
      <table style={tableStyle} data-testid="user-spend-table">
        <thead>
          <tr>
            <th style={thStyle}>User</th>
            <th style={thStyle}>Calls</th>
            <th style={thStyle}>Total cost</th>
            <th style={thStyle}>Cache-hit %</th>
          </tr>
        </thead>
        <tbody>
          {userRows.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ ...tdStyle, color: '#6b7280' }}>
                No Claude usage in the last {WINDOW_DAYS} days.
              </td>
            </tr>
          ) : (
            userRows.map((u) => (
              <tr key={u.userId}>
                <td style={tdStyle}>{u.email ?? u.userId}</td>
                <td style={tdStyle}>{u.callCount}</td>
                <td style={tdStyle}>{formatPence(u.totalPence)}</td>
                <td style={tdStyle}>{fmtPct(u.cacheHitRate)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p style={{ color: '#6b7280', fontSize: 12, marginTop: 24 }}>
        v1: paying-user proxy = any user with ≥1 Claude call in the window. Replace
        with a billing-table join when subscriptions land.
      </p>
    </main>
  );
}

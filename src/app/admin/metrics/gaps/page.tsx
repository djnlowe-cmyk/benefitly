// v2 backlog — NOT captured here: action-clicks, rationale-expansion, time-series, cohort, real-time alerting, third-party analytics.

import { requireAdmin } from '@/lib/admin';
import { getDashboardSummary } from '@/lib/metrics/gaps';

export const dynamic = 'force-dynamic';

const ENGAGEMENT_TARGET = 0.3;
const DISMISSAL_RATE_TARGET = 0.3;
const PER_RULE_DISMISSAL_TARGET = 0.5;

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function cellStyle(pass: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    backgroundColor: pass ? '#dcfce7' : '#fee2e2',
    color: pass ? '#14532d' : '#7f1d1d',
    fontWeight: 600,
  };
}

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

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  marginBottom: '24px',
  fontSize: '14px',
};

export default async function AdminGapsMetricsPage() {
  await requireAdmin();
  const summary = await getDashboardSummary();
  const totalFires = summary.fires.reduce((s, r) => s + r.fired, 0);
  const totalDismissals = summary.dismissals.reduce((s, r) => s + r.dismissed, 0);
  const overallDismissalRate =
    totalFires === 0 ? 0 : totalDismissals / totalFires;

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Coverage gap metrics
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Snapshot generated {summary.generatedAt}
      </p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Engagement</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Metric</th>
            <th style={thStyle}>Numerator</th>
            <th style={thStyle}>Denominator</th>
            <th style={thStyle}>Value</th>
            <th style={thStyle}>Target</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Detail-view → dismiss engagement</td>
            <td style={tdStyle} data-testid="engagement-numerator">{summary.engagement.dismissers}</td>
            <td style={tdStyle} data-testid="engagement-denominator">{summary.engagement.detailViewers}</td>
            <td
              style={cellStyle(summary.engagement.ratio >= ENGAGEMENT_TARGET)}
              data-testid="engagement-ratio"
            >
              {pct(summary.engagement.ratio)}
            </td>
            <td style={tdStyle}>≥ {pct(ENGAGEMENT_TARGET)}</td>
          </tr>
          <tr>
            <td style={tdStyle}>Overall dismissal rate</td>
            <td style={tdStyle} data-testid="overall-dismissed">{totalDismissals}</td>
            <td style={tdStyle} data-testid="overall-fired">{totalFires}</td>
            <td
              style={cellStyle(overallDismissalRate < DISMISSAL_RATE_TARGET)}
              data-testid="overall-dismissal-rate"
            >
              {pct(overallDismissalRate)}
            </td>
            <td style={tdStyle}>&lt; {pct(DISMISSAL_RATE_TARGET)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Fire snapshot (active coverages)</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>gapKey</th>
            <th style={thStyle}>Fires</th>
          </tr>
        </thead>
        <tbody data-testid="fires-tbody">
          {summary.fires.length === 0 ? (
            <tr><td colSpan={2} style={tdStyle}>No fires.</td></tr>
          ) : (
            summary.fires.map((row) => (
              <tr key={row.gapKey}>
                <td style={tdStyle}>{row.gapKey}</td>
                <td style={tdStyle}>{row.fired}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Dismissals by reason</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>gapKey</th>
            <th style={thStyle}>dismissReason</th>
            <th style={thStyle}>Dismissed</th>
          </tr>
        </thead>
        <tbody data-testid="dismissals-tbody">
          {summary.dismissals.length === 0 ? (
            <tr><td colSpan={3} style={tdStyle}>No dismissals.</td></tr>
          ) : (
            summary.dismissals.map((row) => (
              <tr key={`${row.gapKey}|${row.dismissReason}`}>
                <td style={tdStyle}>{row.gapKey}</td>
                <td style={tdStyle}>{row.dismissReason}</td>
                <td style={tdStyle}>{row.dismissed}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Per-rule dismissal rate</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>gapKey</th>
            <th style={thStyle}>Fires</th>
            <th style={thStyle}>Dismissed</th>
            <th style={thStyle}>Dismissal rate</th>
            <th style={thStyle}>Target</th>
          </tr>
        </thead>
        <tbody data-testid="per-rule-tbody">
          {summary.perRule.length === 0 ? (
            <tr><td colSpan={5} style={tdStyle}>No rules fired.</td></tr>
          ) : (
            summary.perRule.map((row) => (
              <tr key={row.gapKey}>
                <td style={tdStyle}>{row.gapKey}</td>
                <td style={tdStyle}>{row.fired}</td>
                <td style={tdStyle}>{row.dismissed}</td>
                <td style={cellStyle(row.dismissalRate < PER_RULE_DISMISSAL_TARGET)}>
                  {pct(row.dismissalRate)}
                </td>
                <td style={tdStyle}>&lt; {pct(PER_RULE_DISMISSAL_TARGET)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <p style={{ color: '#6b7280', fontSize: 12, marginTop: 24 }}>
        v1 = dismissal-only signal for engagement; action-clicks and rationale-expansion not yet captured.
      </p>
    </main>
  );
}

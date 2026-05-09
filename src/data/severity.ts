import type { Alert } from '@/types/coverage';

export interface SeverityStyle {
  label: string;
  color: string;
  bg: string;
  icon: string;
}

export const SEVERITY_STYLES: Record<Alert['severity'], SeverityStyle> = {
  warning: { label: 'Warning', color: '#d97706', bg: '#fffbeb', icon: '⚠' },
  info:    { label: 'Info',    color: '#2563eb', bg: '#eff6ff', icon: 'ℹ' },
  tip:     { label: 'Tip',     color: '#059669', bg: '#ecfdf5', icon: '💡' },
  urgent:  { label: 'Urgent',  color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
};

// Defensive lookup: Alert.severity is typed but persisted as a free string,
// so an off-enum severity from a future server change or bad seed would
// crash AlertsView via `.color`/`.bg`/`.icon`. Always go through this helper.
export function resolveSeverity(key: string): SeverityStyle {
  return (
    (SEVERITY_STYLES as Record<string, SeverityStyle | undefined>)[key] ?? {
      label: key,
      color: '#6b7280',
      bg: '#f3f4f6',
      icon: '?',
    }
  );
}

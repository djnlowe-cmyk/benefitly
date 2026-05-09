'use client';

import { Alert } from '@/types/coverage';
import { resolveSeverity } from '@/data/severity';
import { formatDate } from '@/lib/format';

interface AlertsViewProps {
  alerts: Alert[];
  onMarkRead: (id: string) => void;
}

export default function AlertsView({ alerts, onMarkRead }: AlertsViewProps) {
  const unread = alerts.filter((a) => !a.read);
  const read = alerts.filter((a) => a.read);

  const renderAlert = (alert: Alert) => {
    const sev = resolveSeverity(alert.severity);
    return (
      <div
        key={alert.id}
        className="bg-white border border-gray-200 rounded-lg p-4 flex gap-3"
        style={{ borderLeft: `4px solid ${sev.color}`, opacity: alert.read ? 0.7 : 1 }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
          style={{ background: sev.bg, color: sev.color }}
        >
          {sev.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900">{alert.title}</div>
            <div className="text-[11px] text-gray-400 shrink-0">{formatDate(alert.date)}</div>
          </div>
          <div className="text-sm text-gray-600 mt-1 leading-relaxed">{alert.detail}</div>
          {!alert.read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              className="mt-2 text-xs text-blue-600 bg-transparent border-none cursor-pointer p-0 hover:underline"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1">Alerts</h1>
        <p className="text-sm text-gray-500 m-0">
          {unread.length} unread alert{unread.length !== 1 ? 's' : ''} requiring your attention.
        </p>
      </div>

      {unread.length > 0 && (
        <div className="space-y-3 mb-8">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">New</div>
          {unread.map(renderAlert)}
        </div>
      )}

      {read.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Earlier</div>
          {read.map(renderAlert)}
        </div>
      )}
    </div>
  );
}

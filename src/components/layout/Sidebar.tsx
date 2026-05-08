'use client';

import { ViewId } from '@/types/coverage';
import clsx from 'clsx';

const NAV_ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'search', label: "What's Covered?", icon: '⌕' },
  { id: 'policies', label: 'Policies', icon: '▧' },
  { id: 'transactions', label: 'Transactions', icon: '↔' },
  { id: 'assets', label: 'My Assets', icon: '◈' },
  { id: 'claims', label: 'Claims', icon: '✎' },
  { id: 'optimiser', label: 'Optimiser', icon: '◎' },
  { id: 'alerts', label: 'Alerts', icon: '●' },
  { id: 'vault', label: 'Documents', icon: '▤' },
  { id: 'family', label: 'Family', icon: '⚭' },
  { id: 'upload', label: 'Upload Document', icon: '↑' },
  { id: 'add', label: 'Add Coverage', icon: '+' },
];

interface SidebarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  alertCount: number;
  coverageCount: number;
}

export default function Sidebar({ activeView, onNavigate, alertCount, coverageCount }: SidebarProps) {
  return (
    <div className="w-[220px] min-h-screen bg-gray-900 text-gray-300 flex flex-col shrink-0">
      <div className="px-5 pt-6 pb-8 border-b border-gray-800">
        <div className="text-[22px] font-bold text-white tracking-tight">Benefitly</div>
        <div className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-widest">Coverage Manager</div>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={clsx(
                'flex items-center gap-2.5 w-full px-3 py-2.5 mb-0.5 border-none rounded-md text-sm text-left transition-colors',
                active
                  ? 'bg-gray-800 text-white font-semibold'
                  : 'bg-transparent text-gray-400 hover:bg-gray-800/50'
              )}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'alerts' && alertCount > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[11px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
                  {alertCount}
                </span>
              )}
              {item.id === 'policies' && (
                <span className="ml-auto text-[11px] text-gray-500 font-semibold">{coverageCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <a
        href="/settings"
        className="flex items-center gap-2 w-full px-5 py-4 border-t border-gray-800 text-xs text-left transition-colors no-underline bg-transparent hover:bg-gray-800/50"
      >
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-semibold">
          DL
        </div>
        <div>
          <div className="text-gray-300 font-medium">Settings</div>
          <div className="text-[11px] text-gray-500">Region & account</div>
        </div>
      </a>
    </div>
  );
}

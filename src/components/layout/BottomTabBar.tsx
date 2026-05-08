'use client';

import { useState } from 'react';
import { ViewId } from '@/types/coverage';
import clsx from 'clsx';

const TAB_BAR_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '▦' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'policies', label: 'Policies', icon: '▧' },
  { id: 'alerts', label: 'Alerts', icon: '●' },
  { id: 'more', label: 'More', icon: '···' },
];

const MORE_ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'transactions', label: 'Transactions', icon: '↔' },
  { id: 'assets', label: 'My Assets', icon: '◈' },
  { id: 'claims', label: 'Claims', icon: '✎' },
  { id: 'optimiser', label: 'Optimiser', icon: '◎' },
  { id: 'vault', label: 'Documents', icon: '▤' },
  { id: 'family', label: 'Family', icon: '⚭' },
  { id: 'upload', label: 'Upload Document', icon: '↑' },
  { id: 'add', label: 'Add Coverage', icon: '+' },
];

interface BottomTabBarProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  alertCount: number;
}

export default function BottomTabBar({ activeView, onNavigate, alertCount }: BottomTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
            <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto mb-4" />
            {MORE_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMoreOpen(false);
                }}
                className="flex items-center gap-3 w-full py-3 px-2 border-none rounded-lg bg-transparent text-[15px] text-gray-900 text-left hover:bg-gray-50"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base font-bold">
                  {item.icon}
                </div>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-around bg-white border-t border-gray-200 py-1.5 pb-[max(8px,env(safe-area-inset-bottom))] sticky bottom-0 z-30">
        {TAB_BAR_ITEMS.map((item) => {
          const isMore = item.id === 'more';
          const active = isMore ? moreOpen : activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => (isMore ? setMoreOpen(!moreOpen) : onNavigate(item.id as ViewId))}
              className={clsx(
                'flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer px-3 py-1 min-w-[48px] relative',
                active ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              <span className="text-lg font-semibold">{item.icon}</span>
              <span className={clsx('text-[10px]', active ? 'font-semibold' : 'font-normal')}>
                {item.label}
              </span>
              {item.id === 'alerts' && alertCount > 0 && (
                <span className="absolute top-0 right-1.5 bg-red-600 text-white text-[8px] font-bold rounded-md px-1 min-w-[12px] text-center">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

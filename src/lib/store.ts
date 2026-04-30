'use client';

import { createContext, useContext } from 'react';
import { Coverage, Alert, Transaction, Asset, Claim, ViewId } from '@/types/coverage';

export interface AppState {
  coverages: Coverage[];
  alerts: Alert[];
  transactions: Transaction[];
  assets: Asset[];
  claims: Claim[];
  activeView: ViewId;
  selectedCoverage: Coverage | null;
}

export interface AppActions {
  navigate: (view: ViewId) => void;
  selectCoverage: (coverage: Coverage | null) => void;
  addCoverage: (coverage: Omit<Coverage, 'id'>) => void;
  deleteCoverage: (id: number) => void;
  markAlertRead: (id: number) => void;
}

export const AppStateContext = createContext<AppState | null>(null);
export const AppActionsContext = createContext<AppActions | null>(null);

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

export function useAppActions() {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error('useAppActions must be used within AppProvider');
  return ctx;
}

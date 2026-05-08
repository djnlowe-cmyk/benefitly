'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Coverage, Alert, FamilyMember, ViewId } from '@/types/coverage';
import { SEED_TRANSACTIONS, SEED_ASSETS, SEED_CLAIMS } from '@/data/seed';
import { useBreakpoint } from '@/lib/hooks';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import DashboardView from '@/components/dashboard/DashboardView';
import CoverageDetail from '@/components/coverage/CoverageDetail';
import SearchView from '@/components/search/SearchView';
import AlertsView from '@/components/alerts/AlertsView';
import TransactionsView from '@/components/transactions/TransactionsView';
import AssetsView from '@/components/assets/AssetsView';
import ClaimsView from '@/components/claims/ClaimsView';
import OptimiserView from '@/components/optimiser/OptimiserView';
import VaultView from '@/components/vault/VaultView';
import AddCoverageView from '@/components/coverage/AddCoverageView';
import DocumentUploadView from '@/components/coverage/DocumentUploadView';
import FamilyMembersView from '@/components/family/FamilyMembersView';

type LoadState = 'loading' | 'ready' | 'error';

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-3" />
      <div className="text-sm">{label}</div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 max-w-xl">
      <div className="font-semibold mb-1">Couldn&apos;t load data</div>
      <div className="mb-3">{message}</div>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 bg-white border border-red-300 rounded-md text-red-700 font-medium cursor-pointer hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  );
}

export default function AppShell() {
  const bp = useBreakpoint();
  const [activeView, setActiveView] = useState<ViewId>('dashboard');

  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);

  const [coverageState, setCoverageState] = useState<LoadState>('loading');
  const [alertState, setAlertState] = useState<LoadState>('loading');
  const [familyState, setFamilyState] = useState<LoadState>('loading');

  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [familyError, setFamilyError] = useState<string | null>(null);

  const [selectedCoverage, setSelectedCoverage] = useState<Coverage | null>(null);

  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const loadCoverages = useCallback(async () => {
    setCoverageState('loading');
    try {
      const res = await fetch('/api/coverages');
      if (!res.ok) throw new Error(`Failed to load coverages (${res.status})`);
      const data: Coverage[] = await res.json();
      setCoverages(data);
      setCoverageError(null);
      setCoverageState('ready');
    } catch (e) {
      setCoverageError(e instanceof Error ? e.message : 'Failed to load coverages');
      setCoverageState('error');
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertState('loading');
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error(`Failed to load alerts (${res.status})`);
      const data: Alert[] = await res.json();
      setAlerts(data);
      setAlertError(null);
      setAlertState('ready');
    } catch (e) {
      setAlertError(e instanceof Error ? e.message : 'Failed to load alerts');
      setAlertState('error');
    }
  }, []);

  const loadFamily = useCallback(async () => {
    setFamilyState('loading');
    try {
      const res = await fetch('/api/family');
      if (!res.ok) throw new Error(`Failed to load family (${res.status})`);
      const data: FamilyMember[] = await res.json();
      setFamily(data);
      setFamilyError(null);
      setFamilyState('ready');
    } catch (e) {
      setFamilyError(e instanceof Error ? e.message : 'Failed to load family');
      setFamilyState('error');
    }
  }, []);

  useEffect(() => {
    loadCoverages();
    loadAlerts();
    loadFamily();
  }, [loadCoverages, loadAlerts, loadFamily]);

  const navigate = useCallback((view: ViewId) => {
    setActiveView(view);
    setSelectedCoverage(null);
  }, []);

  const handleSelectCoverage = useCallback((coverage: Coverage) => {
    setSelectedCoverage(coverage);
  }, []);

  const handleDeleteCoverage = useCallback(
    async (id: string) => {
      const previous = coverages;
      setCoverages((prev) => prev.filter((c) => c.id !== id));
      setSelectedCoverage(null);
      try {
        const res = await fetch(`/api/coverages?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      } catch (e) {
        setCoverages(previous);
        setCoverageError(e instanceof Error ? e.message : 'Failed to delete coverage');
      }
    },
    [coverages]
  );

  const handleAddCoverage = useCallback(async (coverage: Omit<Coverage, 'id'>) => {
    const res = await fetch('/api/coverages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coverage),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to save (${res.status})`);
    }
    const created: Coverage = await res.json();
    setCoverages((prev) => [created, ...prev]);
    setActiveView('dashboard');
  }, []);

  const handleMarkAlertRead = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: true }),
      });
      if (!res.ok) throw new Error(`Failed to mark alert read (${res.status})`);
    } catch (e) {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: false } : a)));
      setAlertError(e instanceof Error ? e.message : 'Failed to mark alert read');
    }
  }, []);

  const handleAddFamily = useCallback(async (name: string, relation: string) => {
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, relation }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to add (${res.status})`);
    }
    const created: FamilyMember = await res.json();
    setFamily((prev) => [...prev, created]);
  }, []);

  const handleDeleteFamily = useCallback(
    async (id: string) => {
      const previous = family;
      setFamily((prev) => prev.filter((m) => m.id !== id));
      try {
        const res = await fetch(`/api/family?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      } catch (e) {
        setFamily(previous);
        setFamilyError(e instanceof Error ? e.message : 'Failed to delete family member');
      }
    },
    [family]
  );

  const renderView = () => {
    if (selectedCoverage) {
      return (
        <CoverageDetail
          coverage={selectedCoverage}
          onBack={() => setSelectedCoverage(null)}
          onDelete={handleDeleteCoverage}
          isMobile={bp.isMobile}
        />
      );
    }

    const coveragesNeeded =
      activeView === 'dashboard' ||
      activeView === 'policies' ||
      activeView === 'search' ||
      activeView === 'optimiser' ||
      activeView === 'vault';

    if (coveragesNeeded) {
      if (coverageState === 'loading') return <LoadingPanel label="Loading your coverages…" />;
      if (coverageState === 'error') {
        return <ErrorPanel message={coverageError || 'Could not load coverages'} onRetry={loadCoverages} />;
      }
    }

    switch (activeView) {
      case 'dashboard':
      case 'policies':
        return (
          <DashboardView
            coverages={coverages}
            onSelectCoverage={handleSelectCoverage}
            isMobile={bp.isMobile}
          />
        );
      case 'search':
        return <SearchView coverages={coverages} isMobile={bp.isMobile} />;
      case 'transactions':
        return <TransactionsView transactions={SEED_TRANSACTIONS} isMobile={bp.isMobile} />;
      case 'assets':
        return <AssetsView assets={SEED_ASSETS} isMobile={bp.isMobile} />;
      case 'claims':
        return <ClaimsView claims={SEED_CLAIMS} isMobile={bp.isMobile} />;
      case 'optimiser':
        return <OptimiserView coverages={coverages} isMobile={bp.isMobile} />;
      case 'alerts':
        if (alertState === 'loading') return <LoadingPanel label="Loading alerts…" />;
        if (alertState === 'error') {
          return <ErrorPanel message={alertError || 'Could not load alerts'} onRetry={loadAlerts} />;
        }
        return <AlertsView alerts={alerts} onMarkRead={handleMarkAlertRead} />;
      case 'vault':
        return <VaultView coverages={coverages} isMobile={bp.isMobile} />;
      case 'add':
        return <AddCoverageView onAdd={handleAddCoverage} onCancel={() => navigate('dashboard')} />;
      case 'upload':
        return (
          <DocumentUploadView
            onSaved={(coverage) => {
              setCoverages((prev) => {
                const without = prev.filter((c) => c.id !== coverage.id);
                return [coverage, ...without];
              });
              setActiveView('dashboard');
            }}
            onCancel={() => navigate('dashboard')}
          />
        );
      case 'family':
        if (familyState === 'loading') return <LoadingPanel label="Loading family…" />;
        if (familyState === 'error') {
          return <ErrorPanel message={familyError || 'Could not load family'} onRetry={loadFamily} />;
        }
        return (
          <FamilyMembersView
            members={family}
            onAdd={handleAddFamily}
            onDelete={handleDeleteFamily}
          />
        );
      case 'account':
        return (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Account</h1>
            <p className="text-sm text-gray-500">Account settings coming soon.</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      {bp.isDesktop && (
        <Sidebar
          activeView={activeView}
          onNavigate={navigate}
          alertCount={unreadAlerts}
          coverageCount={coverages.length}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        {!bp.isDesktop && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
            <div>
              <div className="text-lg font-bold text-gray-900">Benefitly</div>
            </div>
            <button
              onClick={() => navigate('account')}
              className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 border-none cursor-pointer"
            >
              DL
            </button>
          </div>
        )}

        <main className={`flex-1 ${bp.isMobile ? 'px-4 py-4' : 'px-8 py-6'} max-w-6xl`}>
          {renderView()}
        </main>

        {/* Mobile bottom tab bar */}
        {!bp.isDesktop && (
          <BottomTabBar
            activeView={activeView}
            onNavigate={navigate}
            alertCount={unreadAlerts}
          />
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Coverage, ViewId } from '@/types/coverage';
import {
  SEED_COVERAGES,
  SEED_ALERTS,
  SEED_TRANSACTIONS,
  SEED_ASSETS,
  SEED_CLAIMS,
} from '@/data/seed';
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

export default function AppShell() {
  const bp = useBreakpoint();
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [coverages, setCoverages] = useState(SEED_COVERAGES);
  const [alerts, setAlerts] = useState(SEED_ALERTS);
  const [selectedCoverage, setSelectedCoverage] = useState<Coverage | null>(null);

  const unreadAlerts = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const navigate = useCallback((view: ViewId) => {
    setActiveView(view);
    setSelectedCoverage(null);
  }, []);

  const handleSelectCoverage = useCallback((coverage: Coverage) => {
    setSelectedCoverage(coverage);
  }, []);

  const handleDeleteCoverage = useCallback((id: number) => {
    setCoverages((prev) => prev.filter((c) => c.id !== id));
    setSelectedCoverage(null);
  }, []);

  const handleAddCoverage = useCallback((coverage: Omit<Coverage, 'id'>) => {
    const newId = Math.max(0, ...coverages.map((c) => c.id)) + 1;
    setCoverages((prev) => [...prev, { ...coverage, id: newId } as Coverage]);
    setActiveView('dashboard');
  }, [coverages]);

  const handleMarkAlertRead = useCallback((id: number) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  }, []);

  const renderView = () => {
    // If a coverage is selected, show detail regardless of active view
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

    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardView
            coverages={coverages}
            onSelectCoverage={handleSelectCoverage}
            isMobile={bp.isMobile}
          />
        );
      case 'search':
        return <SearchView coverages={coverages} isMobile={bp.isMobile} />;
      case 'policies':
        return (
          <DashboardView
            coverages={coverages}
            onSelectCoverage={handleSelectCoverage}
            isMobile={bp.isMobile}
          />
        );
      case 'transactions':
        return <TransactionsView transactions={SEED_TRANSACTIONS} isMobile={bp.isMobile} />;
      case 'assets':
        return <AssetsView assets={SEED_ASSETS} isMobile={bp.isMobile} />;
      case 'claims':
        return <ClaimsView claims={SEED_CLAIMS} isMobile={bp.isMobile} />;
      case 'optimiser':
        return <OptimiserView coverages={coverages} isMobile={bp.isMobile} />;
      case 'alerts':
        return <AlertsView alerts={alerts} onMarkRead={handleMarkAlertRead} />;
      case 'vault':
        return <VaultView coverages={coverages} isMobile={bp.isMobile} />;
      case 'add':
        return (
          <AddCoverageView
            onAdd={handleAddCoverage}
            onCancel={() => navigate('dashboard')}
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

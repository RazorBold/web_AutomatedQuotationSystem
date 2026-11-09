import React, { useCallback, useEffect, useState } from 'react';
import { AppStoreProvider, useStore } from './store/AppStore';
import { can, Permission } from './auth/permissions';
import { Toaster } from './components/ui';
import { Shell } from './components/Shell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { QuotationDetailPage } from './pages/QuotationDetailPage';
import { QuotationWizard } from './pages/QuotationWizard';
import { CatalogPage } from './pages/CatalogPage';
import { CustomRequestsPage } from './pages/CustomRequestsPage';
import { DiscountRulesPage } from './pages/DiscountRulesPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';

export type ViewId =
  | 'dashboard'
  | 'create-quotation'
  | 'quotations'
  | 'quotation-detail'
  | 'custom-requests'
  | 'catalog'
  | 'discount-rules'
  | 'reports'
  | 'users';

export interface Route {
  view: ViewId;
  /** quotation id for detail / revision */
  id?: string;
  /** product to preload in the wizard */
  productId?: string;
}

const VIEW_PERMISSION: Partial<Record<ViewId, Permission[]>> = {
  'create-quotation': ['quotation:create'],
  quotations: ['quotation:view-all', 'quotation:view-own'],
  'quotation-detail': ['quotation:view-all', 'quotation:view-own'],
  'custom-requests': ['custom-request:create', 'custom-request:price'],
  catalog: ['catalog:view'],
  'discount-rules': ['discount-rules:edit'],
  reports: ['reports:view'],
  users: ['users:manage'],
};

function Portal() {
  const { currentUser, ready } = useStore();
  const [route, setRoute] = useState<Route>({ view: 'dashboard' });

  const navigate = useCallback((r: Route) => {
    setRoute(r);
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, []);

  // Reset to the dashboard whenever the signed-in user changes.
  useEffect(() => setRoute({ view: 'dashboard' }), [currentUser?.id]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas" role="status">
        <p className="text-sm text-ink-3">Memuat portal…</p>
      </div>
    );
  }
  if (!currentUser) return <LoginPage />;

  const allowed = (VIEW_PERMISSION[route.view] ?? []).length === 0 || VIEW_PERMISSION[route.view]!.some(p => can(currentUser, p));
  const view = allowed ? route.view : 'dashboard';

  return (
    <Shell route={{ ...route, view }} navigate={navigate}>
      {view === 'dashboard' && <DashboardPage navigate={navigate} />}
      {view === 'create-quotation' && (
        <QuotationWizard key={`${route.id ?? 'new'}-${route.productId ?? ''}`} editId={route.id} initialProductId={route.productId} navigate={navigate} />
      )}
      {view === 'quotations' && <QuotationsPage navigate={navigate} />}
      {view === 'quotation-detail' && route.id && <QuotationDetailPage key={route.id} id={route.id} navigate={navigate} />}
      {view === 'custom-requests' && <CustomRequestsPage navigate={navigate} />}
      {view === 'catalog' && <CatalogPage navigate={navigate} />}
      {view === 'discount-rules' && <DiscountRulesPage />}
      {view === 'reports' && <ReportsPage navigate={navigate} />}
      {view === 'users' && <UsersPage />}
    </Shell>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <Portal />
      <Toaster />
    </AppStoreProvider>
  );
}

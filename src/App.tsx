/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DriftParkProvider, useDriftPark } from './context/DriftParkContext';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { NewRentalScreen } from './screens/NewRentalScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { QueueScreen } from './screens/QueueScreen';
import { ManagementScreen } from './screens/ManagementScreen';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[DriftPark ErrorBoundary] Erro capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-full flex flex-col items-center justify-center p-6 text-center bg-[#070D1E] text-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(0,240,255,0.3)]">
            🏎️
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">Recarregando DRIFT PARK...</h2>
          <p className="text-xs text-slate-400 max-w-sm mb-5">
            Ocorreu uma pequena oscilação temporária na interface. Clique abaixo para restaurar imediatamente a tela inicial.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]"
          >
            Restaurar Sistema
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const {
    currentUser,
    activeTab,
  } = useDriftPark();

  // Active Screen Renderer
  const renderScreen = () => {
    switch (activeTab) {
      case 'inicio':
        return <DashboardScreen />;
      case 'novo':
        return <NewRentalScreen />;
      case 'historico':
        return <HistoryScreen />;
      case 'fila':
        return <QueueScreen />;
      case 'gestao':
        return <ManagementScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="min-h-screen bg-[#070D1E] text-slate-100 flex flex-col items-center justify-start p-0 selection:bg-cyan-500 selection:text-slate-950">
      {/* Main Responsive App Container */}
      <div className="w-full max-w-2xl min-h-screen flex flex-col bg-[#0B132B] shadow-2xl border-x border-slate-800/80 relative overflow-hidden">
        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {!currentUser ? (
            <LoginScreen />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* App Top Header */}
              <TopHeader />

              {/* Scrollable Screen Content */}
              <main className="flex-1 overflow-y-auto px-4 py-3.5 scroll-smooth">
                <ErrorBoundary>
                  {renderScreen()}
                </ErrorBoundary>
              </main>

              {/* Fixed Bottom Navigation (5 tabs) */}
              <BottomNav />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <DriftParkProvider>
        <AppContent />
      </DriftParkProvider>
    </ErrorBoundary>
  );
}

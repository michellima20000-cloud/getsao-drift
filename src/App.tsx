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
      {/* Main Responsive App Container (Mobile, Tablet, Desktop) */}
      <div className="w-full max-w-2xl md:max-w-3xl min-h-screen flex flex-col bg-[#0B132B] shadow-2xl border-x border-slate-800/80 relative overflow-hidden">
        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {!currentUser ? (
            <LoginScreen />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* App Top Header */}
              <TopHeader />

              {/* Scrollable Screen Content with bottom padding to avoid nav overlap */}
              <main className="flex-1 overflow-y-auto px-4 py-3.5 pb-24 scroll-smooth">
                {renderScreen()}
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
    <DriftParkProvider>
      <AppContent />
    </DriftParkProvider>
  );
}

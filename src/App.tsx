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
import { FlutterCodeViewerModal } from './components/FlutterCodeViewerModal';
import { Wifi, BatteryMedium, Signal, Sparkles, Code2, Smartphone } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentUser,
    activeTab,
    isDeviceFrame,
    setIsDeviceFrame,
    isCodeModalOpen,
    setIsCodeModalOpen,
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
    <div className="min-h-screen bg-[#070D1E] text-slate-100 flex flex-col items-center justify-center p-0 sm:p-4 selection:bg-cyan-500 selection:text-slate-950">
      {/* Main Container: Either Phone Mockup Frame or Full Width */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col ${
          isDeviceFrame
            ? 'max-w-[420px] h-[92vh] max-h-[890px] rounded-[44px] border-[10px] border-[#1C2541] shadow-[0_0_50px_rgba(0,0,0,0.8),0_0_30px_rgba(0,180,216,0.15)] overflow-hidden bg-[#0B132B]'
            : 'max-w-2xl min-h-screen sm:min-h-[90vh] sm:rounded-2xl border border-slate-800 bg-[#0B132B] shadow-2xl overflow-hidden'
        }`}
      >
        {/* Android / Phone Status Bar (Exact replica of top of screenshot: 3:12 with camera punch-hole) */}
        {isDeviceFrame && (
          <div className="sticky top-0 z-50 bg-[#0B132B] px-6 pt-3 pb-1 flex items-center justify-between text-xs text-slate-400 select-none">
            {/* Time */}
            <span className="font-semibold text-[11px] text-slate-300 tracking-tight">
              3:12
            </span>

            {/* Camera Punch Hole */}
            <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            </div>

            {/* Status Icons */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <Signal size={12} />
              <Wifi size={12} />
              <BatteryMedium size={14} />
            </div>
          </div>
        )}

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
                {renderScreen()}
              </main>

              {/* Fixed Bottom Navigation (5 tabs) */}
              <BottomNav />
            </div>
          )}
        </div>
      </div>

      {/* Floating Flutter Code Viewer Modal */}
      <FlutterCodeViewerModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
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

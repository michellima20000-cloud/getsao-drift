import React from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Gauge, PlusCircle, History, Users, ShieldCheck } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, queue, currentUser } = useDriftPark();

  const waitingCount = queue.filter((q) => q.status === 'aguardando').length;

  const tabs = [
    {
      id: 'inicio' as const,
      label: 'Início',
      icon: Gauge,
    },
    {
      id: 'novo' as const,
      label: 'Partida',
      icon: PlusCircle,
      highlight: true,
    },
    {
      id: 'historico' as const,
      label: 'Histórico',
      icon: History,
    },
    {
      id: 'fila' as const,
      label: 'Fila',
      icon: Users,
      badge: waitingCount > 0 ? waitingCount : undefined,
    },
    {
      id: 'gestao' as const,
      label: 'Gestão',
      icon: ShieldCheck,
      adminOnly: true,
    },
  ];

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-t border-[#1C2541] px-2 py-1.5 pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-[#00F0FF] scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Highlight / Glowing aura for active tab */}
              {isActive && (
                <div className="absolute -top-1 w-8 h-1 bg-[#00F0FF] rounded-full shadow-[0_0_8px_#00F0FF]" />
              )}

              <div className="relative">
                <Icon
                  size={tab.highlight ? 24 : 22}
                  className={`transition-all duration-200 ${
                    isActive
                      ? 'stroke-[2.5px] drop-shadow-[0_0_8px_rgba(0,240,255,0.7)]'
                      : 'stroke-[1.8px]'
                  }`}
                />

                {/* Badge for Queue counter */}
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-[#00F0FF] text-[#070D1E] text-[10px] font-bold flex items-center justify-center shadow-[0_0_6px_#00F0FF]">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] font-medium tracking-tight mt-1 transition-colors ${
                  isActive ? 'text-[#00F0FF] font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>

              {/* Sub-label for Admin tag on Gestão */}
              {tab.adminOnly && currentUser?.role !== 'admin' && (
                <span className="absolute -top-0.5 right-1 text-[8px] text-amber-400/80">
                  🔒
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { SpeedometerLogo } from './SpeedometerLogo';
import {
  ChevronDown,
  LogOut,
} from 'lucide-react';

export const TopHeader: React.FC = () => {
  const {
    currentUser,
    logout,
  } = useDriftPark();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  return (
    <header className="relative z-30 bg-[#0B132B]/95 backdrop-blur-md border-b border-[#1C2541] px-4 py-2.5">
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        {/* Left: Brand Logo & Title (Fixed, no dropdown selector) */}
        <div className="flex items-center gap-2.5 px-2 py-1 select-none">
          <SpeedometerLogo size={30} />
          <div className="leading-tight">
            <div className="text-xs font-black tracking-wider text-white font-display">
              DRIFT PARK
            </div>
            <div className="text-[9px] text-cyan-400 font-semibold tracking-wide">
              Gestão de Pista
            </div>
          </div>
        </div>

        {/* Right Tools: User Menu */}
        <div className="flex items-center gap-1.5">

          {/* User Profile / Role menu */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-1.5 pl-2 pr-2 py-1 rounded-lg bg-[#141E38] hover:bg-[#1C284C] border border-slate-700/80 transition-all text-xs"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentUser?.role === 'admin'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-cyan-500 text-slate-950'
                }`}
              >
                {currentUser?.role === 'admin' ? 'A' : 'O'}
              </div>
              <span className="text-[11px] font-medium text-slate-200 hidden sm:inline max-w-[80px] truncate">
                {currentUser?.name || 'Conta'}
              </span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-[#0F172A] border border-cyan-500/30 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1.5 border-b border-slate-800">
                  <div className="text-xs font-semibold text-slate-200">{currentUser?.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{currentUser?.email}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        currentUser?.role === 'admin'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}
                    >
                      {currentUser?.role === 'admin' ? '👑 Administrador' : '🏎️ Operador'}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded text-xs text-rose-300 hover:bg-rose-950/40 flex items-center gap-2"
                  >
                    <LogOut size={13} />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

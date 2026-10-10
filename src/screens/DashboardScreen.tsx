import React, { useState, useEffect } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Rental, VehicleCategory } from '../types';
import {
  Car,
  Compass,
  Zap,
  Timer,
  Play,
  CheckCircle2,
  AlertCircle,
  Plus,
  Flame,
  BatteryCharging,
  DollarSign,
  Users,
  Ban,
  Trash2,
  X,
  Volume2,
} from 'lucide-react';

export const DashboardScreen: React.FC = () => {
  const {
    currentUser,
    currentTenant,
    vehicles,
    rentals,
    queue,
    setActiveTab,
    finishRental,
    cancelRental,
    deleteRental,
    extendRental,
    playSound,
  } = useDriftPark();

  // Active races
  const activeRentals = rentals.filter((r) => r.status === 'ativa');

  // Free vehicles count
  const freeVehicles = vehicles.filter((v) => v.status === 'disponivel');
  const inUseVehicles = vehicles.filter((v) => v.status === 'em_uso');

  // Categories breakdown
  const driftCount = vehicles.filter((v) => v.category === 'DRIFT').length;
  const driftFree = vehicles.filter((v) => v.category === 'DRIFT' && v.status === 'disponivel').length;

  const jeepCount = vehicles.filter((v) => v.category === 'JEEP').length;
  const jeepFree = vehicles.filter((v) => v.category === 'JEEP' && v.status === 'disponivel').length;

  const bumpCount = vehicles.filter((v) => v.category === 'BATE_BATE').length;
  const bumpFree = vehicles.filter((v) => v.category === 'BATE_BATE' && v.status === 'disponivel').length;

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    let period = 'Bom dia';
    if (hour >= 12 && hour < 18) period = 'Boa tarde';
    if (hour >= 18 || hour < 5) period = 'Boa noite';

    if (currentUser?.role === 'admin') {
      return `${period}, Admin ${currentUser.name.split(' ')[0]}!`;
    }
    return `${period}, Operador ${currentUser?.name ? currentUser.name.split(' ')[0] : ''}!`;
  };

  // Today's revenue calculation
  const todayRevenue = rentals
    .filter((r) => {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today && r.paymentStatus === 'PAGO';
    })
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-5 pb-6">
      {/* 1. Dynamic Greeting Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>{getGreeting()}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pista em operação · {activeRentals.length} carrinho(s) em pista
          </p>
        </div>

        <button
          onClick={() => setActiveTab('novo')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00B4D8] hover:bg-[#48CAE4] text-[#070D1E] text-xs font-bold shadow-[0_0_15px_rgba(0,180,216,0.4)] transition-all hover:scale-105"
        >
          <Play size={14} className="fill-current" />
          <span>Alugar</span>
        </button>
      </div>

      {/* 2. Frota Total Card (As specified in prompt: "FROTA TOTAL (X livres)") */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141E38] to-[#0F172A] border border-cyan-500/30 p-4 shadow-lg">
        {/* Neon accent corner */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Car size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                Status da Pista
              </span>
              <h3 className="text-sm font-bold text-white">
                FROTA TOTAL ({freeVehicles.length} livres)
              </h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-cyan-300 font-display">
              {vehicles.length}
            </span>
            <span className="text-xs text-slate-400 block -mt-1">veículos</span>
          </div>
        </div>

        {/* Progress bar of fleet availability */}
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-4 border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-[#00F0FF] rounded-full transition-all duration-500 shadow-[0_0_8px_#00F0FF]"
            style={{
              width: `${vehicles.length > 0 ? (freeVehicles.length / vehicles.length) * 100 : 0}%`,
            }}
          />
        </div>

        {/* Categories Badges as specified in prompt (DRIFT - 6, JEEP - 3, BATE-BATE - 4) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Drift Category */}
          <div className="bg-[#0B132B]/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1">
              <Flame size={12} className="text-cyan-400" />
              <span>DRIFT - {driftCount}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {driftFree} disponível(is)
            </span>
          </div>

          {/* Jeep Category */}
          <div className="bg-[#0B132B]/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
              <Compass size={12} className="text-emerald-400" />
              <span>JEEP - {jeepCount}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {jeepFree} disponível(is)
            </span>
          </div>

          {/* Bate-Bate Category */}
          <div className="bg-[#0B132B]/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">
              <Zap size={12} className="text-amber-400" />
              <span>BATE - {bumpCount}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {bumpFree} disponível(is)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Quick Stats Ribbon */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-[#141E38]/80 border border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Faturamento
          </div>
          {currentUser?.role === 'admin' ? (
            <div className="text-sm font-extrabold text-emerald-400 font-display mt-0.5">
              R$ {todayRevenue.toFixed(2)}
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400 font-display mt-1 flex items-center justify-center gap-1">
              <span className="text-amber-400">🔒</span>
              <span className="text-[10px] text-slate-400">Restrito</span>
            </div>
          )}
        </div>

        <div className="p-2.5 rounded-xl bg-[#141E38]/80 border border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Em Pista
          </div>
          <div className="text-sm font-extrabold text-cyan-300 font-display mt-0.5">
            {inUseVehicles.length} carrinhos
          </div>
        </div>

        <button
          onClick={() => setActiveTab('fila')}
          className="p-2.5 rounded-xl bg-[#141E38]/80 border border-slate-800 hover:border-cyan-500/40 transition-colors text-left sm:text-center"
        >
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Fila Espera
          </div>
          <div className="text-sm font-extrabold text-cyan-400 font-display mt-0.5 flex items-center justify-center gap-1">
            <Users size={12} />
            <span>{queue.length} pessoas</span>
          </div>
        </button>
      </div>

      {/* 4. Live Telemetry / Corridas em Andamento */}
      <div className="space-y-3">
        {/* Banner de Alerta Sonoro de Fim de Corrida */}
        {activeRentals.some((r) => r.endTime <= Date.now()) && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-950/90 to-red-900/90 border-2 border-rose-500 shadow-[0_0_25px_rgba(225,29,72,0.4)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-300 text-lg font-black shrink-0">
                🚨
              </div>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Corrida Terminada na Pista!
                </h4>
                <p className="text-[11px] text-rose-200">
                  {activeRentals.filter((r) => r.endTime <= Date.now()).map((r) => `${r.vehicleCode} (${r.customerName})`).join(', ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => playSound('finish')}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-rose-400 text-rose-200 text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                title="Tocar a sirene de corrida em volume alto"
              >
                <Volume2 size={15} />
                <span>Tocar Sirene 🔊</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  activeRentals.filter((r) => r.endTime <= Date.now()).forEach((r) => finishRental(r.id));
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md transition-all flex items-center gap-1 active:scale-95"
              >
                <CheckCircle2 size={15} />
                <span>Finalizar</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-neon-pulse" />
            Telemetria em Tempo Real ({activeRentals.length} na pista)
          </h3>
          <span className="text-[10px] text-cyan-400/80 font-mono">LIVE GPS</span>
        </div>

        {activeRentals.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#141E38]/40 border border-dashed border-slate-800 text-center">
            <Timer size={28} className="mx-auto text-slate-600 mb-2" />
            <div className="text-sm font-semibold text-slate-300">Nenhum carrinho na pista no momento</div>
            <p className="text-xs text-slate-500 mt-1">
              Inicie um novo aluguel para acompanhar o cronômetro ao vivo.
            </p>
            <button
              onClick={() => setActiveTab('novo')}
              className="mt-3 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              Iniciar Primeiro Aluguel
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeRentals.map((rental) => (
              <ActiveRentalCard
                key={rental.id}
                rental={rental}
                isAdmin={currentUser?.role === 'admin' || true}
                onFinish={() => finishRental(rental.id)}
                onCancel={() => cancelRental(rental.id)}
                onDelete={() => deleteRental(rental.id)}
                onExtend={() => extendRental(rental.id, 5, 12)}
                onPlaySound={() => playSound('finish')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for individual active race card with live countdown & admin race controls
const ActiveRentalCard: React.FC<{
  rental: Rental;
  isAdmin?: boolean;
  onFinish: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onExtend: () => void;
  onPlaySound: () => void;
}> = ({ rental, isAdmin, onFinish, onCancel, onDelete, onExtend, onPlaySound }) => {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() =>
    Math.max(0, rental.endTime - Date.now())
  );
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'delete' | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, rental.endTime - Date.now());
      setTimeLeftMs(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [rental.endTime]);

  const totalDurationMs = rental.durationMinutes * 60 * 1000;
  const elapsedMs = totalDurationMs - timeLeftMs;
  const percentElapsed = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));

  const minutes = Math.floor(timeLeftMs / (1000 * 60));
  const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = timeLeftMs < 60 * 1000 && timeLeftMs > 0;
  const isFinished = timeLeftMs === 0;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3.5 transition-all ${
        isFinished
          ? 'bg-rose-950/30 border-rose-500/50'
          : isUrgent
          ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
          : 'bg-[#141E38] border-cyan-500/40 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold font-display text-sm shrink-0">
            {rental.vehicleCode}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-tight">
                {rental.vehicleName}
              </h4>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 font-semibold border border-cyan-500/30">
                {rental.vehicleCategory}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-medium">
              Piloto: <strong className="text-slate-100">{rental.customerName}</strong>
            </div>
          </div>
        </div>

        {/* Right: Live Countdown Badge */}
        <div className="text-right">
          <div
            className={`text-lg font-black font-mono-numbers tracking-wider ${
              isFinished
                ? 'text-rose-400'
                : isUrgent
                ? 'text-amber-400 animate-pulse'
                : 'text-[#00F0FF] glow-cyan-text'
            }`}
          >
            {isFinished ? 'TEMPO ESGOTADO' : formattedTime}
          </div>
          <span className="text-[10px] text-slate-400 block -mt-1">
            {rental.durationMinutes} min contratados
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
        <div
          className={`h-full transition-all duration-1000 ${
            isFinished
              ? 'bg-rose-500'
              : isUrgent
              ? 'bg-amber-400'
              : 'bg-gradient-to-r from-cyan-400 to-[#00F0FF]'
          }`}
          style={{ width: `${percentElapsed}%` }}
        />
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>{rental.paymentMethod}</span>
          <span>·</span>
          <span
            className={`font-semibold ${
              rental.paymentStatus === 'PAGO' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {rental.paymentStatus === 'PAGO' ? 'Pago' : 'Não Pago'}
          </span>
          <span>·</span>
          <span>R$ {rental.amount.toFixed(2)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {isFinished && (
            <button
              onClick={onPlaySound}
              className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/50 transition-colors flex items-center gap-1"
              title="Tocar a sirene de fim de corrida novamente"
            >
              <Volume2 size={12} />
              <span>Sirene 🔊</span>
            </button>
          )}

          <button
            onClick={onExtend}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 transition-colors"
            title="Adicionar mais 5 minutos de corrida"
          >
            + 5 min
          </button>

          {/* Finalizar Corrida */}
          <button
            onClick={onFinish}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 transition-colors flex items-center gap-1"
            title="Finalizar corrida agora e liberar o veículo"
          >
            <CheckCircle2 size={12} />
            <span>Finalizar</span>
          </button>

          {/* Domínio do Administrador: Anular e Excluir corrida */}
          {isAdmin && (
            <>
              {/* Anular Corrida */}
              <button
                onClick={() => setConfirmAction('cancel')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 transition-colors flex items-center gap-1"
                title="Anular corrida e liberar o veículo"
              >
                <Ban size={12} />
                <span>Anular</span>
              </button>

              {/* Excluir Corrida */}
              <button
                onClick={() => setConfirmAction('delete')}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/40 transition-colors flex items-center gap-1"
                title="Excluir corrida completamente do sistema"
              >
                <Trash2 size={12} />
                <span>Excluir</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Confirmação Inline de Ação Administrativa */}
      {confirmAction && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900/95 border border-slate-700 flex items-center justify-between gap-2 text-xs animate-fadeIn">
          <span className="text-slate-200 font-medium">
            {confirmAction === 'cancel'
              ? 'Deseja realmente ANULAR esta corrida?'
              : 'Deseja realmente EXCLUIR este registro?'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                if (confirmAction === 'cancel') onCancel();
                if (confirmAction === 'delete') onDelete();
                setConfirmAction(null);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold text-white transition-all ${
                confirmAction === 'cancel' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              Sim, confirmar
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

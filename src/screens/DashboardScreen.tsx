import React, { useState, useEffect } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Rental, Vehicle, VehicleCategory, PaymentMethod, PaymentStatus } from '../types';
import {
  Car,
  Compass,
  Zap,
  Timer,
  Play,
  Pause,
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
  VolumeX,
  CreditCard,
  Banknote,
  ZoomIn,
  Maximize2,
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
    pauseRental,
    resumeRental,
    extendRental,
    playSound,
    isAlarmMuted,
    toggleAlarmMute,
  } = useDriftPark();

  // Active & Paused races on track
  const activeRentals = rentals.filter((r) => r.status === 'ativa' || r.status === 'pausada');

  // Modal para conferência de pagamento e finalização manual
  const [rentalToFinalize, setRentalToFinalize] = useState<Rental | null>(null);
  const [finalizePaymentMethod, setFinalizePaymentMethod] = useState<PaymentMethod>('PIX');
  const [finalizePaymentStatus, setFinalizePaymentStatus] = useState<PaymentStatus>('PAGO');

  // Modal de Foto Ampliada / Zoom em Alta Resolução
  const [zoomedPhoto, setZoomedPhoto] = useState<{
    url: string;
    title: string;
    code?: string;
    category?: string;
  } | null>(null);

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
      return (
        new Date(r.createdAt).toDateString() === today &&
        r.status === 'concluida' &&
        r.paymentStatus === 'PAGO'
      );
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
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-neon-pulse" />
            Telemetria em Tempo Real ({activeRentals.length} na pista{activeRentals.some((r) => r.status === 'pausada') ? ` · ${activeRentals.filter((r) => r.status === 'pausada').length} pausada` : ''})
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
                vehicle={vehicles.find((v) => v.id === rental.vehicleId)}
                isAdmin={currentUser?.role === 'admin' || true}
                isAlarmMuted={isAlarmMuted}
                onToggleMute={toggleAlarmMute}
                onOpenFinalize={() => {
                  setRentalToFinalize(rental);
                  setFinalizePaymentMethod(rental.paymentMethod);
                  setFinalizePaymentStatus(rental.paymentStatus);
                }}
                onZoomPhoto={(data) => setZoomedPhoto(data)}
                onCancel={() => cancelRental(rental.id)}
                onDelete={() => deleteRental(rental.id)}
                onPause={() => pauseRental(rental.id)}
                onResume={() => resumeRental(rental.id)}
                onExtend={() => extendRental(rental.id, 5, 12)}
                onPlaySound={() => playSound('finish')}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Finalização de Corrida com Foto do Carrinho em Alta Resolução e Conferência de Pagamento */}
      {rentalToFinalize && (() => {
        const matchingVehicle = vehicles.find((v) => v.id === rentalToFinalize.vehicleId);
        const modalCarImg = matchingVehicle?.imageUrl || rentalToFinalize.vehicleImageUrl;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                    🏁
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Finalizar Corrida na Pista</h3>
                    <p className="text-[10px] text-slate-400">Liberar carrinho e salvar no histórico</p>
                  </div>
                </div>
                <button
                  onClick={() => setRentalToFinalize(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Card Destaque com Foto Ampliada e Clara do Carrinho */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#141E38] to-[#0D1527] border-2 border-cyan-500/40 flex items-center gap-3.5 shadow-lg">
                {/* Foto Grande do Carrinho com Clique para Ampliar */}
                <div
                  onClick={() => {
                    if (modalCarImg) {
                      setZoomedPhoto({
                        url: modalCarImg,
                        title: rentalToFinalize.vehicleName,
                        code: rentalToFinalize.vehicleCode,
                        category: rentalToFinalize.vehicleCategory,
                      });
                    }
                  }}
                  className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-400/60 shrink-0 flex items-center justify-center shadow-md group ${
                    modalCarImg ? 'cursor-pointer hover:border-cyan-300' : ''
                  }`}
                  title={modalCarImg ? 'Clique para ampliar foto' : undefined}
                >
                  {modalCarImg ? (
                    <>
                      <img
                        src={modalCarImg}
                        alt={rentalToFinalize.vehicleName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                        <ZoomIn size={10} />
                        <span>Ver</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-1">
                      <span className="text-2xl">🏎️</span>
                      <span className="text-[10px] font-bold text-cyan-300 font-mono mt-0.5">
                        {rentalToFinalize.vehicleCode}
                      </span>
                    </div>
                  )}

                  {/* Badge do Código no topo */}
                  <div className="absolute top-1 left-1 bg-black/85 px-1.5 py-0.5 rounded text-[9px] font-mono font-black text-cyan-300 border border-cyan-500/40">
                    {rentalToFinalize.vehicleCode}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                      {rentalToFinalize.vehicleCode}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                      {rentalToFinalize.vehicleCategory}
                    </span>
                  </div>
                  <h4 className="text-sm font-extrabold text-white truncate">{rentalToFinalize.vehicleName}</h4>
                  <div className="text-xs text-slate-300">
                    Piloto: <strong className="text-white font-bold">{rentalToFinalize.customerName}</strong>
                  </div>
                  <div className="text-xs text-cyan-300 font-bold">
                    Tempo: {rentalToFinalize.durationMinutes} min · Total: R$ {rentalToFinalize.amount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Seção de Conferência / Recebimento de Pagamento */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                    1. Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['PIX', 'CARTAO', 'DINHEIRO'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setFinalizePaymentMethod(method)}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                          finalizePaymentMethod === method
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-extrabold'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span>{method}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">
                    2. Status do Pagamento (A pessoa já pagou ou vai pagar depois?)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFinalizePaymentStatus('PAGO')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        finalizePaymentStatus === 'PAGO'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <CheckCircle2 size={15} />
                      <span>✓ PAGO AGORA</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFinalizePaymentStatus('NAO_PAGO')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        finalizePaymentStatus === 'NAO_PAGO'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <AlertCircle size={15} />
                      <span>⚠ PAGAR DEPOIS</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRentalToFinalize(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    finishRental(rentalToFinalize.id, finalizePaymentMethod, finalizePaymentStatus);
                    setRentalToFinalize(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Finalizar e Salvar</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL LIGHTBOX: FOTO AMPLIADA EM ALTA RESOLUÇÃO */}
      {zoomedPhoto && (
        <div
          onClick={() => setZoomedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#0F172A] border-2 border-cyan-400/60 p-4 shadow-2xl space-y-3 relative"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {zoomedPhoto.code && (
                  <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                    {zoomedPhoto.code}
                  </span>
                )}
                <h3 className="text-sm font-extrabold text-white truncate">{zoomedPhoto.title}</h3>
                {zoomedPhoto.category && (
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded">
                    {zoomedPhoto.category}
                  </span>
                )}
              </div>
              <button
                onClick={() => setZoomedPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Imagem em Tamanho Real / Nítida */}
            <div className="relative rounded-xl overflow-hidden bg-black/80 flex items-center justify-center max-h-[70vh] border border-slate-800">
              <img
                src={zoomedPhoto.url}
                alt={zoomedPhoto.title}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
              <span>Foto do veículo na frota</span>
              <button
                type="button"
                onClick={() => setZoomedPhoto(null)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                Fechar Foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual active race card with live countdown, car photo & race controls
const ActiveRentalCard: React.FC<{
  rental: Rental;
  vehicle?: Vehicle;
  isAdmin?: boolean;
  isAlarmMuted?: boolean;
  onToggleMute?: () => void;
  onOpenFinalize: () => void;
  onZoomPhoto: (data: { url: string; title: string; code?: string; category?: string }) => void;
  onCancel: () => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onExtend: () => void;
  onPlaySound: () => void;
}> = ({
  rental,
  vehicle,
  isAdmin,
  isAlarmMuted,
  onToggleMute,
  onOpenFinalize,
  onZoomPhoto,
  onCancel,
  onDelete,
  onPause,
  onResume,
  onExtend,
  onPlaySound,
}) => {
  const [now, setNow] = useState<number>(() => Date.now());
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'delete' | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const isPaused = rental.status === 'pausada';
  const timeLeftMs = isPaused
    ? (rental.remainingTimeMs ?? Math.max(0, rental.endTime - (rental.pausedAt || now)))
    : Math.max(0, rental.endTime - now);
  const isFinished = !isPaused && now >= rental.endTime;
  const overtimeMs = !isPaused ? Math.max(0, now - rental.endTime) : 0;

  const totalDurationMs = rental.durationMinutes * 60 * 1000;
  const elapsedMs = totalDurationMs - timeLeftMs;
  const percentElapsed = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));

  const minutes = Math.floor(timeLeftMs / (1000 * 60));
  const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const overtimeMin = Math.floor(overtimeMs / (1000 * 60));
  const overtimeSec = Math.floor((overtimeMs % (1000 * 60)) / 1000);
  const formattedOvertime = `+${String(overtimeMin).padStart(2, '0')}:${String(overtimeSec).padStart(2, '0')}`;

  const isUrgent = timeLeftMs < 60 * 1000 && !isFinished && !isPaused;

  const carImageUrl = vehicle?.imageUrl || rental.vehicleImageUrl;
  const categoryEmoji =
    rental.vehicleCategory === 'DRIFT' ? '🏎️' : rental.vehicleCategory === 'JEEP' ? '🚙' : '⚡';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-3.5 sm:p-4 transition-all ${
        isFinished
          ? 'bg-rose-950/40 border-2 border-rose-500 shadow-[0_0_25px_rgba(225,29,72,0.4)]'
          : isPaused
          ? 'bg-amber-950/30 border-2 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          : isUrgent
          ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
          : 'bg-[#141E38] border-cyan-500/40 shadow-sm'
      }`}
    >
      {/* Alerta Destacado quando a Corrida Está Pausada */}
      {isPaused && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-950/90 via-amber-900/70 to-amber-950/90 border border-amber-500/70 flex items-center justify-between text-amber-200 text-xs font-bold animate-pulse shadow-md">
          <div className="flex items-center gap-2">
            <Pause size={15} className="text-amber-400" />
            <span className="font-extrabold text-white">CORRIDA PAUSADA · CRONÔMETRO CONGELADO</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-900/80 px-2 py-0.5 rounded border border-amber-500/50 text-amber-200">
            Pausa Simples
          </span>
        </div>
      )}

      {/* Alerta Destacado quando a Corrida Termina na Pista */}
      {isFinished && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border border-rose-500/70 flex items-center justify-between text-rose-200 text-xs font-bold animate-pulse shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-base">🏁</span>
            <span className="font-extrabold text-white">CORRIDA ENCERRADA · VEÍCULO FINALIZANDO NA PISTA</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-900/80 px-2 py-0.5 rounded border border-rose-500/50 text-rose-200">
            Identifique pela foto
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Info com Foto do Carrinho em Destaque Grande e Nítido */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Frame Grande da Foto do Carrinho */}
          <div
            onClick={() => {
              if (carImageUrl) {
                onZoomPhoto({
                  url: carImageUrl,
                  title: rental.vehicleName,
                  code: rental.vehicleCode,
                  category: rental.vehicleCategory,
                });
              }
            }}
            className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center transition-all group shadow-md ${
              carImageUrl ? 'cursor-pointer' : ''
            } ${
              isFinished
                ? 'border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)] ring-2 ring-rose-500/30'
                : 'border-2 border-cyan-500/40 bg-slate-900 hover:border-cyan-400'
            }`}
            title={carImageUrl ? 'Clique para ver foto em tamanho grande' : undefined}
          >
            {carImageUrl ? (
              <img
                src={carImageUrl}
                alt={rental.vehicleName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}

            {/* Fallback caso não haja foto */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center text-center p-1 bg-gradient-to-br from-[#1C2541] to-[#0B132B] ${
                carImageUrl ? '-z-10' : ''
              }`}
            >
              <span className="text-2xl leading-none">{categoryEmoji}</span>
              <span className="text-xs font-black text-cyan-300 font-mono mt-1">
                {rental.vehicleCode}
              </span>
            </div>

            {/* Badge do Código do Carrinho no canto superior (sem tampar a foto) */}
            <div className="absolute top-1.5 left-1.5 bg-black/85 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-cyan-500/40 shadow">
              <span className="text-[10px] font-black text-cyan-300 font-mono leading-none">
                {rental.vehicleCode}
              </span>
            </div>

            {/* Botão de Lupa/Ampliar foto no canto inferior direito */}
            {carImageUrl && (
              <div className="absolute bottom-1.5 right-1.5 bg-black/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-cyan-500/40 text-[9px] font-bold flex items-center gap-1 shadow opacity-90 group-hover:opacity-100 transition-all">
                <ZoomIn size={10} />
                <span>Ver</span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded-lg border border-cyan-500/30 shrink-0">
                {rental.vehicleCode}
              </span>
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700">
                {rental.vehicleCategory}
              </span>
              <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
                {rental.vehicleName}
              </h4>
            </div>

            <div className="text-xs text-slate-300 font-medium">
              Piloto: <strong className="text-white font-bold">{rental.customerName}</strong>
            </div>

            <div className="text-[11px] text-slate-400">
              Tempo: <strong className="text-cyan-300">{rental.durationMinutes} min</strong> · Valor: <strong className="text-emerald-400">R$ {rental.amount.toFixed(2)}</strong>
            </div>

            {isFinished ? (
              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-black animate-pulse">
                  <span>🚨 TEMPO ESGOTADO</span>
                  <span>·</span>
                  <span>Liberar na pista</span>
                </span>
              </div>
            ) : isPaused ? (
              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold">
                  <Pause size={12} />
                  <span>Corrida Pausada</span>
                </span>
              </div>
            ) : isUrgent ? (
              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <span>⚠️ Menos de 1 minuto restante</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Lado Direito: Cronômetro / Tempo */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
          <div className="text-left sm:text-right">
            <div
              className={`font-mono-numbers font-black tracking-wider text-xl sm:text-2xl ${
                isFinished
                  ? 'text-rose-400 animate-pulse'
                  : isPaused
                  ? 'text-amber-400'
                  : isUrgent
                  ? 'text-amber-400 animate-pulse'
                  : 'text-[#00F0FF] glow-cyan-text'
              }`}
            >
              {isFinished ? '00:00' : formattedTime}
            </div>
            <span className="text-[10px] text-slate-400 block -mt-0.5">
              {isFinished ? (
                <span className="text-rose-300 font-bold font-mono">Passou {formattedOvertime}</span>
              ) : isPaused ? (
                <span className="text-amber-400 font-semibold font-mono">Pausado (congelado)</span>
              ) : (
                'Tempo restante'
              )}
            </span>
          </div>
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
            <>
              {onToggleMute && (
                <button
                  onClick={onToggleMute}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isAlarmMuted
                      ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                  title={isAlarmMuted ? 'Sirene silenciada. Clique para reativar o som.' : 'Silenciar o alarme sonoro'}
                >
                  {isAlarmMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>{isAlarmMuted ? 'Mudo' : 'Silenciar'}</span>
                </button>
              )}

              <button
                onClick={onPlaySound}
                className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/50 transition-colors flex items-center gap-1"
                title="Tocar a sirene de fim de corrida novamente"
              >
                <Volume2 size={12} />
                <span>Sirene 🔊</span>
              </button>
            </>
          )}

          {/* Botão simples de Pausa/Retorno: só clicar e pausar/retomar */}
          {isPaused ? (
            <button
              onClick={onResume}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              title="Retomar a corrida na pista"
            >
              <Play size={13} className="fill-current" />
              <span>Retomar Corrida</span>
            </button>
          ) : !isFinished ? (
            <button
              onClick={onPause}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-all flex items-center gap-1.5 active:scale-95"
              title="Pausar o tempo da corrida"
            >
              <Pause size={13} />
              <span>Pausar</span>
            </button>
          ) : null}

          <button
            onClick={onExtend}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 transition-colors"
            title="Adicionar mais 5 minutos de corrida"
          >
            + 5 min
          </button>

          {/* Finalizar Corrida (Abre modal de pagamento/conferência) */}
          <button
            onClick={onOpenFinalize}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-md ${
              isFinished
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
            }`}
            title="Finalizar corrida, conferir pagamento e liberar o carrinho"
          >
            <CheckCircle2 size={14} />
            <span>Finalizar Corrida</span>
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

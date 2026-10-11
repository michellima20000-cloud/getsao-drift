import React, { useState, useEffect } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import {
  VehicleCategory,
  PaymentMethod,
  PaymentStatus,
  RentalMode,
  Vehicle,
} from '../types';
import {
  Car,
  Clock,
  DollarSign,
  Flame,
  Compass,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  QrCode,
  CreditCard,
  Banknote,
  Sparkles,
  X,
} from 'lucide-react';

export const NewRentalScreen: React.FC = () => {
  const {
    currentTenant,
    vehicles,
    startRental,
    setActiveTab,
    prefilledQueueItem,
    setPrefilledQueueItem,
    playSound,
  } = useDriftPark();

  // Mode Selection: "Aluguel Padrão", "Agendado", "Manual"
  const [mode, setMode] = useState<RentalMode>('padrao');

  // Vehicle Category filter
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | 'TODOS'>('TODOS');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  // Duration & Pricing
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [manualCustomPrice, setManualCustomPrice] = useState<string>('25.00');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PAGO');

  // Feedback message
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Countdown state (Contagem regressiva 3, 2, 1, LARGADA)
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownStep, setCountdownStep] = useState<number | 'LARGADA'>(3);
  const timersRef = React.useRef<NodeJS.Timeout[]>([]);

  // Prefill if coming from Queue
  useEffect(() => {
    if (prefilledQueueItem) {
      setSelectedCategory(prefilledQueueItem.categoryDesired);
      setDurationMinutes(prefilledQueueItem.durationMinutes || 10);
    }
  }, [prefilledQueueItem]);

  // Available vehicles
  const availableVehicles = vehicles.filter(
    (v) =>
      v.status === 'disponivel' &&
      (selectedCategory === 'TODOS' || v.category === selectedCategory)
  );

  // Auto-select first available vehicle if none or currently selected is invalid
  useEffect(() => {
    if (!selectedVehicleId && availableVehicles.length > 0) {
      setSelectedVehicleId(availableVehicles[0].id);
    } else if (
      selectedVehicleId &&
      !availableVehicles.some((v) => v.id === selectedVehicleId)
    ) {
      setSelectedVehicleId(availableVehicles[0]?.id || '');
    }
  }, [availableVehicles, selectedVehicleId]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  // Price calculation
  const calculatedPrice =
    mode === 'manual'
      ? parseFloat(manualCustomPrice) || 0
      : currentTenant.pricing[durationMinutes] || (durationMinutes * 2.5);

  const durationOptions = [5, 10, 15, 20, 30];

  const executeRentalStart = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setIsCountingDown(false);

    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const rentalId = startRental({
      vehicleId: selectedVehicleId,
      customerName: prefilledQueueItem?.customerName || (vehicle ? `Piloto ${vehicle.code}` : 'Piloto da Pista'),
      customerPhone: prefilledQueueItem?.customerPhone || '-',
      durationMinutes,
      amount: calculatedPrice,
      paymentMethod,
      paymentStatus,
      mode,
    });

    if (rentalId) {
      setPrefilledQueueItem(null);
      setErrorMsg('');
      setActiveTab('inicio');
    }
  };

  const handleStart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedVehicleId) {
      setErrorMsg('Selecione um carrinho disponível para iniciar a corrida.');
      return;
    }
    setErrorMsg('');

    // Inicia a contagem regressiva oficial com luzes e som
    setIsCountingDown(true);
    setCountdownStep(3);
    playSound('countdown_beep');

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const t1 = setTimeout(() => {
      setCountdownStep(2);
      playSound('countdown_beep');
    }, 900);

    const t2 = setTimeout(() => {
      setCountdownStep(1);
      playSound('countdown_beep');
    }, 1800);

    const t3 = setTimeout(() => {
      setCountdownStep('LARGADA');
      playSound('countdown_go');
    }, 2700);

    const t4 = setTimeout(() => {
      executeRentalStart();
    }, 3600);

    timersRef.current = [t1, t2, t3, t4];
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Modalidade Tabs no Topo */}
      <div>
        <div className="flex items-center p-1 bg-[#141E38] rounded-xl border border-slate-700/80">
          <button
            type="button"
            onClick={() => setMode('padrao')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'padrao'
                ? 'bg-cyan-500 text-[#070D1E] shadow-[0_0_10px_rgba(0,180,216,0.3)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Aluguel Padrão
          </button>
          <button
            type="button"
            onClick={() => setMode('agendado')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'agendado'
                ? 'bg-cyan-500 text-[#070D1E] shadow-[0_0_10px_rgba(0,180,216,0.3)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Agendado
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'manual'
                ? 'bg-cyan-500 text-[#070D1E] shadow-[0_0_10px_rgba(0,180,216,0.3)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Manual / VIP
          </button>
        </div>
      </div>

      {prefilledQueueItem && (
        <div className="p-3 rounded-xl bg-cyan-950/70 border border-cyan-400/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400" />
            <span className="text-cyan-200">
              Chamando da fila: <strong>{prefilledQueueItem.customerName}</strong>
            </span>
          </div>
          <button
            onClick={() => setPrefilledQueueItem(null)}
            className="text-[11px] text-slate-400 hover:text-white underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* 2. Seleção de Veículo & Categoria */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Car size={14} className="text-cyan-400" />
            1. Selecionar Veículo
          </label>
          <span className="text-[11px] text-cyan-400">
            {availableVehicles.length} disponível(is)
          </span>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {(['TODOS', 'DRIFT', 'JEEP', 'BATE_BATE'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,180,216,0.2)]'
                  : 'bg-[#141E38]/60 text-slate-400 border-slate-700/60 hover:border-slate-500'
              }`}
            >
              {cat === 'TODOS'
                ? 'Todos'
                : cat === 'DRIFT'
                ? '🏎️ Drift'
                : cat === 'JEEP'
                ? '🚙 Jeep'
                : '⚡ Bate-Bate'}
            </button>
          ))}
        </div>

        {/* Vehicles Horizontal List */}
        {availableVehicles.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#141E38]/40 border border-amber-500/30 text-amber-300 text-xs text-center flex items-center justify-center gap-2">
            <AlertTriangle size={16} />
            <span>Nenhum veículo livre nesta categoria. Adicione o cliente à fila de espera!</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableVehicles.map((veh) => {
              const isSelected = selectedVehicleId === veh.id;
              return (
                <button
                  key={veh.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(veh.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#1C2541] to-[#141E38] border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                      : 'bg-[#141E38]/80 border-slate-700/70 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    {/* Vehicle Category Icon or Real Photo */}
                    {veh.imageUrl ? (
                      <img
                        src={veh.imageUrl}
                        alt={veh.name}
                        className="w-8 h-8 rounded-lg object-cover border border-cyan-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 text-sm">
                        {veh.category === 'DRIFT' ? '🏎️' : veh.category === 'JEEP' ? '🚙' : '⚡'}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-cyan-400 font-display">
                          {veh.code}
                        </span>
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {veh.batteryLevel || 100}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{veh.name}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{veh.category}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{veh.totalRuns || 0} corridas</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Tempo / Duração */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-cyan-400" />
          2. Tempo da Corrida
        </label>

        <div className="grid grid-cols-5 gap-1.5">
          {durationOptions.map((min) => {
            const isSelected = durationMinutes === min;
            const price = currentTenant.pricing[min] || min * 2.5;

            return (
              <button
                key={min}
                type="button"
                onClick={() => setDurationMinutes(min)}
                className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-cyan-500 text-[#070D1E] border-cyan-300 shadow-[0_0_10px_rgba(0,180,216,0.3)] font-bold'
                    : 'bg-[#141E38]/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-xs font-extrabold">{min}m</span>
                <span className={`text-[10px] ${isSelected ? 'text-[#070D1E]' : 'text-slate-400'}`}>
                  R$ {price}
                </span>
              </button>
            );
          })}
        </div>

        {mode === 'manual' && (
          <div className="pt-1 flex items-center gap-2">
            <span className="text-xs text-slate-300">Valor customizado (VIP): R$</span>
            <input
              type="number"
              step="1"
              value={manualCustomPrice}
              onChange={(e) => setManualCustomPrice(e.target.value)}
              className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-sm text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>
        )}
      </div>

      {/* 3. Forma de Pagamento & Status (PAGO / NÃO PAGO) */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <DollarSign size={14} className="text-cyan-400" />
          3. Pagamento
        </label>

        <div className="grid grid-cols-3 gap-2">
          {/* PIX */}
          <button
            type="button"
            onClick={() => setPaymentMethod('PIX')}
            className={`py-2.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
              paymentMethod === 'PIX'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-[#141E38]/80 border-slate-700 text-slate-400'
            }`}
          >
            <QrCode size={15} />
            <span>PIX</span>
          </button>

          {/* CARTÃO */}
          <button
            type="button"
            onClick={() => setPaymentMethod('CARTAO')}
            className={`py-2.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
              paymentMethod === 'CARTAO'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,180,216,0.2)]'
                : 'bg-[#141E38]/80 border-slate-700 text-slate-400'
            }`}
          >
            <CreditCard size={15} />
            <span>Cartão</span>
          </button>

          {/* DINHEIRO */}
          <button
            type="button"
            onClick={() => setPaymentMethod('DINHEIRO')}
            className={`py-2.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
              paymentMethod === 'DINHEIRO'
                ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                : 'bg-[#141E38]/80 border-slate-700 text-slate-400'
            }`}
          >
            <Banknote size={15} />
            <span>Dinheiro</span>
          </button>
        </div>

        {/* Toggle PAGO / NÃO PAGO */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPaymentStatus('PAGO')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              paymentStatus === 'PAGO'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-[#141E38]/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 size={15} />
            <span>PAGO AGORA</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentStatus('NAO_PAGO')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              paymentStatus === 'NAO_PAGO'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'bg-[#141E38]/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle size={15} />
            <span>PAGAR DEPOIS</span>
          </button>
        </div>
      </div>

      {/* 6. Card de Resumo "Aluguel Selecionado" (As specified in prompt: exibe Tempo e Valor) */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1C2541] to-[#141E38] border border-cyan-500/40 p-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
            <Sparkles size={13} />
            Aluguel Selecionado
          </div>
          <span className="text-[11px] font-semibold text-slate-300">
            {selectedVehicle ? `${selectedVehicle.code} · ${selectedVehicle.name}` : 'Nenhum veículo'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Tempo de Pista</div>
            <div className="text-xl font-extrabold text-white font-mono-numbers">
              {durationMinutes} <span className="text-xs font-medium text-slate-400">minutos</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Valor Total</div>
            <div className="text-2xl font-black text-[#00F0FF] font-display glow-cyan-text">
              R$ {calculatedPrice.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Forma: <strong className="text-slate-200">{paymentMethod}</strong></span>
          <span
            className={`font-bold ${
              paymentStatus === 'PAGO' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {paymentStatus === 'PAGO' ? '✓ PAGO' : '⚠ PENDENTE'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs text-center font-medium">
          {errorMsg}
        </div>
      )}

      {/* 4. Botão Destacado de "Iniciar Corrida" (Glowing cyan button) */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 px-4 rounded-xl bg-[#48CAE4] hover:bg-[#00B4D8] text-[#0B132B] font-extrabold text-base tracking-wider uppercase transition-all duration-200 glow-cyan-btn hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
      >
        <Play size={20} className="fill-current" />
        <span>INICIAR CORRIDA</span>
      </button>

      {/* Contagem Regressiva Oficial de Largada */}
      {isCountingDown && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070D1E]/95 backdrop-blur-2xl p-6 text-center animate-fadeIn select-none">
          {/* Luzes de Largada (F1 Starting Lights Tree) */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0B132B] border border-cyan-500/40 shadow-[0_0_35px_rgba(0,180,216,0.3)] mb-6">
            {/* Luz 1 */}
            <div
              className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                countdownStep === 'LARGADA'
                  ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_25px_#10B981]'
                  : countdownStep === 3 || countdownStep === 2 || countdownStep === 1
                  ? 'bg-rose-600 border-rose-400 shadow-[0_0_25px_#E11D48]'
                  : 'bg-slate-800 border-slate-700'
              }`}
            />
            {/* Luz 2 */}
            <div
              className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                countdownStep === 'LARGADA'
                  ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_25px_#10B981]'
                  : countdownStep === 2 || countdownStep === 1
                  ? 'bg-rose-600 border-rose-400 shadow-[0_0_25px_#E11D48]'
                  : 'bg-slate-800 border-slate-700'
              }`}
            />
            {/* Luz 3 */}
            <div
              className={`w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                countdownStep === 'LARGADA'
                  ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_25px_#10B981]'
                  : countdownStep === 1
                  ? 'bg-rose-600 border-rose-400 shadow-[0_0_25px_#E11D48]'
                  : 'bg-slate-800 border-slate-700'
              }`}
            />
          </div>

          <div className="text-xs uppercase font-extrabold tracking-widest text-cyan-400 mb-2 font-display">
            PREPARAR PARA A PISTA
          </div>

          {/* Número Gigante da Contagem Regressiva */}
          <div className="my-3 min-h-[140px] flex items-center justify-center">
            {countdownStep === 'LARGADA' ? (
              <div className="text-5xl sm:text-7xl font-black font-display text-emerald-400 tracking-wider drop-shadow-[0_0_40px_rgba(16,185,129,0.9)] animate-pulse">
                LARGADA! 🏁
              </div>
            ) : (
              <div className="text-8xl sm:text-9xl font-black font-display text-[#00F0FF] tracking-tighter drop-shadow-[0_0_50px_rgba(0,240,255,0.9)] scale-110">
                {countdownStep}
              </div>
            )}
          </div>

          {/* Dados do Veículo */}
          <div className="mt-2 p-4 rounded-xl bg-[#141E38]/90 border border-cyan-500/30 max-w-xs w-full shadow-lg">
            <div className="text-[11px] uppercase font-bold text-slate-400">Veículo na Pista</div>
            <div className="text-base font-extrabold text-white mt-0.5">
              {selectedVehicle?.code} · {selectedVehicle?.name}
            </div>
            <div className="text-xs text-cyan-300 mt-1 font-mono">
              Tempo: {durationMinutes} min · R$ {calculatedPrice.toFixed(2)}
            </div>
          </div>

          {/* Ações da contagem */}
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                timersRef.current.forEach(clearTimeout);
                timersRef.current = [];
                setIsCountingDown(false);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-400 hover:text-white border border-slate-700 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={executeRentalStart}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(0,180,216,0.4)] transition-all hover:scale-105"
            >
              Pular e Iniciar Já ⏩
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

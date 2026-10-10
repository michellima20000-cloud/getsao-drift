import React, { useState, useMemo } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Rental, PaymentMethod, PaymentStatus, VehicleCategory } from '../types';
import {
  DollarSign,
  Download,
  Calendar,
  Clock,
  Car,
  QrCode,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Filter,
  Search,
  X,
  FileSpreadsheet,
  Trash2,
  Plus,
  Moon,
  ChevronLeft,
  ChevronRight,
  Ban,
  Sparkles,
  Flame,
  Compass,
  Zap,
} from 'lucide-react';

export const HistoryScreen: React.FC = () => {
  const {
    rentals,
    vehicles,
    currentTenant,
    exportDailyReport,
    updateRentalPayment,
    deleteRental,
    cancelRental,
    clearRentalHistory,
    addPastRental,
    addPastDaySummary,
    currentUser,
    playSound,
  } = useDriftPark();

  const isAdmin = currentUser?.role === 'admin';

  // Helper de formatação de data YYYY-MM-DD
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatYMD(today), [today]);

  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);
  const yesterdayStr = useMemo(() => formatYMD(yesterday), [yesterday]);

  const beforeYesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d;
  }, []);
  const beforeYesterdayStr = useMemo(() => formatYMD(beforeYesterday), [beforeYesterday]);

  // Modo de Filtro de Calendário: 'HOJE' | 'ONTEM' | 'ANTEONTEM' | 'DATA_ESPECIFICA' | 'MES' | 'TODAS'
  const [dateFilterMode, setDateFilterMode] = useState<
    'HOJE' | 'ONTEM' | 'ANTEONTEM' | 'DATA_ESPECIFICA' | 'MES' | 'TODAS'
  >('HOJE');

  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>(todayStr);

  // Mês e Ano selecionados para navegação
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Busca e Filtro de Status
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PAGO' | 'NAO_PAGO' | 'ANULADA'>('TODOS');

  // Modais de Criação Retroativa pelo Administrador
  const [isPastRentalModalOpen, setIsPastRentalModalOpen] = useState(false);
  const [isNightClosureModalOpen, setIsNightClosureModalOpen] = useState(false);

  // Estados do Modal "Lançar Corrida Retroativa"
  const [pastDate, setPastDate] = useState<string>(todayStr);
  const [pastTime, setPastTime] = useState<string>('20:30');
  const [pastVehicleId, setPastVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [pastDuration, setPastDuration] = useState<number>(10);
  const [pastAmount, setPastAmount] = useState<string>('25.00');
  const [pastMethod, setPastMethod] = useState<PaymentMethod>('PIX');
  const [pastStatus, setPastStatus] = useState<PaymentStatus>('PAGO');
  const [pastNotes, setPastNotes] = useState<string>('');

  // Estados do Modal "Lançar Fechamento da Noite"
  const [closureDate, setClosureDate] = useState<string>(yesterdayStr);
  const [closureShift, setClosureShift] = useState<string>('Fechamento da Noite');
  const [closureTotal, setClosureTotal] = useState<string>('');
  const [closureRuns, setClosureRuns] = useState<string>('20');
  const [closurePix, setClosurePix] = useState<string>('');
  const [closureCard, setClosureCard] = useState<string>('');
  const [closureCash, setClosureCash] = useState<string>('');
  const [closureNotes, setClosureNotes] = useState<string>('');

  // Modais de Edição e Exclusão
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethod>('PIX');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('PAGO');
  const [rentalToDelete, setRentalToDelete] = useState<Rental | null>(null);
  const [rentalToAnnul, setRentalToAnnul] = useState<Rental | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Mês em formato legível em português
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Identifica a data ativa baseada no modo
  const activeDateTarget = useMemo(() => {
    if (dateFilterMode === 'HOJE') return todayStr;
    if (dateFilterMode === 'ONTEM') return yesterdayStr;
    if (dateFilterMode === 'ANTEONTEM') return beforeYesterdayStr;
    if (dateFilterMode === 'DATA_ESPECIFICA') return selectedSpecificDate;
    return null;
  }, [dateFilterMode, todayStr, yesterdayStr, beforeYesterdayStr, selectedSpecificDate]);

  // Lista de corridas filtradas por data e critérios
  const dateScopedRentals = useMemo(() => {
    return rentals.filter((r) => {
      const rDate = new Date(r.createdAt);
      const rYMD = formatYMD(rDate);

      if (dateFilterMode === 'TODAS') return true;

      if (dateFilterMode === 'MES') {
        return rDate.getFullYear() === viewYear && rDate.getMonth() === viewMonth;
      }

      if (activeDateTarget) {
        return rYMD === activeDateTarget;
      }

      return true;
    });
  }, [rentals, dateFilterMode, activeDateTarget, viewYear, viewMonth]);

  // Resumo Financeiro da visão ativa (não computa corridas anuladas no faturamento líquido)
  const validPayingRentals = useMemo(() => {
    return dateScopedRentals.filter((r) => r.status !== 'anulada' && r.status !== 'cancelada');
  }, [dateScopedRentals]);

  const totalRevenue = useMemo(() => {
    return validPayingRentals
      .filter((r) => r.paymentStatus === 'PAGO')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [validPayingRentals]);

  const pendingAmount = useMemo(() => {
    return validPayingRentals
      .filter((r) => r.paymentStatus === 'NAO_PAGO')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [validPayingRentals]);

  const pixTotal = useMemo(() => {
    return validPayingRentals
      .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'PIX')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [validPayingRentals]);

  const cardTotal = useMemo(() => {
    return validPayingRentals
      .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'CARTAO')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [validPayingRentals]);

  const cashTotal = useMemo(() => {
    return validPayingRentals
      .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'DINHEIRO')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [validPayingRentals]);

  // Corridas finais para exibição após busca e filtro de status
  const displayedRentals = useMemo(() => {
    return dateScopedRentals.filter((r) => {
      const matchesSearch =
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.vehicleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'PAGO') {
        matchesStatus = r.paymentStatus === 'PAGO' && r.status !== 'anulada';
      } else if (statusFilter === 'NAO_PAGO') {
        matchesStatus = r.paymentStatus === 'NAO_PAGO' && r.status !== 'anulada';
      } else if (statusFilter === 'ANULADA') {
        matchesStatus = r.status === 'anulada' || r.status === 'cancelada';
      }

      return matchesSearch && matchesStatus;
    });
  }, [dateScopedRentals, searchQuery, statusFilter]);

  // Descrição do Título do Faturamento
  const getPeriodLabel = () => {
    if (dateFilterMode === 'HOJE') return 'Faturamento de Hoje';
    if (dateFilterMode === 'ONTEM') return 'Faturamento de Ontem';
    if (dateFilterMode === 'ANTEONTEM') return 'Faturamento de Anteontem';
    if (dateFilterMode === 'DATA_ESPECIFICA') {
      const [y, m, d] = selectedSpecificDate.split('-');
      return `Faturamento do Dia ${d}/${m}/${y}`;
    }
    if (dateFilterMode === 'MES') {
      return `Faturamento do Mês de ${monthNames[viewMonth]} de ${viewYear}`;
    }
    return 'Faturamento Geral Acumulado';
  };

  // Abrir Modal de Corrida Retroativa
  const handleOpenPastRentalModal = () => {
    const targetDate = activeDateTarget || todayStr;
    setPastDate(targetDate);
    setPastTime('20:30');
    if (!pastVehicleId && vehicles.length > 0) {
      setPastVehicleId(vehicles[0].id);
    }
    setPastDuration(10);
    const price = currentTenant.pricing[10] || 25;
    setPastAmount(price.toFixed(2));
    setPastMethod('PIX');
    setPastStatus('PAGO');
    setPastNotes('');
    setIsPastRentalModalOpen(true);
  };

  // Abrir Modal de Fechamento da Noite
  const handleOpenNightClosureModal = () => {
    const targetDate = activeDateTarget || yesterdayStr;
    setClosureDate(targetDate);
    setClosureShift('Fechamento da Noite');
    setClosureTotal('');
    setClosureRuns('25');
    setClosurePix('');
    setClosureCard('');
    setClosureCash('');
    setClosureNotes('');
    setIsNightClosureModalOpen(true);
  };

  // Salvar Corrida Retroativa
  const handleSavePastRental = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(pastAmount) || 0;
    if (amt <= 0) return;

    addPastRental({
      date: pastDate,
      time: pastTime,
      vehicleId: pastVehicleId || (vehicles[0]?.id || ''),
      durationMinutes: pastDuration,
      amount: amt,
      paymentMethod: pastMethod,
      paymentStatus: pastStatus,
      notes: pastNotes,
    });

    setIsPastRentalModalOpen(false);
  };

  // Salvar Fechamento da Noite
  const handleSaveNightClosure = (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(closureTotal) || 0;
    if (total <= 0) return;

    const runs = parseInt(closureRuns, 10) || 1;
    const pix = parseFloat(closurePix) || 0;
    const card = parseFloat(closureCard) || 0;
    const cash = parseFloat(closureCash) || 0;

    addPastDaySummary({
      date: closureDate,
      shiftName: closureShift,
      totalAmount: total,
      pixAmount: pix,
      cardAmount: card,
      cashAmount: cash,
      totalRuns: runs,
      notes: closureNotes,
    });

    setIsNightClosureModalOpen(false);
  };

  // Salvar Edição de Corrida
  const handleSaveEdit = () => {
    if (editingRental) {
      updateRentalPayment(editingRental.id, editMethod, editStatus);
      setEditingRental(null);
    }
  };

  // Navegar mês anterior / posterior
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
    setDateFilterMode('MES');
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
    setDateFilterMode('MES');
  };

  return (
    <div className="space-y-4 pb-8">
      {/* 1. SELETOR DE DIAS E CALENDÁRIO ("Calendariozinho do Administrador") */}
      <div className="p-3.5 rounded-2xl bg-[#141E38] border border-cyan-500/30 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Calendar size={18} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                Calendário de Corridas & Caixa
              </span>
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{monthNames[viewMonth]} de {viewYear}</span>
              </h3>
            </div>
          </div>

          {/* Navegação de Mês */}
          <div className="flex items-center gap-1 bg-[#0B132B] p-1 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setDateFilterMode('MES')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                dateFilterMode === 'MES'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Ver Mês
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Botões Rápidos: Hoje, Ontem, Anteontem, Calendário e Todas */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
          {/* HOJE */}
          <button
            type="button"
            onClick={() => setDateFilterMode('HOJE')}
            className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
              dateFilterMode === 'HOJE'
                ? 'bg-cyan-500 text-[#070D1E] border-cyan-300 shadow-[0_0_12px_rgba(0,180,216,0.3)] font-bold'
                : 'bg-[#0B132B]/80 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Hoje</span>
            <span className="text-[10px] opacity-80 font-mono">
              {today.getDate()}/{today.getMonth() + 1}
            </span>
          </button>

          {/* ONTEM */}
          <button
            type="button"
            onClick={() => setDateFilterMode('ONTEM')}
            className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
              dateFilterMode === 'ONTEM'
                ? 'bg-cyan-500 text-[#070D1E] border-cyan-300 shadow-[0_0_12px_rgba(0,180,216,0.3)] font-bold'
                : 'bg-[#0B132B]/80 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Ontem</span>
            <span className="text-[10px] opacity-80 font-mono">
              {yesterday.getDate()}/{yesterday.getMonth() + 1}
            </span>
          </button>

          {/* ANTEONTEM */}
          <button
            type="button"
            onClick={() => setDateFilterMode('ANTEONTEM')}
            className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
              dateFilterMode === 'ANTEONTEM'
                ? 'bg-cyan-500 text-[#070D1E] border-cyan-300 shadow-[0_0_12px_rgba(0,180,216,0.3)] font-bold'
                : 'bg-[#0B132B]/80 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Anteontem</span>
            <span className="text-[10px] opacity-80 font-mono">
              {beforeYesterday.getDate()}/{beforeYesterday.getMonth() + 1}
            </span>
          </button>

          {/* OUTRO DIA (DATE PICKER) */}
          <div className="relative col-span-1">
            <input
              type="date"
              value={selectedSpecificDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedSpecificDate(e.target.value);
                  setDateFilterMode('DATA_ESPECIFICA');
                }
              }}
              className={`w-full h-full py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center focus:outline-none transition-all cursor-pointer ${
                dateFilterMode === 'DATA_ESPECIFICA'
                  ? 'bg-cyan-500 text-[#070D1E] border-cyan-300 shadow-[0_0_12px_rgba(0,180,216,0.3)]'
                  : 'bg-[#0B132B]/80 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            />
          </div>

          {/* TODAS AS DATAS */}
          <button
            type="button"
            onClick={() => setDateFilterMode('TODAS')}
            className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center transition-all col-span-2 sm:col-span-1 ${
              dateFilterMode === 'TODAS'
                ? 'bg-cyan-500 text-[#070D1E] border-cyan-300 shadow-[0_0_12px_rgba(0,180,216,0.3)] font-bold'
                : 'bg-[#0B132B]/80 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Histórico</span>
            <span className="text-[10px] opacity-80">Completo</span>
          </button>
        </div>
      </div>

      {/* 2. RESUMO FINANCEIRO DINÂMICO PARA A DATA SELECIONADA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141E38] via-[#101932] to-[#0B132B] border border-cyan-500/40 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <DollarSign size={15} />
            <span>{isAdmin ? getPeriodLabel() : 'Resumo de Corridas'}</span>
          </div>

          {/* Ações Rápidas do Administrador */}
          {isAdmin ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOpenPastRentalModal}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] shadow-[0_0_10px_rgba(0,180,216,0.3)] transition-all active:scale-95"
                title="Lançar corrida manualmente para esta data"
              >
                <Plus size={13} />
                <span>+ Lançar Corrida</span>
              </button>

              <button
                onClick={handleOpenNightClosureModal}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-[11px] shadow-[0_0_10px_rgba(147,51,234,0.3)] transition-all active:scale-95"
                title="Lançar fechamento consolidado da noite/dia"
              >
                <Moon size={13} />
                <span>+ Fechamento Noite</span>
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
              🔒 Perfil Operador
            </span>
          )}
        </div>

        {isAdmin ? (
          <>
            {/* Big Display of Selected Period Revenue */}
            <div className="my-2 flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="text-3xl font-black text-white font-display tracking-tight glow-cyan-text">
                  R$ {totalRevenue.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 ml-2">
                  ({dateScopedRentals.length} registro(s) no período)
                </span>
              </div>

              {/* Botão Exportar Relatório */}
              <button
                onClick={exportDailyReport}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-slate-700 transition-colors"
                title="Exportar CSV desta visão"
              >
                <Download size={12} />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Detalhamento por Forma de Pagamento */}
            <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-700/80 text-center">
              <div className="p-1.5 rounded-lg bg-[#0B132B]/80 border border-emerald-500/30">
                <div className="text-[9px] uppercase font-bold text-emerald-400">PIX</div>
                <div className="text-xs font-extrabold text-white">R$ {pixTotal.toFixed(0)}</div>
              </div>

              <div className="p-1.5 rounded-lg bg-[#0B132B]/80 border border-cyan-500/30">
                <div className="text-[9px] uppercase font-bold text-cyan-400">Cartão</div>
                <div className="text-xs font-extrabold text-white">R$ {cardTotal.toFixed(0)}</div>
              </div>

              <div className="p-1.5 rounded-lg bg-[#0B132B]/80 border border-amber-500/30">
                <div className="text-[9px] uppercase font-bold text-amber-400">Dinheiro</div>
                <div className="text-xs font-extrabold text-white">R$ {cashTotal.toFixed(0)}</div>
              </div>

              <div className="p-1.5 rounded-lg bg-[#0B132B]/80 border border-rose-500/30">
                <div className="text-[9px] uppercase font-bold text-rose-400">Pendente</div>
                <div className="text-xs font-extrabold text-white">R$ {pendingAmount.toFixed(0)}</div>
              </div>
            </div>
          </>
        ) : (
          /* Visão Operador */
          <div className="my-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-white font-display">
                  {dateScopedRentals.length}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">corridas no período</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. FILTROS E BUSCA */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por veículo, piloto ou observação..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141E38]/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center bg-[#141E38] rounded-xl p-0.5 border border-slate-700 overflow-x-auto">
          {(['TODOS', 'PAGO', 'NAO_PAGO', 'ANULADA'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                statusFilter === filter
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'TODOS'
                ? 'Todos'
                : filter === 'PAGO'
                ? 'Pagos'
                : filter === 'NAO_PAGO'
                ? 'Pendentes'
                : 'Anuladas'}
            </button>
          ))}
        </div>
      </div>

      {/* 4. LISTA DE CORRIDAS DO PERÍODO */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{displayedRentals.length} corridas listadas</span>
          <div className="flex items-center gap-3">
            {displayedRentals.length > 0 && isAdmin && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors"
                title="Apagar corridas do histórico"
              >
                <Trash2 size={12} />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>
        </div>

        {displayedRentals.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#141E38]/40 border border-dashed border-slate-800 text-center space-y-2">
            <Clock size={28} className="mx-auto text-slate-600 mb-1" />
            <div className="text-sm font-semibold text-slate-300">
              Nenhuma corrida encontrada para esta data/período.
            </div>
            {isAdmin && (
              <p className="text-xs text-slate-500">
                Você pode usar o botão <strong>+ Lançar Corrida</strong> ou <strong>+ Fechamento Noite</strong> acima para cadastrar retroativamente!
              </p>
            )}
          </div>
        ) : (
          displayedRentals.map((rental) => {
            const startDate = new Date(rental.startTime);
            const dateFormatted = `${String(startDate.getDate()).padStart(2, '0')}/${String(
              startDate.getMonth() + 1
            ).padStart(2, '0')}`;
            const timeFormatted = `${String(startDate.getHours()).padStart(2, '0')}:${String(
              startDate.getMinutes()
            ).padStart(2, '0')}`;

            const isPaid = rental.paymentStatus === 'PAGO';
            const isAnnulled = rental.status === 'anulada' || rental.status === 'cancelada';
            const isClosure = !!rental.isNightClosure;

            return (
              <div
                key={rental.id}
                className={`rounded-xl border p-3.5 transition-all shadow-sm ${
                  isAnnulled
                    ? 'bg-rose-950/20 border-rose-500/40 opacity-75'
                    : isClosure
                    ? 'bg-purple-950/20 border-purple-500/40'
                    : 'bg-[#141E38] border-slate-700/80 hover:border-cyan-500/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Badge Veículo / Noite */}
                    <div
                      className={`w-9 h-9 rounded-lg border flex flex-col items-center justify-center font-display shrink-0 ${
                        isClosure
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                          : 'bg-[#0B132B] border-slate-700 text-cyan-400 font-bold'
                      }`}
                    >
                      {isClosure ? (
                        <Moon size={16} />
                      ) : (
                        <span className="text-[10px] leading-none">{rental.vehicleCode}</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{rental.vehicleName}</span>
                          {rental.isManualPastEntry && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                              Retroativo
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dateFormatted} às {timeFormatted}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium">
                        {rental.customerName}
                        {!isClosure && (
                          <span className="text-slate-400"> · {rental.durationMinutes} min</span>
                        )}
                        {rental.closureDetails?.totalRuns && (
                          <span className="text-purple-300"> · {rental.closureDetails.totalRuns} corridas</span>
                        )}
                      </div>
                      {rental.notes && (
                        <div className="text-[10px] text-slate-400 italic mt-0.5">
                          "{rental.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Valor e Ações Administrativas */}
                  <div className="text-right flex flex-col items-end">
                    <div
                      className={`text-sm font-extrabold font-display ${
                        isAnnulled ? 'text-rose-400 line-through' : 'text-white'
                      }`}
                    >
                      R$ {rental.amount.toFixed(2)}
                    </div>

                    {/* Botões do Administrador (Editar, Anular, Excluir) */}
                    <div className="mt-1 flex items-center gap-1">
                      {/* Editar Pagamento */}
                      <button
                        onClick={() => {
                          setEditingRental(rental);
                          setEditMethod(rental.paymentMethod);
                          setEditStatus(rental.paymentStatus);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[10px] font-bold transition-colors"
                        title="Editar pagamento"
                      >
                        <Edit2 size={10} />
                        <span>Editar</span>
                      </button>

                      {/* Anular Corrida (Domínio do Administrador) */}
                      {isAdmin && !isAnnulled && (
                        <button
                          type="button"
                          onClick={() => setRentalToAnnul(rental)}
                          className="px-1.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition-colors"
                          title="Anular corrida"
                        >
                          <Ban size={10} className="inline mr-0.5" />
                          <span>Anular</span>
                        </button>
                      )}

                      {/* Excluir Corrida */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setRentalToDelete(rental)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Excluir corrida permanentemente"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Badges */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="flex items-center gap-1">
                      {rental.paymentMethod === 'PIX' ? (
                        <QrCode size={11} className="text-emerald-400" />
                      ) : rental.paymentMethod === 'CARTAO' ? (
                        <CreditCard size={11} className="text-cyan-400" />
                      ) : (
                        <Banknote size={11} className="text-amber-400" />
                      )}
                      <span>{rental.paymentMethod}</span>
                    </span>
                    <span>·</span>
                    <span className="text-[10px] text-slate-500">
                      Op: {rental.operatorName?.split(' ')[0] || 'Admin'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isAnnulled ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        ANULADA
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {isPaid ? 'PAGO' : 'NÃO PAGO'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. MODAL: LANÇAR CORRIDA RETROATIVA (MANUALMENTE A CORRIDA ALI) */}
      {isPastRentalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus size={16} className="text-cyan-400" />
                Lançar Corrida Retroativa (Histórico Passado)
              </h3>
              <button
                onClick={() => setIsPastRentalModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePastRental} className="space-y-3 text-xs">
              {/* Data e Hora Retroativa */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Data da Corrida
                  </label>
                  <input
                    type="date"
                    required
                    value={pastDate}
                    onChange={(e) => setPastDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Horário Aproximado
                  </label>
                  <input
                    type="time"
                    required
                    value={pastTime}
                    onChange={(e) => setPastTime(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Veículo da Frota */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                  Veículo Utilizado
                </label>
                <select
                  value={pastVehicleId}
                  onChange={(e) => setPastVehicleId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} - {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Duração e Preço */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Tempo de Pista
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 15, 20].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => {
                          setPastDuration(min);
                          const p = currentTenant.pricing[min] || min * 2.5;
                          setPastAmount(p.toFixed(2));
                        }}
                        className={`py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                          pastDuration === min
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold'
                            : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}
                      >
                        {min}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Valor Total (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    required
                    value={pastAmount}
                    onChange={(e) => setPastAmount(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-extrabold text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['PIX', 'CARTAO', 'DINHEIRO'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPastMethod(m)}
                      className={`py-2 rounded-xl border font-bold transition-all ${
                        pastMethod === m
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status do Pagamento */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                  Status do Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPastStatus('PAGO')}
                    className={`py-2 rounded-xl border font-bold transition-all ${
                      pastStatus === 'PAGO'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    ✓ PAGO
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastStatus('NAO_PAGO')}
                    className={`py-2 rounded-xl border font-bold transition-all ${
                      pastStatus === 'NAO_PAGO'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    ⚠ PENDENTE
                  </button>
                </div>
              </div>

              {/* Observações Opcionais */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Corrida avulsa, cliente VIP, etc."
                  value={pastNotes}
                  onChange={(e) => setPastNotes(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPastRentalModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(0,180,216,0.3)] transition-all"
                >
                  Gravar Corrida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: LANÇAR FECHAMENTO DA NOITE / VALORES DO DIA */}
      {isNightClosureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-purple-500/40 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Moon size={16} className="text-purple-400" />
                Lançar Fechamento da Noite / Faturamento do Dia
              </h3>
              <button
                onClick={() => setIsNightClosureModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNightClosure} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Data da Noite / Dia
                  </label>
                  <input
                    type="date"
                    required
                    value={closureDate}
                    onChange={(e) => setClosureDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Turno / Nome
                  </label>
                  <input
                    type="text"
                    required
                    value={closureShift}
                    onChange={(e) => setClosureShift(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Valor Total e Quantidade de Corridas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase text-purple-300 block mb-1">
                    Valor Total da Noite (R$) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="Ex: 850.00"
                    value={closureTotal}
                    onChange={(e) => setClosureTotal(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-purple-500/60 text-purple-300 font-black text-base focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                    Qtd. de Corridas Feitas
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="Ex: 34"
                    value={closureRuns}
                    onChange={(e) => setClosureRuns(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Detalhamento por método de pagamento */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Divisão do Caixa (Opcional para conciliação)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-emerald-400 font-bold block mb-0.5">PIX (R$)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="0.00"
                      value={closurePix}
                      onChange={(e) => setClosurePix(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-400 font-bold block mb-0.5">Cartão (R$)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="0.00"
                      value={closureCard}
                      onChange={(e) => setClosureCard(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-amber-400 font-bold block mb-0.5">Dinheiro (R$)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="0.00"
                      value={closureCash}
                      onChange={(e) => setClosureCash(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-300 block mb-1">
                  Observações do Fechamento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Caixa fechado sem divergências, pista lotada."
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNightClosureModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-extrabold shadow-[0_0_12px_rgba(147,51,234,0.4)] transition-all"
                >
                  Gravar Fechamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: EDITAR FORMA DE PAGAMENTO */}
      {editingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 size={15} className="text-cyan-400" />
                Editar Pagamento da Corrida
              </h3>
              <button
                onClick={() => setEditingRental(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              <div className="font-semibold text-white">
                {editingRental.vehicleName} ({editingRental.vehicleCode})
              </div>
              <div>Piloto: {editingRental.customerName}</div>
              <div className="text-cyan-400 font-bold mt-1">
                Valor: R$ {editingRental.amount.toFixed(2)}
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-bold text-slate-400">
                Forma de Pagamento
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['PIX', 'CARTAO', 'DINHEIRO'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditMethod(m)}
                    className={`py-2 px-1 rounded-xl border text-xs font-bold transition-all ${
                      editMethod === m
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                        : 'bg-[#141E38] border-slate-700 text-slate-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Status de Pagamento */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-bold text-slate-400">
                Status do Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditStatus('PAGO')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                    editStatus === 'PAGO'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                      : 'bg-[#141E38] border-slate-700 text-slate-300'
                  }`}
                >
                  ✓ PAGO
                </button>

                <button
                  type="button"
                  onClick={() => setEditStatus('NAO_PAGO')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                    editStatus === 'NAO_PAGO'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-[#141E38] border-slate-700 text-slate-300'
                  }`}
                >
                  ⚠ NÃO PAGO
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingRental(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-[0_0_10px_rgba(0,180,216,0.3)]"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: ANULAR CORRIDA (ADMINISTRADOR) */}
      {rentalToAnnul && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-amber-500/40 p-5 shadow-2xl space-y-3.5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <Ban size={24} />
            </div>
            <h3 className="text-sm font-bold text-white">Anular esta Corrida?</h3>
            <p className="text-xs text-slate-300">
              Piloto: <strong>{rentalToAnnul.customerName}</strong> ({rentalToAnnul.vehicleName})
            </p>
            <p className="text-[11px] text-slate-400">
              O status será marcado como <strong>ANULADA</strong> e o valor será retirado do faturamento líquido.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRentalToAnnul(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelRental(rentalToAnnul.id);
                  setRentalToAnnul(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-md"
              >
                Sim, Anular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: CONFIRMAR EXCLUSÃO INDIVIDUAL */}
      {rentalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-rose-500/40 p-5 shadow-2xl space-y-3.5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-white">Excluir esta corrida?</h3>
            <p className="text-xs text-slate-300">
              Piloto: <strong>{rentalToDelete.customerName}</strong> ({rentalToDelete.vehicleName})
            </p>
            <p className="text-[11px] text-slate-400">
              Essa ação removerá permanentemente o registro desta corrida do sistema.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRentalToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRental(rentalToDelete.id);
                  setRentalToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL: CONFIRMAR LIMPAR TODO HISTÓRICO */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-rose-500/40 p-5 shadow-2xl space-y-3.5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-white">Limpar Histórico de Corridas?</h3>
            <p className="text-xs text-slate-300">
              Todas as corridas concluídas desta pista serão removidas do histórico.
            </p>
            <p className="text-[11px] text-slate-400">
              Corridas atualmente ativas na pista serão preservadas.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearRentalHistory();
                  setShowClearConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md"
              >
                Sim, Limpar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

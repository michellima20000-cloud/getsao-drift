import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Rental, PaymentMethod, PaymentStatus } from '../types';
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
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Sparkles,
} from 'lucide-react';

export const HistoryScreen: React.FC = () => {
  const {
    rentals,
    vehicles,
    currentTenant,
    exportDailyReport,
    updateRentalPayment,
    updateRentalDetails,
    addPastRental,
    deleteRental,
    clearRentalHistory,
    currentUser,
  } = useDriftPark();
  const isAdmin = currentUser?.role === 'admin';

  // Helper de formatação de data YYYY-MM-DD
  const formatDateKey = (d: Date | number) => {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayKey = formatDateKey(Date.now());
  const yesterdayKey = formatDateKey(Date.now() - 86400000);

  // Filtro por Data / Calendário (Padrão: Hoje)
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  // Search and filter de status
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PAGO' | 'NAO_PAGO'>('TODOS');

  // Modal: Lançar Corrida Retrô / Adicionar Corrida Passada
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addDate, setAddDate] = useState<string>(todayKey);
  const [addTime, setAddTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [addVehicleId, setAddVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [addCustomerName, setAddCustomerName] = useState('');
  const [addCustomerPhone, setAddCustomerPhone] = useState('');
  const [addDuration, setAddDuration] = useState<number>(10);
  const [addAmount, setAddAmount] = useState<number>(() => currentTenant.pricing[10] || 25);
  const [addMethod, setAddMethod] = useState<PaymentMethod>('PIX');
  const [addStatus, setAddStatus] = useState<PaymentStatus>('PAGO');

  // Modal: Editar Corrida Existente
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editAmount, setEditAmount] = useState<number>(25);
  const [editDate, setEditDate] = useState<string>(todayKey);
  const [editTime, setEditTime] = useState<string>('12:00');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('PIX');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('PAGO');

  // Delete confirmations
  const [rentalToDelete, setRentalToDelete] = useState<Rental | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Navegação de dias no calendário
  const handlePrevDay = () => {
    if (selectedDate === 'todas') {
      setSelectedDate(todayKey);
      return;
    }
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() - 1);
    setSelectedDate(formatDateKey(curr));
  };

  const handleNextDay = () => {
    if (selectedDate === 'todas') {
      setSelectedDate(todayKey);
      return;
    }
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + 1);
    setSelectedDate(formatDateKey(curr));
  };

  // Corridas correspondentes à data selecionada no calendário
  const dateRentals = rentals.filter((r) => {
    if (selectedDate === 'todas') return true;
    return formatDateKey(r.createdAt) === selectedDate;
  });

  // Resumo financeiro calculado dinamicamente para a data selecionada
  const totalRevenue = dateRentals
    .filter((r) => r.paymentStatus === 'PAGO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingAmount = dateRentals
    .filter((r) => r.paymentStatus === 'NAO_PAGO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pixTotal = dateRentals
    .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'PIX')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const cardTotal = dateRentals
    .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'CARTAO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const cashTotal = dateRentals
    .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'DINHEIRO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Lista com busca e filtro de pagamento
  const filteredRentals = dateRentals.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicleCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'TODOS' || r.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Ao abrir o modal de lançar corrida passada
  const handleOpenAddModal = () => {
    setAddDate(selectedDate !== 'todas' ? selectedDate : todayKey);
    const d = new Date();
    setAddTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setAddVehicleId(vehicles[0]?.id || '');
    setAddCustomerName('');
    setAddCustomerPhone('');
    setAddDuration(10);
    setAddAmount(currentTenant.pricing[10] || 25);
    setAddMethod('PIX');
    setAddStatus('PAGO');
    setIsAddModalOpen(true);
  };

  // Ao mudar duração na criação, atualiza valor padrão
  const handleDurationChange = (dur: number) => {
    setAddDuration(dur);
    const price = currentTenant.pricing[dur];
    if (price !== undefined) {
      setAddAmount(price);
    }
  };

  // Salvar corrida passada
  const handleSavePastRental = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCustomerName.trim()) return;

    const [y, m, d] = addDate.split('-').map(Number);
    const [hours, minutes] = (addTime || '12:00').split(':').map(Number);
    const raceTimestamp = new Date(y, m - 1, d, hours || 12, minutes || 0).getTime();

    addPastRental({
      vehicleId: addVehicleId || (vehicles[0]?.id ?? 'veh_01'),
      customerName: addCustomerName.trim(),
      customerPhone: addCustomerPhone.trim(),
      durationMinutes: addDuration,
      amount: Number(addAmount) || 0,
      paymentMethod: addMethod,
      paymentStatus: addStatus,
      timestamp: raceTimestamp,
    });

    // Direciona o seletor para o dia da corrida lançada para o usuário conferir na hora
    setSelectedDate(addDate);
    setIsAddModalOpen(false);
  };

  // Ao abrir edição de corrida
  const handleOpenEdit = (rental: Rental) => {
    setEditingRental(rental);
    setEditCustomerName(rental.customerName);
    setEditAmount(rental.amount);
    setEditDate(formatDateKey(rental.createdAt));
    const d = new Date(rental.createdAt);
    setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setEditMethod(rental.paymentMethod);
    setEditStatus(rental.paymentStatus);
  };

  // Salvar edição completa de corrida
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRental) return;

    const [y, m, d] = editDate.split('-').map(Number);
    const [hours, minutes] = (editTime || '12:00').split(':').map(Number);
    const newTimestamp = new Date(y, m - 1, d, hours || 12, minutes || 0).getTime();

    updateRentalDetails(editingRental.id, {
      customerName: editCustomerName.trim() || editingRental.customerName,
      amount: Number(editAmount) || editingRental.amount,
      paymentMethod: editMethod,
      paymentStatus: editStatus,
      createdAt: newTimestamp,
      startTime: newTimestamp,
      endTime: newTimestamp + editingRental.durationMinutes * 60 * 1000,
    });

    setEditingRental(null);
  };

  // Título dinâmico da data
  const getDateLabel = () => {
    if (selectedDate === 'todas') return 'Todas as Datas (Acumulado)';
    if (selectedDate === todayKey) return `Hoje (${selectedDate.split('-').reverse().join('/')})`;
    if (selectedDate === yesterdayKey) return `Ontem (${selectedDate.split('-').reverse().join('/')})`;
    return selectedDate.split('-').reverse().join('/');
  };

  return (
    <div className="space-y-4 pb-8">
      {/* 1. SELETOR DE CALENDÁRIO & CONTROLE DE DATA */}
      <div className="rounded-2xl bg-[#141E38] border border-cyan-500/30 p-3 shadow-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Quick Dates Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedDate(todayKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedDate === todayKey
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,180,216,0.4)]'
                  : 'bg-[#0B132B] text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              <Calendar size={13} />
              <span>Hoje</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate(yesterdayKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDate === yesterdayKey
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,180,216,0.4)]'
                  : 'bg-[#0B132B] text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              Ontem
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate('todas')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedDate === 'todas'
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(0,180,216,0.4)]'
                  : 'bg-[#0B132B] text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              Todas as Datas
            </button>
          </div>

          {/* Date Picker Input & Day Navigator */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
              title="Dia anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="relative">
              <input
                type="date"
                value={selectedDate !== 'todas' ? selectedDate : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#0B132B] border border-cyan-500/40 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 cursor-pointer text-center"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
              title="Próximo dia"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. RESUMO FINANCEIRO DO DIA SELECIONADO NO TOPO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141E38] via-[#101932] to-[#0B132B] border border-cyan-500/40 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <DollarSign size={16} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                {selectedDate === 'todas'
                  ? 'Faturamento Total Acumulado'
                  : `Extrato Diário · ${getDateLabel()}`}
              </div>
              <p className="text-[10px] text-slate-400">
                {dateRentals.length} corridas registradas nesta data
              </p>
            </div>
          </div>

          {/* Botões do Topo: Lançar Corrida Retrô e Exportar Diário */}
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-[0_0_12px_rgba(0,180,216,0.35)] transition-all active:scale-95"
                title="Adicionar corridas que foram feitas em datas anteriores ou hoje"
              >
                <Plus size={14} />
                <span>+ Lançar Corrida</span>
              </button>
            )}

            {isAdmin ? (
              <button
                type="button"
                onClick={() => exportDailyReport(selectedDate, dateRentals)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition-all active:scale-95"
                title="Exportar Relatório CSV desta data"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Exportar Diário</span>
              </button>
            ) : (
              <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
                🔒 Operador
              </span>
            )}
          </div>
        </div>

        {isAdmin ? (
          <>
            {/* Display do Faturamento da Data Selecionada */}
            <div className="my-2.5">
              <span className="text-3xl font-black text-white font-display tracking-tight glow-cyan-text">
                R$ {totalRevenue.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 ml-2">
                ({dateRentals.filter((r) => r.paymentStatus === 'PAGO').length} pagas)
              </span>
            </div>

            {/* Breakdown dos Métodos de Pagamento */}
            <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-700/80 text-center">
              <div className="p-2 rounded-xl bg-[#0B132B]/90 border border-emerald-500/30">
                <div className="text-[9px] uppercase font-bold text-emerald-400">PIX</div>
                <div className="text-xs font-extrabold text-white">R$ {pixTotal.toFixed(0)}</div>
              </div>

              <div className="p-2 rounded-xl bg-[#0B132B]/90 border border-cyan-500/30">
                <div className="text-[9px] uppercase font-bold text-cyan-400">Cartão</div>
                <div className="text-xs font-extrabold text-white">R$ {cardTotal.toFixed(0)}</div>
              </div>

              <div className="p-2 rounded-xl bg-[#0B132B]/90 border border-amber-500/30">
                <div className="text-[9px] uppercase font-bold text-amber-400">Dinheiro</div>
                <div className="text-xs font-extrabold text-white">R$ {cashTotal.toFixed(0)}</div>
              </div>

              <div className="p-2 rounded-xl bg-[#0B132B]/90 border border-rose-500/30">
                <div className="text-[9px] uppercase font-bold text-rose-400">Pendente</div>
                <div className="text-xs font-extrabold text-white">R$ {pendingAmount.toFixed(0)}</div>
              </div>
            </div>
          </>
        ) : (
          /* Visão do Operador */
          <div className="my-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-white font-display">
                  {dateRentals.length}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">corridas nesta data</span>
              </div>
              <div className="text-right text-[11px] text-cyan-300 font-semibold">
                Operação Registrada
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
              Valores financeiros totais são restritos ao Administrador.
            </div>
          </div>
        )}
      </div>

      {/* 3. FILTROS & BUSCA */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por piloto ou veículo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141E38]/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center bg-[#141E38] rounded-xl p-0.5 border border-slate-700">
          {(['TODOS', 'PAGO', 'NAO_PAGO'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                statusFilter === filter
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'TODOS' ? 'Todos' : filter === 'PAGO' ? 'Pagos' : 'Pendentes'}
            </button>
          ))}
        </div>
      </div>

      {/* 4. LISTAGEM DE CORRIDAS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{filteredRentals.length} corridas listadas para {getDateLabel()}</span>
          <div className="flex items-center gap-3">
            {isAdmin && filteredRentals.length > 0 && (
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
            <span className="text-[10px] text-cyan-400 hidden sm:inline">Toque em Editar para alterar dados</span>
          </div>
        </div>

        {filteredRentals.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#141E38]/40 border border-dashed border-slate-800 text-center text-slate-400 text-xs space-y-2">
            <div>Nenhuma corrida encontrada para {getDateLabel()}.</div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 font-bold text-xs inline-flex items-center gap-1.5 transition-all"
              >
                <Plus size={14} />
                <span>Lançar Corrida nesta Data</span>
              </button>
            )}
          </div>
        ) : (
          filteredRentals.map((rental) => {
            const startDate = new Date(rental.startTime);
            const endDate = new Date(rental.endTime);
            const timeFormatted = `${String(startDate.getHours()).padStart(2, '0')}:${String(
              startDate.getMinutes()
            ).padStart(2, '0')} - ${String(endDate.getHours()).padStart(2, '0')}:${String(
              endDate.getMinutes()
            ).padStart(2, '0')}`;
            const dateDisplay = `${String(startDate.getDate()).padStart(2, '0')}/${String(
              startDate.getMonth() + 1
            ).padStart(2, '0')}`;

            const isPaid = rental.paymentStatus === 'PAGO';

            return (
              <div
                key={rental.id}
                className="rounded-xl bg-[#141E38] border border-slate-700/80 p-3 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-3 shadow-sm"
              >
                {/* Esquerda: Info do Veículo e Cliente */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0B132B] border border-cyan-500/30 flex flex-col items-center justify-center font-display shrink-0">
                    <span className="text-[10px] font-extrabold text-cyan-400 leading-none">
                      {rental.vehicleCode}
                    </span>
                    <span className="text-[9px] text-slate-400 leading-none mt-0.5">
                      {rental.durationMinutes}m
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate">{rental.customerName}</h4>
                      <span className="text-[10px] text-slate-400">· {rental.vehicleName}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="text-cyan-300 font-semibold">{dateDisplay}</span>
                      <span>·</span>
                      <span>{timeFormatted}</span>
                      {rental.customerPhone && (
                        <>
                          <span>·</span>
                          <span className="truncate">{rental.customerPhone}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direita: Valor, Status e Botão Editar */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-black text-white font-mono">
                      R$ {rental.amount.toFixed(2)}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {isPaid ? 'PAGO' : 'PENDENTE'}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">
                        {rental.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Botão de Edição */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(rental)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors border border-slate-700"
                    title="Editar informações e pagamento desta corrida"
                  >
                    <Edit2 size={13} />
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setRentalToDelete(rental)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Excluir corrida"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: LANÇAR CORRIDA RETRÔ / PASSADA NO HISTÓRICO */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus size={16} className="text-cyan-400" />
                  Lançar Corrida no Histórico
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Adicione corridas passadas para manter o controle e extrato 100% exatos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePastRental} className="space-y-3.5">
              {/* 1. Data e Horário */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Data da Corrida
                  </label>
                  <input
                    type="date"
                    required
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Horário da Corrida
                  </label>
                  <input
                    type="time"
                    required
                    value={addTime}
                    onChange={(e) => setAddTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 2. Seleção de Veículo */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Veículo Utilizado
                </label>
                <select
                  value={addVehicleId}
                  onChange={(e) => setAddVehicleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} - {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Piloto e WhatsApp */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Nome do Piloto
                  </label>
                  <input
                    type="text"
                    required
                    value={addCustomerName}
                    onChange={(e) => setAddCustomerName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    WhatsApp (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={addCustomerPhone}
                    onChange={(e) => setAddCustomerPhone(e.target.value)}
                    placeholder="11 99999-9999"
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 4. Duração e Valor */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Tempo de Pista
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[5, 10, 15, 20, 30].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => handleDurationChange(dur)}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        addDuration === dur
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-sm'
                          : 'bg-[#141E38] border-slate-700 text-slate-300'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Valor Total da Corrida (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={addAmount}
                    onChange={(e) => setAddAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 5. Forma de Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PIX', 'CARTAO', 'DINHEIRO'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAddMethod(m)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        addMethod === m
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                          : 'bg-[#141E38] border-slate-700 text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Status do Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Status do Pagamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddStatus('PAGO')}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      addStatus === 'PAGO'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                        : 'bg-[#141E38] border-slate-700 text-slate-300'
                    }`}
                  >
                    ✓ PAGO
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddStatus('NAO_PAGO')}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      addStatus === 'NAO_PAGO'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-[#141E38] border-slate-700 text-slate-300'
                    }`}
                  >
                    ⚠ PENDENTE
                  </button>
                </div>
              </div>

              {/* Botões */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-[0_0_12px_rgba(0,180,216,0.35)]"
                >
                  Gravar no Histórico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR CORRIDA COMPLETA */}
      {editingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 size={16} className="text-cyan-400" />
                Editar Dados da Corrida
              </h3>
              <button
                type="button"
                onClick={() => setEditingRental(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Nome do Piloto
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Data da Corrida
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Valor da Corrida (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
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
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
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
                    ⚠ PENDENTE
                  </button>
                </div>
              </div>

              {/* Ações */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRental(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-[0_0_10px_rgba(0,180,216,0.3)]"
                  >
                    Salvar Alterações
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const id = editingRental.id;
                    setEditingRental(null);
                    deleteRental(id);
                  }}
                  className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Excluir Corrida do Histórico</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO INDIVIDUAL */}
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
              Essa ação removerá o registro desta corrida do histórico da pista.
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

      {/* MODAL: CONFIRMAR LIMPAR TODO HISTÓRICO */}
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

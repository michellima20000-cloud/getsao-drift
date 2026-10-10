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
} from 'lucide-react';

export const HistoryScreen: React.FC = () => {
  const {
    rentals,
    exportDailyReport,
    updateRentalPayment,
    deleteRental,
    clearRentalHistory,
    currentUser,
  } = useDriftPark();
  const isAdmin = currentUser?.role === 'admin';

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PAGO' | 'NAO_PAGO'>('TODOS');

  // Edit modal state
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [editMethod, setEditMethod] = useState<PaymentMethod>('PIX');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('PAGO');

  // Delete confirmations
  const [rentalToDelete, setRentalToDelete] = useState<Rental | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Today's rentals
  const todayStr = new Date().toDateString();
  const todayRentals = rentals.filter(
    (r) => new Date(r.createdAt).toDateString() === todayStr
  );

  // Financial summary
  const totalRevenue = todayRentals
    .filter((r) => r.paymentStatus === 'PAGO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingAmount = todayRentals
    .filter((r) => r.paymentStatus === 'NAO_PAGO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pixTotal = todayRentals
    .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'PIX')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const cardTotal = todayRentals
    .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'CARTAO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const cashTotal = todayRentals
    .filter((r) => r.paymentStatus === 'PAGO' && r.paymentMethod === 'DINHEIRO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Filter list
  const filteredRentals = rentals.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicleCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'TODOS' || r.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenEdit = (rental: Rental) => {
    setEditingRental(rental);
    setEditMethod(rental.paymentMethod);
    setEditStatus(rental.paymentStatus);
  };

  const handleSaveEdit = () => {
    if (editingRental) {
      updateRentalPayment(editingRental.id, editMethod, editStatus);
      setEditingRental(null);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Resumo Financeiro no Topo (Acessível apenas ao Admin) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#141E38] via-[#101932] to-[#0B132B] border border-cyan-500/40 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <DollarSign size={15} />
            {isAdmin ? 'Faturamento do Dia' : 'Resumo de Corridas do Dia'}
          </div>

          {/* Botão Exportar Diário (Admin) */}
          {isAdmin ? (
            <button
              onClick={exportDailyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_12px_rgba(0,180,216,0.3)] transition-all active:scale-95"
              title="Exportar Relatório Diário CSV / Excel"
            >
              <Download size={13} />
              <span>Exportar Diário</span>
            </button>
          ) : (
            <span className="text-[10px] text-amber-400/90 font-medium flex items-center gap-1">
              🔒 Perfil Operador
            </span>
          )}
        </div>

        {isAdmin ? (
          <>
            {/* Big Display of Day Revenue (Admin only) */}
            <div className="my-2">
              <span className="text-3xl font-black text-white font-display tracking-tight glow-cyan-text">
                R$ {totalRevenue.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 ml-2">
                ({todayRentals.length} corridas realizadas)
              </span>
            </div>

            {/* Breakdown by Payment Method */}
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
          /* Operator View: Only operational race count, revenue hidden */
          <div className="my-2 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-black text-white font-display">
                  {todayRentals.length}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">corridas realizadas hoje</span>
              </div>
              <div className="text-right text-[11px] text-cyan-300 font-semibold">
                Sua Operação Ativa
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs">🔒</span>
              <span>
                Valores de faturamento total e extratos financeiros são restritos exclusivamente ao <strong>Administrador</strong>.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filtros e Busca */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente ou veículo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141E38]/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center bg-[#141E38] rounded-xl p-0.5 border border-slate-700">
          {(['TODOS', 'PAGO', 'NAO_PAGO'] as const).map((filter) => (
            <button
              key={filter}
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

      {/* 3. Lista de Corridas em Cards Limpos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>{filteredRentals.length} corridas registradas</span>
          <div className="flex items-center gap-3">
            {filteredRentals.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors"
                title="Apagar corridas concluídas do histórico"
              >
                <Trash2 size={12} />
                <span>Limpar Histórico</span>
              </button>
            )}
            <span className="text-[10px] text-cyan-400 hidden sm:inline">Toque em Editar ou na lixeira</span>
          </div>
        </div>

        {filteredRentals.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#141E38]/40 border border-slate-800 text-center text-slate-400 text-xs">
            Nenhuma corrida encontrada para os filtros selecionados.
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

            const isPaid = rental.paymentStatus === 'PAGO';

            return (
              <div
                key={rental.id}
                className="rounded-xl bg-[#141E38] border border-slate-700/80 p-3.5 hover:border-cyan-500/50 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#0B132B] border border-slate-700 flex flex-col items-center justify-center font-display shrink-0">
                      <span className="text-[10px] text-cyan-400 font-bold leading-none">
                        {rental.vehicleCode}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{rental.vehicleName}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {timeFormatted}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium">
                        {rental.customerName} · <span className="text-slate-400">{rental.durationMinutes} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Valor e Ações (Editar e Apagar) */}
                  <div className="text-right flex flex-col items-end">
                    <div className="text-sm font-extrabold text-white font-display">
                      R$ {rental.amount.toFixed(2)}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(rental)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[10px] font-bold transition-colors"
                        title="Alterar forma de pagamento ou status"
                      >
                        <Edit2 size={10} />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRentalToDelete(rental)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Apagar esta corrida do histórico"
                      >
                        <Trash2 size={11} />
                      </button>
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
                      Op: {rental.operatorName.split(' ')[0]}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isPaid
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {isPaid ? 'PAGO' : 'NÃO PAGO'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Modal para Editar Forma de Pagamento e Status (Permitido pós-corrida conforme solicitado) */}
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
              <div className="font-semibold text-white">{editingRental.vehicleName} ({editingRental.vehicleCode})</div>
              <div>Piloto: {editingRental.customerName}</div>
              <div className="text-cyan-400 font-bold mt-1">Valor: R$ {editingRental.amount.toFixed(2)}</div>
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
                  type="button"
                  onClick={handleSaveEdit}
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

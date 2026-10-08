import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { VehicleCategory, QueueItem } from '../types';
import {
  Users,
  Plus,
  Play,
  Phone,
  Trash2,
  Clock,
  Sparkles,
  MessageCircle,
  X,
  Flame,
  Compass,
  Zap,
} from 'lucide-react';

export const QueueScreen: React.FC = () => {
  const { queue, addToQueue, removeFromQueue, clearQueue, callQueueItemToTrack, vehicles } = useDriftPark();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showClearQueueConfirm, setShowClearQueueConfirm] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [categoryDesired, setCategoryDesired] = useState<VehicleCategory>('DRIFT');
  const [durationMinutes, setDurationMinutes] = useState(10);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    addToQueue(customerName, customerPhone, categoryDesired, durationMinutes);
    setCustomerName('');
    setCustomerPhone('');
    setIsModalOpen(false);
  };

  // Check how many free cars per category
  const driftFree = vehicles.filter((v) => v.category === 'DRIFT' && v.status === 'disponivel').length;
  const jeepFree = vehicles.filter((v) => v.category === 'JEEP' && v.status === 'disponivel').length;
  const bumpFree = vehicles.filter((v) => v.category === 'BATE_BATE' && v.status === 'disponivel').length;

  return (
    <div className="space-y-4 pb-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users size={20} className="text-cyan-400" />
            <span>Fila de Espera da Pista</span>
          </h2>
          <p className="text-xs text-slate-400">
            {queue.length} cliente(s) aguardando liberação de carrinhos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={() => setShowClearQueueConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition-all active:scale-95"
              title="Apagar todos da fila de espera"
            >
              <Trash2 size={13} />
              <span>Limpar Fila</span>
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_12px_rgba(0,180,216,0.3)] transition-all active:scale-95"
          >
            <Plus size={15} />
            <span>+ Adicionar</span>
          </button>
        </div>
      </div>

      {/* Free Vehicles Quick Bar */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-xl bg-[#141E38] border border-cyan-500/30">
          <span className="text-[10px] text-cyan-300 font-bold block">🏎️ DRIFT</span>
          <span className="font-extrabold text-white">{driftFree} livre(s)</span>
        </div>
        <div className="p-2 rounded-xl bg-[#141E38] border border-emerald-500/30">
          <span className="text-[10px] text-emerald-300 font-bold block">🚙 JEEP</span>
          <span className="font-extrabold text-white">{jeepFree} livre(s)</span>
        </div>
        <div className="p-2 rounded-xl bg-[#141E38] border border-amber-500/30">
          <span className="text-[10px] text-amber-300 font-bold block">⚡ BATE</span>
          <span className="font-extrabold text-white">{bumpFree} livre(s)</span>
        </div>
      </div>

      {/* Queue List */}
      <div className="space-y-2.5">
        {queue.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#141E38]/40 border border-dashed border-slate-800 text-center space-y-2">
            <Clock size={28} className="mx-auto text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">Fila vazia no momento</div>
            <p className="text-xs text-slate-500">
              Quando a pista estiver cheia, cadastre os clientes aqui para gerenciar a ordem de chamada.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold"
            >
              Adicionar Primeiro Cliente
            </button>
          </div>
        ) : (
          queue.map((item, index) => {
            const minutesWaiting = Math.floor((Date.now() - item.addedAt) / (1000 * 60));

            return (
              <div
                key={item.id}
                className="rounded-xl bg-[#141E38] border border-slate-700/80 p-3.5 hover:border-cyan-500/50 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Position Number */}
                    <div className="w-8 h-8 rounded-xl bg-[#0B132B] border border-cyan-500/40 flex items-center justify-center font-display text-sm font-extrabold text-cyan-400">
                      #{index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{item.customerName}</h4>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-semibold border border-slate-700">
                          {item.categoryDesired}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock size={11} className="text-slate-500" />
                        <span>Aguardando há {minutesWaiting} min</span>
                        <span>·</span>
                        <span>{item.durationMinutes} min previstos</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp notification link */}
                    {item.customerPhone && (
                      <a
                        href={`https://wa.me/55${item.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${item.customerName}! Seu carrinho no Drift Park está liberado! Venha para a pista agora.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                        title="Avisar cliente via WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}

                    {/* Chamar para a Pista -> Inicia novo aluguel */}
                    <button
                      onClick={() => callQueueItemToTrack(item)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-[0_0_8px_rgba(0,180,216,0.3)] transition-all active:scale-95"
                      title="Chamar cliente e preencher aluguel"
                    >
                      <Play size={12} className="fill-current" />
                      <span>Chamar</span>
                    </button>

                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remover da fila"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Adicionar à Fila */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-cyan-400" />
                Adicionar à Fila de Espera
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3.5">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Nome do Cliente / Piloto
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome completo ou apelido"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  WhatsApp (Para avisar quando liberar)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Categoria Desejada
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DRIFT', 'JEEP', 'BATE_BATE'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryDesired(cat)}
                      className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all ${
                        categoryDesired === cat
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                          : 'bg-[#141E38] border-slate-700 text-slate-300'
                      }`}
                    >
                      {cat === 'DRIFT' ? '🏎️ Drift' : cat === 'JEEP' ? '🚙 Jeep' : '⚡ Bate'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Tempo Previsto (Minutos)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDurationMinutes(m)}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        durationMinutes === m
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-[#141E38] border-slate-700 text-slate-400'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-bold shadow-[0_0_10px_rgba(0,180,216,0.3)]"
                >
                  Inserir na Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR LIMPAR TODA A FILA */}
      {showClearQueueConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-rose-500/40 p-5 shadow-2xl space-y-3.5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-white">Esvaziar a Fila de Espera?</h3>
            <p className="text-xs text-slate-300">
              Todos os {queue.length} clientes aguardando serão removidos da fila.
            </p>
            <p className="text-[11px] text-slate-400">
              Essa ação não pode ser desfeita.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearQueueConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearQueue();
                  setShowClearQueueConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md"
              >
                Sim, Limpar Fila
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

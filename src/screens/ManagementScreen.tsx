import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { VehicleCategory, VehicleStatus, UserRole } from '../types';
import {
  ShieldCheck,
  Plus,
  Car,
  UserPlus,
  FileSpreadsheet,
  Settings,
  Trash2,
  Wrench,
  CheckCircle,
  Building2,
  Lock,
  Flame,
  Compass,
  Zap,
  X,
  Sparkles,
} from 'lucide-react';

export const ManagementScreen: React.FC = () => {
  const {
    currentUser,
    currentTenant,
    allTenants,
    switchTenant,
    vehicles,
    users,
    addVehicle,
    updateVehicleStatus,
    deleteVehicle,
    createSubAccount,
    deleteOperator,
    exportDailyReport,
    updatePriceTier,
    quickLoginAs,
  } = useDriftPark();

  // Modals
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isSubAccountModalOpen, setIsSubAccountModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  // New Vehicle Form
  const [vehName, setVehName] = useState('');
  const [vehCode, setVehCode] = useState('');
  const [vehCategory, setVehCategory] = useState<VehicleCategory>('DRIFT');

  // New Sub Account Form
  const [subName, setSubName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPass, setSubPass] = useState('123456');
  const [subRole, setSubRole] = useState<UserRole>('operador');
  const [subLoading, setSubLoading] = useState(false);
  const [subFeedback, setSubFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Pricing Form
  const [selectedDuration, setSelectedDuration] = useState<number>(10);
  const [newPriceValue, setNewPriceValue] = useState<string>('25');

  const isAdmin = currentUser?.role === 'admin';

  // HIERARQUIA & ISOLAMENTO ESTRITO POR tenantId
  // 1. Administrador logado atual (apenas 1 card no topo)
  const adminUser = currentUser;

  // 2. Operadores vinculados estritamente ao tenantId do Administrador
  const tenantOperators = users.filter(
    (u) =>
      u.tenantId === currentUser?.tenantId &&
      u.role === 'operador' &&
      u.id !== currentUser?.id &&
      u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()
  );

  // Deduplicação estrita para garantir zero repetições na UI
  const uniqueOperators = Array.from(
    new Map(tenantOperators.map((op) => [op.email.toLowerCase(), op])).values()
  );

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehName.trim()) return;
    addVehicle(vehName, vehCode || `#${vehicles.length + 1}`, vehCategory);
    setVehName('');
    setVehCode('');
    setIsVehicleModalOpen(false);
  };

  const handleCreateSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubFeedback(null);
    if (!subName.trim() || !subEmail.trim()) return;
    setSubLoading(true);
    try {
      const res = await createSubAccount(subName, subEmail, subPass, subRole);
      if (res.success) {
        setSubName('');
        setSubEmail('');
        setSubPass('123456');
        setSubFeedback({ type: 'success', msg: 'Conta de Operador criada com sucesso no Firebase!' });
        setIsSubAccountModalOpen(false);
      } else {
        setSubFeedback({ type: 'error', msg: res.message || 'Erro ao criar sub-conta.' });
      }
    } finally {
      setSubLoading(false);
    }
  };

  const handleUpdatePrice = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newPriceValue);
    if (isNaN(val) || val <= 0) return;
    updatePriceTier(selectedDuration, val);
    setIsPricingModalOpen(false);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-400" />
            <span>Painel de Gestão da Pista</span>
          </h2>
          <p className="text-xs text-slate-400">
            Apenas para Administrador · Isolamento total por <code>tenantId</code>
          </p>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
            isAdmin
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
          }`}
        >
          {isAdmin ? '👑 Dono do Negócio' : '🏎️ Operador'}
        </span>
      </div>

      {/* Operator Restricted State (Strict RBAC requirement) */}
      {!isAdmin ? (
        <div className="p-6 rounded-2xl bg-[#141E38]/80 border border-amber-500/40 text-center space-y-3 my-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <Lock size={24} />
          </div>
          <h3 className="text-sm font-bold text-white">
            Acesso Restrito ao Administrador
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Operadores têm acesso limitado a iniciar/finalizar corridas, alterar status de pagamento e gerenciar a fila. A criação de funcionários e configurações da frota são exclusivas do Dono da Pista.
          </p>
          <div className="pt-2">
            <button
              onClick={() => quickLoginAs('admin')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>Alternar para Conta Administrador</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* CARD EM DESTAQUE: CRIAR CONTA DE OPERADOR (Conforme solicitado) */}
          <div className="rounded-2xl bg-gradient-to-br from-[#1C2541] to-[#141E38] border border-cyan-500/40 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Criar Conta de Operador / Funcionário
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Gere o acesso do seu funcionário vinculado ao seu <strong>tenantId</strong>
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                RBAC Operador
              </span>
            </div>

            <form onSubmit={handleCreateSubAccount} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Nome do Funcionário
                  </label>
                  <input
                    type="text"
                    required
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Ex: Carlos Oliveira"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B132B] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    E-mail de Login
                  </label>
                  <input
                    type="email"
                    required
                    value={subEmail}
                    onChange={(e) => setSubEmail(e.target.value)}
                    placeholder="carlos.operador@exemplo.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B132B] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Senha Provisória
                  </label>
                  <input
                    type="text"
                    required
                    value={subPass}
                    onChange={(e) => setSubPass(e.target.value)}
                    placeholder="Ex: 123456"
                    className="w-full px-3 py-2 rounded-xl bg-[#0B132B] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {subFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    subFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{subFeedback.type === 'success' ? '✅' : '⚠️'}</span>
                  <span>{subFeedback.msg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  🔒 O operador só poderá iniciar/parar corridas e não verá o faturamento total.
                </span>

                <button
                  type="submit"
                  disabled={subLoading}
                  className={`px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-[0_0_12px_rgba(0,180,216,0.3)] transition-all flex items-center gap-1.5 shrink-0 ${
                    subLoading ? 'opacity-60 cursor-wait' : ''
                  }`}
                >
                  <UserPlus size={14} />
                  <span>{subLoading ? 'CRIANDO NO FIREBASE...' : 'CRIAR CONTA IMEDIATAMENTE'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* 1. Atalhos Rápidos em Cards (As specified in prompt) */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          Atalhos Rápidos
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* [+ Novo Veículo] */}
          <button
            onClick={() => setIsVehicleModalOpen(true)}
            disabled={!isAdmin}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
              isAdmin
                ? 'bg-[#141E38] hover:bg-[#1C2541] border-cyan-500/40 text-cyan-300 hover:scale-[1.02] shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-1 text-cyan-400">
              <Car size={16} />
            </div>
            <span className="text-xs font-bold text-white">+ Novo Veículo</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Cadastrar na frota</span>
          </button>

          {/* [+ Criar Sub-Conta / Novo Operador] */}
          <button
            onClick={() => setIsSubAccountModalOpen(true)}
            disabled={!isAdmin}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
              isAdmin
                ? 'bg-[#141E38] hover:bg-[#1C2541] border-cyan-500/40 text-cyan-300 hover:scale-[1.02] shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mb-1 text-amber-400">
              <UserPlus size={16} />
            </div>
            <span className="text-xs font-bold text-white">+ Criar Sub-Conta</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Permissão restrita</span>
          </button>

          {/* [Configurar Preços] */}
          <button
            onClick={() => setIsPricingModalOpen(true)}
            disabled={!isAdmin}
            className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
              isAdmin
                ? 'bg-[#141E38] hover:bg-[#1C2541] border-cyan-500/40 text-cyan-300 hover:scale-[1.02] shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-1 text-emerald-400">
              <Settings size={16} />
            </div>
            <span className="text-xs font-bold text-white">Tabela de Preços</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Ajustar min / R$</span>
          </button>

          {/* [Exportar Diário] */}
          <button
            onClick={exportDailyReport}
            className="p-3 rounded-xl border bg-[#141E38] hover:bg-[#1C2541] border-cyan-500/40 text-cyan-300 hover:scale-[1.02] shadow-sm flex flex-col items-center justify-center text-center transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-1 text-cyan-400">
              <FileSpreadsheet size={16} />
            </div>
            <span className="text-xs font-bold text-white">Exportar Diário</span>
            <span className="text-[10px] text-slate-400 mt-0.5">CSV para Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Grid Visual de Veículos Cadastrados (As specified in prompt) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Car size={13} className="text-cyan-400" />
            Frota Cadastrada ({vehicles.length} veículos nesta operação)
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsVehicleModalOpen(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
            >
              <Plus size={12} />
              Novo
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {vehicles.map((veh) => {
            const isAvailable = veh.status === 'disponivel';
            const isInUse = veh.status === 'em_uso';
            const isMaintenance = veh.status === 'manutencao';

            return (
              <div
                key={veh.id}
                className="rounded-xl bg-[#141E38] border border-slate-700/80 p-3 hover:border-cyan-500/50 transition-all flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  {/* Category / Code Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-[#0B132B] border border-slate-700 flex flex-col items-center justify-center font-display shrink-0">
                    <span className="text-xs">
                      {veh.category === 'DRIFT' ? '🏎️' : veh.category === 'JEEP' ? '🚙' : '⚡'}
                    </span>
                    <span className="text-[10px] font-extrabold text-cyan-400 leading-none mt-0.5">
                      {veh.code}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white">{veh.name}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span>{veh.category}</span>
                      <span>·</span>
                      <span>{veh.totalRuns || 0} corridas</span>
                      <span>·</span>
                      <span className="text-emerald-400">{veh.batteryLevel || 100}% bat</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge & Controls */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isAvailable
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isInUse
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {isAvailable ? 'Livre' : isInUse ? 'Em Uso' : 'Manutenção'}
                  </span>

                  {isAdmin && (
                    <div className="flex items-center">
                      <button
                        onClick={() =>
                          updateVehicleStatus(
                            veh.id,
                            isMaintenance ? 'disponivel' : 'manutencao'
                          )
                        }
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isMaintenance
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 hover:text-amber-300 border-slate-700'
                        }`}
                        title={isMaintenance ? 'Retirar da manutenção' : 'Colocar em manutenção'}
                      >
                        <Wrench size={12} />
                      </button>

                      <button
                        onClick={() => deleteVehicle(veh.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors ml-1"
                        title="Excluir veículo da frota"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Sub-Contas & Operadores com Isolamento Estrito e Hierarquia de Visualização */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <UserPlus size={13} className="text-amber-400" />
            Equipe & Sub-Contas (1 Dono · {uniqueOperators.length} Operador{uniqueOperators.length === 1 ? '' : 'es'})
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsSubAccountModalOpen(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Criar Sub-Conta
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {/* ========================================================================= */}
          {/* TOPO DA HIERARQUIA: APENAS 1 CARD DO ADMINISTRADOR LOGADO ("Você - Admin") */}
          {/* ========================================================================= */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#1C2541] to-[#141E38] border border-amber-500/50 shadow-md flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold shrink-0">
                👑
              </div>
              <div>
                <div className="font-bold text-white flex items-center gap-2">
                  <span>{adminUser?.name || 'Administrador'}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                    Você - Admin
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {adminUser?.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono px-2 py-1 rounded bg-[#0B132B] text-slate-400 border border-slate-700">
                Dono da Pista
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ABAIXO: APENAS OS OPERADORES VINCULADOS AO tenantId DESSE ADMINISTRADOR */}
          {/* ========================================================================= */}
          <div className="pt-1.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <span>Operadores Vinculados à Pista ({uniqueOperators.length})</span>
              <span className="text-[9px] text-slate-500 font-mono">
                Firestore: users.where('tenantId', '==', currentTenantId)
              </span>
            </div>

            {uniqueOperators.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#0B132B]/60 border border-dashed border-slate-700 text-center space-y-1">
                <p className="text-xs text-slate-300 font-medium">
                  Nenhum operador cadastrado ainda nesta unidade.
                </p>
                <p className="text-[10px] text-slate-500">
                  Cadastre uma sub-conta acima para gerar login e senha para seu funcionário com perfil restrito.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {uniqueOperators.map((op) => (
                  <div
                    key={op.id}
                    className="p-3 rounded-xl bg-[#141E38] border border-slate-700/80 flex items-center justify-between text-xs hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs shrink-0 font-bold">
                        🏎️
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{op.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{op.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        🏎️ Operador
                      </span>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja remover o operador ${op.name}?`)) {
                              deleteOperator(op.id);
                            }
                          }}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                          title="Remover operador"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      </>
      )}

      {/* MODAL: NOVO VEÍCULO */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Car size={16} className="text-cyan-400" />
                Cadastrar Novo Veículo
              </h3>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-3.5">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Nome do Carrinho
                </label>
                <input
                  type="text"
                  required
                  value={vehName}
                  onChange={(e) => setVehName(e.target.value)}
                  placeholder="Ex: Drift Venom GT"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Número / Código da Pista
                </label>
                <input
                  type="text"
                  value={vehCode}
                  onChange={(e) => setVehCode(e.target.value)}
                  placeholder="Ex: #14"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Categoria
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DRIFT', 'JEEP', 'BATE_BATE'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setVehCategory(cat)}
                      className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all ${
                        vehCategory === cat
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                          : 'bg-[#141E38] border-slate-700 text-slate-300'
                      }`}
                    >
                      {cat === 'DRIFT' ? '🏎️ Drift' : cat === 'JEEP' ? '🚙 Jeep' : '⚡ Bate'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-bold shadow-[0_0_10px_rgba(0,180,216,0.3)]"
                >
                  Cadastrar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR SUB-CONTA */}
      {isSubAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus size={16} className="text-amber-400" />
                Criar Sub-Conta de Funcionário
              </h3>
              <button onClick={() => setIsSubAccountModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Operadores têm acesso apenas para Iniciar/Finalizar Corridas, Mudar Status de Pagamento e Ver Fila.
            </p>

            <form onSubmit={handleCreateSubAccount} className="space-y-3.5">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Nome do Funcionário
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Nome do operador"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  E-mail de Acesso
                </label>
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="funcionario@exemplo.com"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Senha Provisória
                </label>
                <input
                  type="text"
                  required
                  value={subPass}
                  onChange={(e) => setSubPass(e.target.value)}
                  placeholder="Ex: 123456"
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Nível de Permissão (RBAC)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubRole('operador')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                      subRole === 'operador'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                        : 'bg-[#141E38] border-slate-700 text-slate-300'
                    }`}
                  >
                    🏎️ Operador (Pista)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubRole('admin')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                      subRole === 'admin'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-[#141E38] border-slate-700 text-slate-300'
                    }`}
                  >
                    👑 Administrador
                  </button>
                </div>
              </div>

              {subFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    subFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{subFeedback.type === 'success' ? '✅' : '⚠️'}</span>
                  <span>{subFeedback.msg}</span>
                </div>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubAccountModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={subLoading}
                  className={`flex-1 py-2.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-bold shadow-[0_0_10px_rgba(0,180,216,0.3)] transition-all ${
                    subLoading ? 'opacity-60 cursor-wait' : ''
                  }`}
                >
                  {subLoading ? 'Cadastrando...' : 'Criar Sub-Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TABELA DE PREÇOS */}
      {isPricingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings size={16} className="text-cyan-400" />
                Configurar Tabela de Preços
              </h3>
              <button onClick={() => setIsPricingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePrice} className="space-y-3.5">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Selecione a Duração
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20, 30].map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => {
                        setSelectedDuration(min);
                        setNewPriceValue(String(currentTenant.pricing[min] || min * 2.5));
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold ${
                        selectedDuration === min
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                          : 'bg-[#141E38] border-slate-700 text-slate-300'
                      }`}
                    >
                      {min} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                  Valor para {selectedDuration} minutos (R$)
                </label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={newPriceValue}
                  onChange={(e) => setNewPriceValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-sm text-cyan-300 font-extrabold focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-bold shadow-[0_0_10px_rgba(0,180,216,0.3)]"
                >
                  Salvar Preço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

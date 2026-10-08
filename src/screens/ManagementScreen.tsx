import React, { useState } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Vehicle, VehicleCategory, VehicleStatus, UserRole } from '../types';
import { VEHICLE_IMAGE_PRESETS } from '../data/initialData';
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
  Camera,
  Upload,
  Image as ImageIcon,
  Pencil,
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
    updateVehicle,
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

  // Vehicle Form State
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehName, setVehName] = useState('');
  const [vehCode, setVehCode] = useState('');
  const [vehCategory, setVehCategory] = useState<VehicleCategory>('DRIFT');
  const [vehImageUrl, setVehImageUrl] = useState<string>('');
  const [isCustomUrlMode, setIsCustomUrlMode] = useState(false);

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

  // Delete Operator Modal
  const [operatorToDelete, setOperatorToDelete] = useState<{ id: string; name: string } | null>(null);

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

  const handleOpenNewVehicle = () => {
    setEditingVehicle(null);
    setVehName('');
    setVehCode(`#${vehicles.length + 1}`);
    setVehCategory('DRIFT');
    setVehImageUrl('');
    setIsCustomUrlMode(false);
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: Vehicle) => {
    setEditingVehicle(veh);
    setVehName(veh.name);
    setVehCode(veh.code);
    setVehCategory(veh.category);
    setVehImageUrl(veh.imageUrl || '');
    setIsCustomUrlMode(false);
    setIsVehicleModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setVehImageUrl(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehName.trim()) return;
    const codeToUse = vehCode.trim() || `#${vehicles.length + 1}`;
    const formattedCode = codeToUse.startsWith('#') ? codeToUse : `#${codeToUse}`;

    if (editingVehicle) {
      updateVehicle(editingVehicle.id, {
        name: vehName.trim(),
        code: formattedCode,
        category: vehCategory,
        imageUrl: vehImageUrl.trim() || undefined,
      });
    } else {
      addVehicle(
        vehName.trim(),
        formattedCode,
        vehCategory,
        vehImageUrl.trim() || undefined
      );
    }

    setVehName('');
    setVehCode('');
    setVehImageUrl('');
    setEditingVehicle(null);
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
            Apenas para Administrador · Gestão segura da equipe e frota
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
              onClick={handleOpenNewVehicle}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
            >
              <Plus size={12} />
              Novo Veículo
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
                <div className="flex items-center gap-3 min-w-0">
                  {/* Photo or Category / Code Avatar */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#0B132B] border border-slate-700 shrink-0 flex items-center justify-center">
                    {veh.imageUrl ? (
                      <img
                        src={veh.imageUrl}
                        alt={veh.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm">
                        {veh.category === 'DRIFT' ? '🏎️' : veh.category === 'JEEP' ? '🚙' : '⚡'}
                      </span>
                    )}
                    <span className="absolute bottom-0 right-0 px-1 py-0.5 bg-black/80 rounded-tl text-[9px] font-black text-cyan-400 font-display leading-none">
                      {veh.code}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{veh.name}</h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span className="text-cyan-300 font-semibold">{veh.category}</span>
                      <span>·</span>
                      <span>{veh.totalRuns || 0} corridas</span>
                      <span>·</span>
                      <span className="text-emerald-400">{veh.batteryLevel || 100}% bat</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge & Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditVehicle(veh)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 transition-colors"
                        title="Editar veículo e alterar foto"
                      >
                        <Pencil size={12} />
                      </button>

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
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors"
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
          {/* ABAIXO: APENAS OS OPERADORES VINCULADOS A ESTA CONTA */}
          {/* ========================================================================= */}
          <div className="pt-1.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <span>Operadores Cadastrados ({uniqueOperators.length})</span>
              <span className="text-[9px] text-cyan-400 font-medium">
                Acesso Restrito à Pista
              </span>
            </div>

            {uniqueOperators.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#0B132B]/60 border border-dashed border-slate-700 text-center space-y-1">
                <p className="text-xs text-slate-300 font-medium">
                  Nenhum operador cadastrado ainda.
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
                          type="button"
                          onClick={() => setOperatorToDelete({ id: op.id, name: op.name })}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
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

      {/* MODAL: NOVO VEÍCULO / EDITAR VEÍCULO COM FOTO */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Car size={16} className="text-cyan-400" />
                  {editingVehicle ? 'Editar Veículo & Foto' : 'Cadastrar Novo Veículo'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {editingVehicle
                    ? `Atualize os dados e a imagem do veículo ${editingVehicle.code}`
                    : 'Adicione um novo carrinho com foto personalizada à frota'}
                </p>
              </div>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4">
              {/* 1. Nome e Código */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
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
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                    Número / Código
                  </label>
                  <input
                    type="text"
                    value={vehCode}
                    onChange={(e) => setVehCode(e.target.value)}
                    placeholder="Ex: #14"
                    className="w-full px-3 py-2 rounded-xl bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {/* 2. Categoria */}
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  Categoria do Veículo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DRIFT', 'JEEP', 'BATE_BATE'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setVehCategory(cat)}
                      className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition-all ${
                        vehCategory === cat
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm font-extrabold'
                          : 'bg-[#141E38] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cat === 'DRIFT' ? '🏎️ Drift' : cat === 'JEEP' ? '🚙 Jeep' : '⚡ Bate-Bate'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Seção de Foto do Carro */}
              <div className="space-y-2.5 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Camera size={13} />
                    Foto do Veículo
                  </label>
                  {vehImageUrl && (
                    <button
                      type="button"
                      onClick={() => setVehImageUrl('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Remover foto
                    </button>
                  )}
                </div>

                {/* Preview Box */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#141E38]/80 border border-slate-700">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[#0B132B] border border-cyan-500/40 shrink-0 flex items-center justify-center">
                    {vehImageUrl ? (
                      <img
                        src={vehImageUrl}
                        alt="Foto do carro"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-1">
                        <Camera size={22} className="mx-auto text-slate-500 mb-0.5" />
                        <span className="text-[9px] text-slate-500 leading-tight block">Sem foto</span>
                      </div>
                    )}
                    {vehImageUrl && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/80 rounded text-[9px] font-mono text-cyan-300 font-bold">
                        {vehCode || '#00'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    {/* Botão de Upload / Câmera */}
                    <div>
                      <input
                        type="file"
                        id="car-photo-file-input"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="car-photo-file-input"
                        className="w-full py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                      >
                        <Upload size={14} className="text-cyan-400" />
                        <span>Carregar do Aparelho / Câmera</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                      <span>Formatos: JPG, PNG, WebP</span>
                      <button
                        type="button"
                        onClick={() => setIsCustomUrlMode(!isCustomUrlMode)}
                        className="text-cyan-400 hover:underline"
                      >
                        {isCustomUrlMode ? 'Ocultar Link' : 'Colar Link URL'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Campo Opcional de Link URL */}
                {isCustomUrlMode && (
                  <div className="p-2.5 rounded-xl bg-[#0B132B] border border-slate-700/80 space-y-1 animate-in fade-in">
                    <label className="text-[10px] text-slate-400 font-semibold block">
                      Link direto da imagem na internet:
                    </label>
                    <input
                      type="url"
                      value={vehImageUrl}
                      onChange={(e) => setVehImageUrl(e.target.value)}
                      placeholder="https://exemplo.com/foto-do-carro.jpg"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#141E38] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                )}

                {/* Galeria de Fotos Rápidas da Categoria */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Ou escolha uma foto rápida ({vehCategory}):
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {VEHICLE_IMAGE_PRESETS[vehCategory]?.map((preset, idx) => {
                      const isChosen = vehImageUrl === preset.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setVehImageUrl(preset.url)}
                          className={`relative rounded-xl overflow-hidden border transition-all aspect-square group ${
                            isChosen
                              ? 'border-cyan-400 ring-2 ring-cyan-400/50 scale-[1.03]'
                              : 'border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                          }`}
                          title={preset.label}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover"
                          />
                          {isChosen && (
                            <div className="absolute inset-0 bg-cyan-950/40 flex items-center justify-center">
                              <span className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 text-xs font-black flex items-center justify-center">
                                ✓
                              </span>
                            </div>
                          )}
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-slate-200 py-0.5 px-1 truncate block text-center">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsVehicleModalOpen(false);
                    setEditingVehicle(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-[0_0_12px_rgba(0,180,216,0.35)] transition-all"
                >
                  {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
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
              A sub-conta será vinculada diretamente à sua conta e pista de administrador. Escolha se o funcionário terá acesso restrito de Operador ou acesso de Administrador.
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

      {/* MODAL: CONFIRMAR EXCLUSÃO DE OPERADOR */}
      {operatorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-rose-500/40 p-5 shadow-2xl space-y-3.5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <Trash2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-white">Remover operador?</h3>
            <p className="text-xs text-slate-300">
              Deseja realmente remover o acesso de <strong>{operatorToDelete.name}</strong>?
            </p>
            <p className="text-[11px] text-slate-400">
              Ele não poderá mais acessar o painel de operador desta pista.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOperatorToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = operatorToDelete.id;
                  setOperatorToDelete(null);
                  await deleteOperator(id);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

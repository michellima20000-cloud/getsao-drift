import React, { useState, useRef, useEffect } from 'react';
import { useDriftPark } from '../context/DriftParkContext';
import { Vehicle, VehicleCategory, UserRole } from '../types';
import {
  ShieldCheck,
  Plus,
  Car,
  UserPlus,
  FileSpreadsheet,
  Settings,
  Trash2,
  Wrench,
  Lock,
  X,
  Pencil,
  Camera,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Check,
  Copy,
  KeyRound,
  CheckCheck,
  LogIn,
  ZoomIn,
} from 'lucide-react';

export const ManagementScreen: React.FC = () => {
  const {
    currentUser,
    currentTenant,
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

  // Modal de Foto Ampliada
  const [zoomedPhoto, setZoomedPhoto] = useState<{
    url: string;
    title: string;
    code?: string;
    category?: string;
  } | null>(null);

  // Vehicle Form State
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehName, setVehName] = useState('');
  const [vehCode, setVehCode] = useState('');
  const [vehCategory, setVehCategory] = useState<VehicleCategory>('DRIFT');
  const [vehImageUrl, setVehImageUrl] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // HIERARQUIA & ISOLAMENTO ESTRITO POR tenantId E ADMIN
  // 1. Administrador logado atual (apenas 1 card no topo)
  const adminUser = currentUser;

  // 2. Operadores vinculados estritamente a este Administrador e à Pista
  const tenantOperators = users.filter(
    (u) =>
      (u.tenantId === currentUser?.tenantId || u.adminEmail === currentUser?.email) &&
      u.role === 'operador' &&
      u.id !== currentUser?.id &&
      u.email.toLowerCase() !== (currentUser?.email || '').toLowerCase()
  );

  // Deduplicação estrita para garantir zero repetições na UI
  const uniqueOperators = Array.from(
    new Map(tenantOperators.map((op) => [op.email.toLowerCase(), op])).values()
  );

  // Stop camera stream safely
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  // Cleanup camera on unmount or modal close
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleOpenNewVehicle = () => {
    stopCamera();
    setEditingVehicle(null);
    setVehName('');
    setVehCode(`#${vehicles.length + 1}`);
    setVehCategory('DRIFT');
    setVehImageUrl('');
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (veh: Vehicle) => {
    stopCamera();
    setEditingVehicle(veh);
    setVehName(veh.name);
    setVehCode(veh.code);
    setVehCategory(veh.category);
    setVehImageUrl(veh.imageUrl || '');
    setIsVehicleModalOpen(true);
  };

  const handleCloseVehicleModal = () => {
    stopCamera();
    setIsVehicleModalOpen(false);
    setEditingVehicle(null);
    setVehImageUrl('');
  };

  // Process and compress image file (computer or mobile camera roll)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Redimensiona proporcionalmente para otimizar armazenamento (max 400px)
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
          setVehImageUrl(compressedDataUrl);
          stopCamera();
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so user can pick same file again if desired
    e.target.value = '';
  };

  // Start Live Camera stream (laptop webcam or mobile camera)
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Câmera não suportada neste navegador. Use o botão "Enviar Foto".');
        return;
      }

      // Tenta abrir câmera traseira no celular se disponível
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setIsCameraActive(true);

      // Attach stream to video tag
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.warn('Erro ao acessar câmera:', err);
      // Fallback para qualquer câmera caso ideal: environment falhe
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        setIsCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(() => {});
          }
        }, 100);
      } catch (fallbackErr: any) {
        setCameraError('Permissão de câmera negada ou dispositivo indisponível. Você também pode enviar uma foto do celular ou computador.');
      }
    }
  };

  // Capture frame from active camera stream
  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const maxDim = 400;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;
    if (width > maxDim) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.65);
      setVehImageUrl(photoDataUrl);
      stopCamera();
    }
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
        imageUrl: vehImageUrl || undefined,
      });
    } else {
      addVehicle(
        vehName.trim(),
        formattedCode,
        vehCategory,
        vehImageUrl || undefined
      );
    }

    setVehName('');
    setVehCode('');
    setVehImageUrl('');
    setEditingVehicle(null);
    stopCamera();
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vehicles.map((veh) => {
            const isAvailable = veh.status === 'disponivel';
            const isInUse = veh.status === 'em_uso';
            const isMaintenance = veh.status === 'manutencao';

            const categoryEmoji =
              veh.category === 'DRIFT' ? '🏎️' : veh.category === 'JEEP' ? '🚙' : '⚡';

            return (
              <div
                key={veh.id}
                className="rounded-2xl bg-[#141E38] border border-slate-700/80 p-3.5 hover:border-cyan-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
              >
                {/* Left Side: Avatar/Photo & Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Photo or Styled Avatar em tamanho grande e nítido */}
                  <div
                    onClick={() => {
                      if (veh.imageUrl) {
                        setZoomedPhoto({
                          url: veh.imageUrl,
                          title: veh.name,
                          code: veh.code,
                          category: veh.category,
                        });
                      }
                    }}
                    className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-500/40 flex items-center justify-center shrink-0 shadow-md group ${
                      veh.imageUrl ? 'cursor-pointer hover:border-cyan-300' : ''
                    }`}
                    title={veh.imageUrl ? 'Clique para ampliar foto' : undefined}
                  >
                    {veh.imageUrl ? (
                      <>
                        <img
                          src={veh.imageUrl}
                          alt={veh.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            // Se a imagem falhar ao carregar, esconde e mostra o ícone estilizado
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute bottom-1 right-1 bg-black/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow opacity-90 group-hover:opacity-100 transition-all">
                          <ZoomIn size={10} />
                          <span>Ver</span>
                        </div>
                      </>
                    ) : null}

                    {/* Fallback caso não haja foto ou imagem quebre */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center text-center p-1 bg-gradient-to-br from-[#1C2541] to-[#0B132B] ${veh.imageUrl ? '-z-10' : ''}`}>
                      <span className="text-xl leading-none">{categoryEmoji}</span>
                      <span className="text-[10px] font-black text-cyan-300 font-mono mt-0.5">
                        {veh.code}
                      </span>
                    </div>

                    {/* Badge do Código do Carrinho no canto superior */}
                    <div className="absolute top-1 left-1 bg-black/85 px-1.5 py-0.5 rounded text-[9px] font-mono font-black text-cyan-300 border border-cyan-500/40">
                      {veh.code}
                    </div>
                  </div>

                  {/* Vehicle Details */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-black text-cyan-300 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-500/40 shrink-0">
                        {veh.code}
                      </span>
                      <h4 className="text-sm font-bold text-white truncate" title={veh.name}>
                        {veh.name}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                      <span className="text-cyan-400 font-semibold">{veh.category}</span>
                      <span>•</span>
                      <span>{veh.totalRuns || 0} corridas</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">{veh.batteryLevel || 100}% bat</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Status Badge & Action Controls (separados claramente sem sobreposição) */}
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
                      isAvailable
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isInUse
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {isAvailable ? 'Livre' : isInUse ? 'Em Uso' : 'Manutenção'}
                  </span>

                  {/* Admin Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenEditVehicle(veh)}
                        className="p-1.5 rounded-lg bg-slate-800/90 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-colors shadow-sm active:scale-95"
                        title="Editar veículo e foto"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        onClick={() =>
                          updateVehicleStatus(
                            veh.id,
                            isMaintenance ? 'disponivel' : 'manutencao'
                          )
                        }
                        className={`p-1.5 rounded-lg border transition-colors shadow-sm active:scale-95 ${
                          isMaintenance
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800/90 text-slate-400 hover:text-amber-300 border-slate-700 hover:border-amber-500/40'
                        }`}
                        title={isMaintenance ? 'Retirar da manutenção' : 'Colocar em manutenção'}
                      >
                        <Wrench size={13} />
                      </button>

                      <button
                        onClick={() => deleteVehicle(veh.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 transition-colors shadow-sm active:scale-95"
                        title="Excluir veículo da frota"
                      >
                        <Trash2 size={13} />
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
              <div className="space-y-2.5">
                {uniqueOperators.map((op) => (
                  <div
                    key={op.id}
                    className="p-3.5 rounded-xl bg-[#141E38] border border-slate-700/80 hover:border-cyan-500/50 transition-all shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-sm shrink-0 font-bold mt-0.5">
                          🏎️
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs">
                            <span>{op.name}</span>
                          </div>
                          <div className="text-[11px] text-cyan-400 font-mono mt-0.5">{op.email}</div>
                          
                          {/* Vínculo com o Administrador */}
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-500">Vinculado ao Dono:</span>
                            <span className="px-1.5 py-0.5 rounded bg-[#0B132B] text-amber-300 font-mono border border-slate-700">
                              👑 {op.adminEmail || currentUser?.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          🏎️ Operador
                        </span>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setOperatorToDelete({ id: op.id, name: op.name })}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remover operador"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de Senha e Ações Rápidas */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <KeyRound size={12} className="text-amber-400" />
                        <span>Senha:</span>
                        <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-bold text-[10px] border border-slate-800">
                          {op.savedPassword || '123456'}
                        </code>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const credText = `Acesso Operador Drift Park:\nE-mail: ${op.email}\nSenha: ${op.savedPassword || '123456'}\nAdministrador: ${op.adminEmail || currentUser?.email}`;
                            navigator.clipboard.writeText(credText);
                            setCopiedId(op.id);
                            setTimeout(() => setCopiedId(null), 2500);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 border transition-all ${
                            copiedId === op.id
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="Copiar dados de acesso para enviar ao operador"
                        >
                          {copiedId === op.id ? (
                            <>
                              <CheckCheck size={11} className="text-emerald-400" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copiar Acesso</span>
                            </>
                          )}
                        </button>
                      </div>
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

      {/* MODAL: NOVO VEÍCULO / EDITAR VEÍCULO */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-cyan-500/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Car size={16} className="text-cyan-400" />
                  {editingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {editingVehicle
                    ? `Atualize os dados do veículo ${editingVehicle.code}`
                    : 'Adicione um novo carrinho à frota'}
                </p>
              </div>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-3.5">
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

              {/* 3. Foto do Veículo (Celular, Computador ou Tirar Foto) */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-cyan-400" />
                    <span>Foto do Veículo</span>
                  </label>
                  {vehImageUrl && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Check size={12} /> Foto anexada
                    </span>
                  )}
                </div>

                {/* Stream da Câmera Ao Vivo (quando ativo) */}
                {isCameraActive ? (
                  <div className="rounded-xl border border-cyan-500/50 bg-black overflow-hidden relative space-y-2 p-2">
                    <div className="relative rounded-lg overflow-hidden bg-slate-950 aspect-video flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-bold flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white" /> Câmera Ativa
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhotoFromCamera}
                        className="flex-1 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Camera size={15} />
                        <span>Capturar Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Hidden Native File Inputs com Refs para garantir clique infalível no celular e PC */}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Preview da foto se existir em tamanho grande e nítido */}
                    {vehImageUrl ? (
                      <div className="relative rounded-2xl border-2 border-cyan-500/50 bg-[#0F172A] p-3 space-y-3 shadow-xl">
                        {/* Imagem Grande e Nítida */}
                        <div
                          onClick={() =>
                            setZoomedPhoto({
                              url: vehImageUrl,
                              title: vehName || 'Foto do Veículo',
                              code: vehCode,
                              category: vehCategory,
                            })
                          }
                          className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-black/90 flex items-center justify-center cursor-pointer group border border-slate-800"
                          title="Clique para ver a foto em tela cheia"
                        >
                          <img
                            src={vehImageUrl}
                            alt="Pré-visualização do veículo"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute top-2 right-2 bg-black/80 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-cyan-500/40 shadow backdrop-blur-sm transition-all">
                            <ZoomIn size={14} />
                            <span>Ampliar Foto</span>
                          </div>
                          <div className="absolute bottom-2 left-2 bg-black/85 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/40">
                            ✓ Foto Nítida Carregada
                          </div>
                        </div>

                        {/* Botões de Ação na Foto */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 flex-wrap">
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-cyan-500/30 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Upload size={14} />
                            <span>Trocar Foto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Camera size={14} />
                            <span>Tirar Outra</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVehImageUrl('')}
                            className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/40 flex items-center gap-1 transition-all"
                          >
                            <Trash2 size={13} />
                            <span>Remover</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Opções de Upload: Celular, Computador ou Câmera com clique direto e confiável */
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {/* Opção 1: Enviar Foto (Galeria do Celular ou Arquivos do Computador) */}
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="p-4 rounded-xl border border-slate-700 hover:border-cyan-500/60 bg-[#141E38] hover:bg-[#1C2541] text-slate-300 hover:text-cyan-300 transition-all flex flex-col items-center justify-center text-center gap-1.5 group active:scale-95 shadow-sm"
                          >
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                              <Upload size={20} />
                            </div>
                            <span className="text-xs font-bold text-white">Enviar Foto</span>
                            <span className="text-[10px] text-slate-400">Galeria ou PC</span>
                          </button>

                          {/* Opção 2: Tirar Foto Direta (Abre a câmera nativa no Celular) */}
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="p-4 rounded-xl border border-slate-700 hover:border-amber-500/60 bg-[#141E38] hover:bg-[#1C2541] text-slate-300 hover:text-amber-300 transition-all flex flex-col items-center justify-center text-center gap-1.5 group active:scale-95 shadow-sm"
                          >
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center">
                              <Camera size={20} />
                            </div>
                            <span className="text-xs font-bold text-white">Tirar Foto</span>
                            <span className="text-[10px] text-slate-400">Câmera agora</span>
                          </button>
                        </div>

                        {/* Campo Alternativo: Digitar Link / URL da foto */}
                        <div className="pt-0.5">
                          <input
                            type="text"
                            value={vehImageUrl}
                            onChange={(e) => setVehImageUrl(e.target.value)}
                            placeholder="Ou cole aqui o link da foto (URL)..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {cameraError && (
                      <p className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2 rounded-lg">
                        {cameraError}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseVehicleModal}
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

            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-cyan-300 text-xs">
                <span>👑 Vinculação Automática com o Administrador:</span>
              </div>
              <div className="font-mono text-amber-300 text-[11px] font-semibold">
                {currentUser?.email}
              </div>
              <p className="text-[10px] text-slate-400">
                A sub-conta é autenticada no Firebase e vinculada diretamente a você. O operador terá acesso restrito às corridas e à pista, sem acesso aos lucros totais.
              </p>
            </div>

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
                        setNewPriceValue(String((currentTenant?.pricing && currentTenant.pricing[min]) || min * 2.5));
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

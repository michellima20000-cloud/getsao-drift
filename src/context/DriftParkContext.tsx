import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UserProfile,
  Tenant,
  Vehicle,
  Rental,
  QueueItem,
  VehicleCategory,
  VehicleStatus,
  PaymentMethod,
  PaymentStatus,
  RentalMode,
  UserRole,
} from '../types';
import {
  INITIAL_TENANTS,
  INITIAL_USERS,
  INITIAL_VEHICLES,
  INITIAL_RENTALS,
  INITIAL_QUEUE,
} from '../data/initialData';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  checkEmailAlreadyExists,
  createSubAccountInAuth,
  getFirestoreUserProfile,
  getIsFirestoreAvailable,
  markFirestoreUnavailable,
  markFirestoreAvailable,
  testAndVerifyFirestore,
} from '../services/firebase';

interface DriftParkContextType {
  currentUser: UserProfile | null;
  currentTenant: Tenant;
  allTenants: Tenant[];
  vehicles: Vehicle[];
  allVehicles: Vehicle[];
  rentals: Rental[];
  queue: QueueItem[];
  users: UserProfile[];
  activeTab: 'inicio' | 'novo' | 'historico' | 'fila' | 'gestao';
  setActiveTab: (tab: 'inicio' | 'novo' | 'historico' | 'fila' | 'gestao') => void;
  prefilledQueueItem: QueueItem | null;
  setPrefilledQueueItem: (item: QueueItem | null) => void;
  isFirestoreOnline: boolean;
  verifyFirestoreConnection: () => Promise<{ success: boolean; message: string }>;
  isAlarmMuted: boolean;
  toggleAlarmMute: () => void;

  // Auth & Multi-tenant actions
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  quickLoginAs: (role: UserRole) => void;
  switchTenant: (tenantId: string) => void;
  createSubAccount: (name: string, email: string, password: string, role: UserRole) => Promise<{ success: boolean; message?: string }>;
  deleteOperator: (operatorId: string) => Promise<boolean>;

  // Rental operations
  startRental: (data: {
    vehicleId: string;
    customerName?: string;
    customerPhone?: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    mode: RentalMode;
  }) => string | null;
  finishRental: (rentalId: string, updatedPaymentMethod?: PaymentMethod, updatedPaymentStatus?: PaymentStatus) => void;
  cancelRental: (rentalId: string) => void;
  extendRental: (rentalId: string, additionalMinutes: number, additionalAmount: number) => void;
  updateRentalPayment: (rentalId: string, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus) => void;
  deleteRental: (rentalId: string) => void;
  clearRentalHistory: () => void;
  addPastRental: (data: {
    date: string;
    time?: string;
    vehicleId: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    customerName?: string;
    notes?: string;
  }) => string | null;
  addPastDaySummary: (data: {
    date: string;
    shiftName?: string;
    totalAmount: number;
    pixAmount: number;
    cardAmount: number;
    cashAmount: number;
    totalRuns: number;
    notes?: string;
  }) => boolean;

  // Fleet operations
  addVehicle: (name: string, code: string, category: VehicleCategory, imageUrl?: string) => boolean;
  updateVehicle: (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => void;
  updateVehicleStatus: (vehicleId: string, status: VehicleStatus) => void;
  deleteVehicle: (vehicleId: string) => void;

  // Queue operations
  addToQueue: (customerName: string, customerPhone: string, categoryDesired: VehicleCategory, durationMinutes: number) => void;
  removeFromQueue: (queueId: string) => void;
  clearQueue: () => void;
  callQueueItemToTrack: (queueItem: QueueItem) => void;

  // Settings & Reports
  exportDailyReport: () => void;
  updatePriceTier: (durationMinutes: number, price: number) => void;
  playSound: (type: 'start' | 'finish' | 'click' | 'alert' | 'countdown_beep' | 'countdown_go') => void;
}

const DriftParkContext = createContext<DriftParkContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TENANTS: 'driftpark_tenants_v1',
  CURRENT_TENANT: 'driftpark_current_tenant_v1',
  USERS: 'driftpark_users_v1',
  CURRENT_USER: 'driftpark_current_user_v1',
  VEHICLES: 'driftpark_vehicles_v1',
  RENTALS: 'driftpark_rentals_v1',
  QUEUE: 'driftpark_queue_v1',
};

// Web Audio API sound synthesizer potente e com alarme sonoro forte de fim de corrida
const playTone = (type: 'start' | 'finish' | 'click' | 'alert' | 'countdown_beep' | 'countdown_go') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'start') {
      // 3 racing beeps: low, mid, high
      [0, 0.15, 0.3].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = idx === 2 ? 880 : 520;
        gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.13);
      });
    } else if (type === 'finish') {
      // EFEITO SONORO BEM FORTE PARA AVISAR O ADMINISTRADOR QUE A CORRIDA TERMINOU
      // Alarme potente estilo sirene/buzina de kartódromo em alta potência (5 pulsos fortes)
      const pulses = [0, 0.28, 0.56, 0.84, 1.12];
      pulses.forEach((offset, idx) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc3.type = 'triangle';

        const baseFreq = idx % 2 === 0 ? 1046.5 : 880; // C6 e A5 alternados
        osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime + offset);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, ctx.currentTime + offset + 0.22);

        osc2.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime + offset);
        osc3.frequency.setValueAtTime(baseFreq * 2, ctx.currentTime + offset);

        osc1.connect(gain);
        osc2.connect(gain);
        osc3.connect(gain);
        gain.connect(ctx.destination);

        // Volume elevado e estridente (0.95 peak)
        gain.gain.setValueAtTime(0.95, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.24);

        osc1.start(ctx.currentTime + offset);
        osc1.stop(ctx.currentTime + offset + 0.25);
        osc2.start(ctx.currentTime + offset);
        osc2.stop(ctx.currentTime + offset + 0.25);
        osc3.start(ctx.currentTime + offset);
        osc3.stop(ctx.currentTime + offset + 0.25);
      });
    } else if (type === 'countdown_beep') {
      // Beep de contagem regressiva da largada (3, 2, 1)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.19);
    } else if (type === 'countdown_go') {
      // Alerta de LARGADA / GO! (potente e agudo)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.65, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 350;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio context may be restricted before user gesture
  }
};

export const DriftParkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Tenants State
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TENANTS);
    return saved ? JSON.parse(saved) : INITIAL_TENANTS;
  });

  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT);
    return saved || INITIAL_TENANTS[0].id;
  });

  const currentTenant = allTenants.find((t) => t.id === currentTenantId) || allTenants[0];

  // Helper para identificar apenas dados dummy de teste internos
  const isMockEmail = (email?: string): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return (
      lower === 'test-internal-dummy@speedarena.test' ||
      lower === 'fake-sample-bot@driftpark.test'
    );
  };

  // 2. Users State: Carregado de forma resiliente preservando todos os operadores cadastrados
  const [users, setUsers] = useState<UserProfile[]>(() => {
    let list: UserProfile[] = [];
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: UserProfile[] = JSON.parse(saved);
        list = parsed.filter((u) => !isMockEmail(u.email));
      } catch {}
    }

    // Carrega também de backups de operadores salvos por tenant/admin
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('driftpark_operators_') || key.startsWith('driftpark_admin_operators_'))) {
          const ops: UserProfile[] = JSON.parse(localStorage.getItem(key) || '[]');
          for (const op of ops) {
            if (op && op.email && !list.some((u) => u.email.toLowerCase() === op.email.toLowerCase())) {
              list.push(op);
            }
          }
        }
      }
    } catch {}

    // Se não houver operador registrado na equipe, assegura operador vinculado ao Administrador Michel Lima
    const hasOp = list.some((u) => u.role === 'operador');
    if (!hasOp) {
      list.push({
        id: 'usr_op_pista_01',
        name: 'Operador de Pista',
        email: 'operador.pista@driftpark.com',
        role: 'operador',
        tenantId: 'tenant_drift_01',
        adminEmail: 'michel.lima20000@gmail.com',
        adminName: 'Michel Lima',
        createdBy: 'michel.lima20000@gmail.com',
        createdAt: Date.now() - 3600000,
        savedPassword: '123456',
      });
    }

    return list;
  });

  // Usuário Administrador Real (Michel Lima)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        const parsed: UserProfile = JSON.parse(saved);
        if (parsed && !isMockEmail(parsed.email)) {
          return parsed;
        }
      } catch {
        // Ignora
      }
    }
    return {
      id: 'usr_admin_michel',
      name: 'Michel Lima',
      email: 'michel.lima20000@gmail.com',
      role: 'admin',
      tenantId: 'tenant_drift_01',
      createdAt: Date.now() - 3600000,
    };
  });

  // 3. Vehicles State
  const [vehiclesState, setVehiclesState] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  // 4. Rentals State
  const [rentalsState, setRentalsState] = useState<Rental[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RENTALS);
    return saved ? JSON.parse(saved) : INITIAL_RENTALS;
  });

  // 5. Queue State
  const [queueState, setQueueState] = useState<QueueItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
    return saved ? JSON.parse(saved) : INITIAL_QUEUE;
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'inicio' | 'novo' | 'historico' | 'fila' | 'gestao'>('inicio');
  const [prefilledQueueItem, setPrefilledQueueItem] = useState<QueueItem | null>(null);

  // Status de disponibilidade do Firestore na nuvem
  const [isFirestoreOnline, setIsFirestoreOnline] = useState<boolean>(() => getIsFirestoreAvailable());
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const toggleAlarmMute = () => setIsAlarmMuted((prev) => !prev);

  const verifyFirestoreConnection = async () => {
    const res = await testAndVerifyFirestore();
    setIsFirestoreOnline(res.success);
    return res;
  };

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(allTenants));
  }, [allTenants]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, currentTenantId);
  }, [currentTenantId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    try {
      const ops = users.filter((u) => u.role === 'operador');
      if (ops.length > 0) {
        if (currentTenant?.id) {
          const tenantOps = ops.filter((u) => u.tenantId === currentTenant.id);
          localStorage.setItem(`driftpark_operators_${currentTenant.id}`, JSON.stringify(tenantOps));
        }
        if (currentUser?.email) {
          const adminOps = ops.filter(
            (u) => u.adminEmail === currentUser.email || u.tenantId === currentUser.tenantId
          );
          localStorage.setItem(`driftpark_admin_operators_${currentUser.email}`, JSON.stringify(adminOps));
        }
      }
    } catch {}
  }, [users, currentTenant?.id, currentUser?.email, currentUser?.tenantId]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehiclesState));
  }, [vehiclesState]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RENTALS, JSON.stringify(rentalsState));
  }, [rentalsState]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queueState));
  }, [queueState]);

  // Alarme sonoro contínuo e repetitivo de fim de corrida
  // Fica tocando periodicamente avisando o administrador ou operador que terminou
  // e só para quando a corrida for finalizada ou se o usuário silenciar temporariamente.
  const alertedRentalIdsRef = React.useRef<Set<string>>(new Set());
  const isAlarmMutedRef = React.useRef(isAlarmMuted);
  useEffect(() => {
    isAlarmMutedRef.current = isAlarmMuted;
  }, [isAlarmMuted]);

  useEffect(() => {
    let tickCount = 0;
    const timer = setInterval(() => {
      const now = Date.now();
      const expiredActiveRentals = rentalsState.filter(
        (r) => r.status === 'ativa' && r.endTime <= now
      );

      if (expiredActiveRentals.length > 0) {
        let hasNewExpired = false;
        expiredActiveRentals.forEach((r) => {
          if (!alertedRentalIdsRef.current.has(r.id)) {
            alertedRentalIdsRef.current.add(r.id);
            hasNewExpired = true;
          }
        });

        tickCount++;
        // Toca imediatamente no 0:00 e repete a cada 5 segundos enquanto não finalizada
        if ((hasNewExpired || tickCount % 5 === 0) && !isAlarmMutedRef.current) {
          playTone('finish');
        }
      } else {
        tickCount = 0;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [rentalsState]);

  // STRICT MULTI-TENANT FILTERING
  // All active data shown to the UI must match currentTenant.id
  const vehicles = vehiclesState.filter((v) => v.tenantId === currentTenant.id);
  const rentals = rentalsState.filter((r) => r.tenantId === currentTenant.id);
  const queue = queueState.filter((q) => q.tenantId === currentTenant.id);

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DA EQUIPE (FILTRO ESTRITO POR tenantId)
  // Conforme solicitação: .collection('users').where('tenantId', '==', currentUser.tenantId)
  // =========================================================================
  useEffect(() => {
    if (!currentUser?.tenantId) return;
    if (!isFirestoreOnline || !getIsFirestoreAvailable()) return;

    const targetTenantId = currentUser.tenantId;

    let unsubscribe = () => {};
    try {
      const q = query(
        collection(db, 'users'),
        where('tenantId', '==', targetTenantId)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveMembers: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (!d) return;
            const email = (d.email || '').toLowerCase().trim();
            if (isMockEmail(email)) return;

            liveMembers.push({
              id: docSnap.id,
              name: d.name || email.split('@')[0],
              email,
              role: d.role === 'admin' ? 'admin' : 'operador',
              tenantId: d.tenantId || targetTenantId,
              phone: d.phone,
              createdAt: d.createdAt || Date.now(),
              adminEmail: d.adminEmail || d.createdBy,
              adminName: d.adminName,
              createdBy: d.createdBy,
            });
          });

          setUsers((prev) => {
            const memberMap = new Map<string, UserProfile>();

            // 1. Preserva todos os usuários e operadores já conhecidos no estado local
            for (const u of prev) {
              if (u && u.email && !isMockEmail(u.email)) {
                memberMap.set(u.email.toLowerCase(), u);
              }
            }

            // 2. Mescla e enriquece com dados reais da nuvem
            for (const m of liveMembers) {
              if (m && m.email && !isMockEmail(m.email)) {
                const existing = memberMap.get(m.email.toLowerCase());
                memberMap.set(m.email.toLowerCase(), {
                  ...existing,
                  ...m,
                  adminEmail: m.adminEmail || existing?.adminEmail || currentUser?.email,
                  adminName: m.adminName || existing?.adminName || currentUser?.name,
                  createdBy: m.createdBy || existing?.createdBy || currentUser?.email,
                  savedPassword: existing?.savedPassword,
                });
              }
            }

            // 3. Garante que o Administrador logado atual permaneça na lista
            if (currentUser && currentUser.email) {
              const curExisting = memberMap.get(currentUser.email.toLowerCase());
              memberMap.set(currentUser.email.toLowerCase(), {
                ...curExisting,
                ...currentUser,
              });
            }

            return Array.from(memberMap.values());
          });
        },
        () => {
          markFirestoreUnavailable();
          setIsFirestoreOnline(false);
        }
      );
    } catch {
      markFirestoreUnavailable();
      setIsFirestoreOnline(false);
    }

    return () => unsubscribe();
  }, [currentUser?.tenantId, currentUser?.id, currentUser?.email, isFirestoreOnline]);

  // Garante que o documento do Admin exista na coleção 'users' do Firestore apenas se Firestore online
  useEffect(() => {
    if (currentUser?.id && !isMockEmail(currentUser.email) && isFirestoreOnline && getIsFirestoreAvailable()) {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        getDoc(userRef)
          .then((snap) => {
            if (!snap.exists()) {
              setDoc(userRef, {
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email.toLowerCase().trim(),
                role: currentUser.role,
                tenantId: currentUser.tenantId,
                createdAt: currentUser.createdAt || Date.now(),
              }).catch(() => {});
            }
          })
          .catch(() => {
            markFirestoreUnavailable();
            setIsFirestoreOnline(false);
          });
      } catch {
        markFirestoreUnavailable();
        setIsFirestoreOnline(false);
      }
    }
  }, [currentUser?.id, currentUser?.tenantId, isFirestoreOnline]);

  // Corridas em andamento permanecem na tela ativa até que o operador ou administrador
  // clique explicitamente em Finalizar (permitindo conferir ou receber pagamento e liberar o carrinho).

  // Auth functions with Firebase project gympulse-personal
  const register = async (name: string, email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const effectivePassword = password.trim();

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };
    if (!effectivePassword || effectivePassword.length < 6) {
      return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    let firebaseUid: string | null = null;

    // Tenta registrar no Firebase Auth com timeout de segurança rápido
    if (getIsFirestoreAvailable() !== false) {
      try {
        const authPromise = createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000)
        );

        const cred = (await Promise.race([authPromise, timeoutPromise])) as any;
        if (cred && cred.user) {
          firebaseUid = cred.user.uid;
        }
      } catch (err: any) {
        if (err?.code === 'auth/email-already-in-use') {
          try {
            const cred = await Promise.race([
              signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
            ]) as any;
            if (cred && cred.user) {
              firebaseUid = cred.user.uid;
            }
          } catch {
            // Continuar para criação/recuperação local
          }
        }
      }
    }

    const userId = firebaseUid || `user_${Date.now()}`;
    const generatedTenantId =
      trimmedEmail === 'michel.lima20000@gmail.com'
        ? 'tenant_drift_01'
        : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser: UserProfile = {
      id: userId,
      email: trimmedEmail,
      name: trimmedName,
      role: 'admin', // Novos donos de pista cadastrados recebem perfil Admin
      tenantId: generatedTenantId,
      createdAt: Date.now(),
    };

    // Garante que o tenant exista na lista interna invisível
    setAllTenants((prev) => {
      if (prev.some((t) => t.id === generatedTenantId)) return prev;
      return [
        ...prev,
        {
          id: generatedTenantId,
          name: 'DRIFT PARK',
          city: 'Pista Principal',
          document: '00.000.000/0001-00',
          active: true,
          pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
        },
      ];
    });
    setCurrentTenantId(generatedTenantId);

    // Garante frota inicial pronta para uso nesta conta exclusiva
    setVehiclesState((prev) => {
      const existing = prev.filter((v) => v.tenantId === generatedTenantId);
      if (existing.length > 0) return prev;
      const initialFleet: Vehicle[] = [
        { id: `veh_${generatedTenantId}_01`, name: 'Drift Storm #01', code: '#01', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1596707204928-87b6131c1955?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_02`, name: 'Drift Storm #02', code: '#02', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 95, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_03`, name: 'Drift Storm #03', code: '#03', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 90, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_04`, name: 'Jeep Safari #01', code: '#04', category: 'JEEP', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_05`, name: 'Bate-Bate Nitro #01', code: '#05', category: 'BATE_BATE', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 85, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80' },
      ];
      return [...prev, ...initialFleet];
    });

    // Grava perfil no Firestore em 'users' e 'usuarios' para redundância se disponível
    if (getIsFirestoreAvailable() !== false) {
      try {
        const payload = {
          id: userId,
          name: trimmedName,
          email: trimmedEmail,
          role: 'admin',
          tenantId: generatedTenantId,
          createdAt: Date.now(),
        };
        setDoc(doc(db, 'users', userId), payload).catch(() => {});
        setDoc(doc(db, 'usuarios', userId), payload).catch(() => {});
      } catch {
        // Ignora erro de rede
      }
    }

    // Persiste no estado e localStorage
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
      return [...filtered, newUser];
    });
    setCurrentUser(newUser);
    playTone('start');
    return { success: true };
  };

  const login = async (email: string, password?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const effectivePassword = password?.trim() || '123456';

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };

    let firebaseUid: string | null = null;
    let authUserObj: any = null;

    // Autentica ou cria a conta diretamente no Firebase Authentication garantindo acesso
    try {
      const authAction = async () => {
        try {
          const cred = await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
          return cred.user;
        } catch (authErr: any) {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
            return newCred.user;
          } catch {
            return null;
          }
        }
      };

      const timeoutWork = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
      const resUser = await Promise.race([authAction(), timeoutWork]);
      if (resUser) {
        authUserObj = resUser;
        firebaseUid = resUser.uid;
      }
    } catch {}

    // 1. FAST PATH INSTANTÂNEO: Se o usuário já existe na lista local, entra IMEDIATAMENTE (<20ms)
    const existing = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existing) {
      setCurrentUser(existing);
      setCurrentTenantId(existing.tenantId);
      playTone('click');
      return { success: true };
    }

    // Se for o administrador principal Michel Lima
    const isPrimaryAdmin =
      trimmedEmail === 'michel.lima20000@gmail.com' ||
      trimmedEmail === 'michellimasilva979@gmail.com' ||
      trimmedEmail.startsWith('michel');

    if (isPrimaryAdmin) {
      const adminProfile: UserProfile = {
        id: firebaseUid || 'usr_admin_michel',
        name: 'Michel Lima',
        email: trimmedEmail,
        role: 'admin',
        tenantId: 'tenant_drift_01',
        createdAt: Date.now() - 3600000,
      };
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
        return [...filtered, adminProfile];
      });
      setCurrentUser(adminProfile);
      setCurrentTenantId('tenant_drift_01');
      playTone('click');
      return { success: true };
    }

    // 2. Metadados embutidos no Firebase Auth (Permite vincular Operador ao Administrador mesmo offline)
    let authMetadata: any = null;
    if (authUserObj?.photoURL) {
      try {
        authMetadata = JSON.parse(authUserObj.photoURL);
      } catch {}
    }

    // 3. Procura perfil salvo no Firestore com timeout estrito
    const firestoreProfile = await getFirestoreUserProfile(firebaseUid || trimmedEmail);
    const resolvedProfile = firestoreProfile || authMetadata;

    if (resolvedProfile) {
      const profile: UserProfile = {
        id: resolvedProfile.id || firebaseUid || `user_${Date.now()}`,
        email: trimmedEmail,
        name: resolvedProfile.name || authUserObj?.displayName || trimmedEmail.split('@')[0],
        role: resolvedProfile.role === 'admin' ? 'admin' : 'operador',
        tenantId: resolvedProfile.tenantId || currentTenant.id,
        phone: resolvedProfile.phone,
        createdAt: resolvedProfile.createdAt || Date.now(),
      };

      setAllTenants((prev) => {
        if (prev.some((t) => t.id === profile.tenantId)) return prev;
        return [
          ...prev,
          {
            id: profile.tenantId,
            name: 'DRIFT PARK',
            city: 'Pista Principal',
            document: '00.000.000/0001-00',
            active: true,
            pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
          },
        ];
      });

      setCurrentUser(profile);
      setCurrentTenantId(profile.tenantId);
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
        return [...filtered, profile];
      });
      playTone('click');
      return { success: true };
    }

    // 3. Novo cadastro de Administrador/Operador com entrada IMEDIATA
    const generatedTenantId =
      trimmedEmail === 'michel.lima20000@gmail.com' || trimmedEmail === 'michellimasilva979@gmail.com'
        ? 'tenant_drift_01'
        : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser: UserProfile = {
      id: firebaseUid || `user_${Date.now()}`,
      email: trimmedEmail,
      name: trimmedEmail.split('@')[0],
      role: 'admin',
      tenantId: generatedTenantId,
      createdAt: Date.now(),
    };

    setAllTenants((prev) => {
      if (prev.some((t) => t.id === generatedTenantId)) return prev;
      return [
        ...prev,
        {
          id: generatedTenantId,
          name: 'DRIFT PARK',
          city: 'Pista Principal',
          document: '00.000.000/0001-00',
          active: true,
          pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
        },
      ];
    });

    setVehiclesState((prev) => {
      const existingVeh = prev.filter((v) => v.tenantId === generatedTenantId);
      if (existingVeh.length > 0) return prev;
      return [
        { id: `veh_${generatedTenantId}_01`, name: 'Drift Storm #01', code: '#01', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1596707204928-87b6131c1955?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_02`, name: 'Drift Storm #02', code: '#02', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 95, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_03`, name: 'Drift Storm #03', code: '#03', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 90, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_04`, name: 'Jeep Safari #01', code: '#04', category: 'JEEP', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_05`, name: 'Bate-Bate Nitro #01', code: '#05', category: 'BATE_BATE', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 85, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80' },
      ];
    });

    setCurrentTenantId(generatedTenantId);

    // Grava no Firestore em segundo plano (sem travar a interface)
    if (getIsFirestoreAvailable() !== false) {
      const payload = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenantId,
        createdAt: newUser.createdAt,
      };
      setDoc(doc(db, 'users', newUser.id), payload).catch((err) => {
        if (err?.message?.includes('(padrão)') || err?.message?.includes('(default)') || err?.code === 'not-found') {
          markFirestoreUnavailable();
        }
      });
      setDoc(doc(db, 'usuarios', newUser.id), payload).catch(() => {});
    }

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    playTone('click');
    return { success: true };
  };

  const logout = () => {
    try {
      signOut(auth).catch(() => {});
    } catch {
      // Ignore
    }
    setCurrentUser(null);
    playTone('click');
  };

  const quickLoginAs = (role: UserRole) => {
    if (role === 'admin') {
      setCurrentUser({
        id: 'usr_admin_michel',
        name: 'Michel Lima',
        email: 'michel.lima20000@gmail.com',
        role: 'admin',
        tenantId: currentTenant.id,
        createdAt: Date.now() - 3600000,
      });
    } else {
      const foundOp = users.find((u) => u.tenantId === currentTenant.id && u.role === 'operador');
      if (foundOp) {
        setCurrentUser(foundOp);
      } else {
        setCurrentUser({
          id: 'usr_op_demo',
          name: 'Operador de Pista',
          email: `operador.${currentTenant.id}@pista.com`,
          role: 'operador',
          tenantId: currentTenant.id,
          createdAt: Date.now(),
        });
      }
    }
    playTone('click');
  };

  const switchTenant = (tenantId: string) => {
    setCurrentTenantId(tenantId);
    const userInTenant = users.find((u) => u.tenantId === tenantId);
    if (userInTenant) {
      setCurrentUser(userInTenant);
    } else if (currentUser) {
      setCurrentUser({ ...currentUser, tenantId });
    }
    playTone('click');
  };

  // =========================================================================
  // CRIAÇÃO DE SUB-CONTA COM EVITAÇÃO DE DUPLICAÇÃO E UID DO FIREBASE AUTH
  // =========================================================================
  const createSubAccount = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Apenas administradores podem criar sub-contas.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPassword = password.trim() || '123456';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail válido para o funcionário.' };
    }

    if (cleanPassword.length < 6) {
      return { success: false, message: 'A senha provisória deve conter no mínimo 6 caracteres.' };
    }

    // 1. CRIAÇÃO / VINCULAÇÃO NO FIREBASE AUTH (gera UID real e vincula ao tenant e e-mail do Admin)
    let uid: string;
    try {
      uid = await createSubAccountInAuth(cleanEmail, cleanPassword, {
        name: cleanName,
        role,
        tenantId: currentUser.tenantId,
        adminEmail: currentUser.email,
        adminName: currentUser.name,
      });
    } catch (authErr: any) {
      console.warn('Aviso ao registrar no Firebase Auth:', authErr);
      uid = `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    // 2. GRAVAÇÃO NO FIRESTORE (users e usuarios) COM O E-MAIL DO ADMINISTRADOR SALVO
    const userPayload = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      role,
      tenantId: currentUser.tenantId,
      adminEmail: currentUser.email,
      adminName: currentUser.name,
      createdBy: currentUser.email,
      createdAt: Date.now(),
    };

    try {
      setDoc(doc(db, 'users', uid), userPayload).catch(() => {});
      setDoc(doc(db, 'usuarios', uid), userPayload).catch(() => {});
      markFirestoreAvailable();
    } catch {
      // Offline fallback
    }

    // 3. ATUALIZA ESTADO LOCAL E BACKUPS DE FORMA RESILIENTE
    const newMember: UserProfile = {
      ...userPayload,
      savedPassword: cleanPassword,
    };

    setUsers((prev) => {
      const filtered = prev.filter(
        (u) => u.id !== uid && u.email.toLowerCase() !== cleanEmail
      );
      return [...filtered, newMember];
    });

    try {
      const curTenantOps = JSON.parse(
        localStorage.getItem(`driftpark_operators_${currentUser.tenantId}`) || '[]'
      );
      const updated = [
        ...curTenantOps.filter((o: any) => o.email?.toLowerCase() !== cleanEmail),
        newMember,
      ];
      localStorage.setItem(
        `driftpark_operators_${currentUser.tenantId}`,
        JSON.stringify(updated)
      );
      localStorage.setItem(
        `driftpark_admin_operators_${currentUser.email}`,
        JSON.stringify(updated)
      );
    } catch {}

    playTone('start');
    return { success: true, message: 'Operador cadastrado e vinculado ao administrador com sucesso!' };
  };

  const deleteOperator = async (operatorId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'admin') return false;
    try {
      deleteDoc(doc(db, 'users', operatorId)).catch(() => {});
      deleteDoc(doc(db, 'usuarios', operatorId)).catch(() => {});
      setUsers((prev) => prev.filter((u) => u.id !== operatorId));

      if (currentUser?.tenantId) {
        try {
          const curOps = JSON.parse(
            localStorage.getItem(`driftpark_operators_${currentUser.tenantId}`) || '[]'
          );
          localStorage.setItem(
            `driftpark_operators_${currentUser.tenantId}`,
            JSON.stringify(curOps.filter((u: any) => u.id !== operatorId))
          );
        } catch {}
      }
      if (currentUser?.email) {
        try {
          const adminOps = JSON.parse(
            localStorage.getItem(`driftpark_admin_operators_${currentUser.email}`) || '[]'
          );
          localStorage.setItem(
            `driftpark_admin_operators_${currentUser.email}`,
            JSON.stringify(adminOps.filter((u: any) => u.id !== operatorId))
          );
        } catch {}
      }

      playTone('alert');
      return true;
    } catch (err) {
      console.warn('Erro ao excluir operador:', err);
      return false;
    }
  };

  // Fleet Operations
  const addVehicle = (name: string, code: string, category: VehicleCategory, imageUrl?: string) => {
    const newVehicle: Vehicle = {
      id: `veh_${Date.now()}`,
      tenantId: currentTenant.id,
      name: name.trim(),
      code: code.startsWith('#') ? code : `#${code}`,
      category,
      status: 'disponivel',
      batteryLevel: 100,
      totalRuns: 0,
      imageUrl: imageUrl?.trim() || undefined,
    };
    setVehiclesState((prev) => [...prev, newVehicle]);
    playTone('click');
    return true;
  };

  const updateVehicle = (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => {
    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, ...data } : v))
    );
    playTone('click');
  };

  const updateVehicleStatus = (vehicleId: string, status: VehicleStatus) => {
    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, status } : v))
    );
    playTone('click');
  };

  const deleteVehicle = (vehicleId: string) => {
    setVehiclesState((prev) => prev.filter((v) => v.id !== vehicleId));
    playTone('alert');
  };

  // Rental Operations
  const startRental = (data: {
    vehicleId: string;
    customerName?: string;
    customerPhone?: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    mode: RentalMode;
  }) => {
    const vehicle = vehiclesState.find((v) => v.id === data.vehicleId);
    if (!vehicle) return null;

    const rentalId = `rent_${Date.now()}`;
    const startTime = Date.now();
    const endTime = startTime + data.durationMinutes * 60 * 1000;

    const newRental: Rental = {
      id: rentalId,
      tenantId: currentTenant.id,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleCode: vehicle.code,
      vehicleCategory: vehicle.category,
      vehicleImageUrl: vehicle.imageUrl,
      customerName: (data.customerName && data.customerName.trim()) || `Piloto ${vehicle.code}`,
      customerPhone: (data.customerPhone && data.customerPhone.trim()) || '-',
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      mode: data.mode,
      startTime,
      endTime,
      status: 'ativa',
      operatorId: currentUser?.id || 'op_anon',
      operatorName: currentUser?.name || 'Operador',
      createdAt: startTime,
    };

    setRentalsState((prev) => [newRental, ...prev]);

    // Mark vehicle as in use
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === vehicle.id
          ? {
              ...v,
              status: 'em_uso',
              activeRentalId: rentalId,
              totalRuns: (v.totalRuns || 0) + 1,
              batteryLevel: Math.max(10, (v.batteryLevel || 100) - 5),
            }
          : v
      )
    );

    // If customer was in queue, remove them
    if (prefilledQueueItem) {
      setQueueState((prev) => prev.filter((q) => q.id !== prefilledQueueItem.id));
      setPrefilledQueueItem(null);
    }

    // Grava também no Firestore para persistência em tempo real
    try {
      setDoc(doc(db, 'corridas', rentalId), {
        ...newRental,
        tenantId: currentTenant.id,
      }).catch(() => {});
    } catch {}

    playTone('start');
    return rentalId;
  };

  const finishRental = (
    rentalId: string,
    updatedPaymentMethod?: PaymentMethod,
    updatedPaymentStatus?: PaymentStatus
  ) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental) return;

    const finalPaymentMethod = updatedPaymentMethod || rental.paymentMethod;
    const finalPaymentStatus = updatedPaymentStatus || rental.paymentStatus;

    setRentalsState((prev) =>
      prev.map((r) =>
        r.id === rentalId
          ? {
              ...r,
              status: 'concluida',
              endTime: Date.now(),
              paymentMethod: finalPaymentMethod,
              paymentStatus: finalPaymentStatus,
            }
          : r
      )
    );

    // Release vehicle
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === rental.vehicleId ? { ...v, status: 'disponivel', activeRentalId: undefined } : v
      )
    );

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        {
          status: 'concluida',
          endTime: Date.now(),
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentStatus,
        },
        { merge: true }
      ).catch(() => {});
    } catch {}

    playTone('finish');
  };

  // Anular a corrida (cancela/anula a corrida e libera o veículo imediatamente)
  const cancelRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental) return;

    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, status: 'anulada', endTime: Date.now() } : r))
    );

    // Release vehicle
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === rental.vehicleId ? { ...v, status: 'disponivel', activeRentalId: undefined } : v
      )
    );

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { status: 'anulada', endTime: Date.now() },
        { merge: true }
      ).catch(() => {});
    } catch {}

    playTone('alert');
  };

  // Inserção Manual de Corrida Passada no Histórico (Data retroativa pelo administrador)
  const addPastRental = (data: {
    date: string; // YYYY-MM-DD
    time?: string; // HH:mm
    vehicleId: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    customerName?: string;
    notes?: string;
  }): string | null => {
    const vehicle = vehiclesState.find((v) => v.id === data.vehicleId) || vehiclesState[0];
    const rentalId = `rent_past_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const [year, month, day] = data.date.split('-').map(Number);
    let hours = 20;
    let minutes = 0;
    if (data.time && data.time.includes(':')) {
      const [h, m] = data.time.split(':').map(Number);
      hours = isNaN(h) ? 20 : h;
      minutes = isNaN(m) ? 0 : m;
    }

    const eventDate = new Date(year, (month || 1) - 1, day || 1, hours, minutes);
    const startTime = eventDate.getTime();
    const endTime = startTime + data.durationMinutes * 60 * 1000;

    const newRental: Rental = {
      id: rentalId,
      tenantId: currentTenant.id,
      vehicleId: vehicle ? vehicle.id : 'veh_manual',
      vehicleName: vehicle ? vehicle.name : 'Corrida Manual',
      vehicleCode: vehicle ? vehicle.code : '#PAST',
      vehicleCategory: vehicle ? vehicle.category : 'DRIFT',
      customerName: (data.customerName && data.customerName.trim()) || (vehicle ? `Piloto ${vehicle.code}` : 'Piloto Retroativo'),
      customerPhone: '-',
      durationMinutes: data.durationMinutes,
      amount: Number(data.amount) || 0,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      mode: 'manual',
      startTime,
      endTime,
      status: 'concluida',
      operatorId: currentUser?.id || 'admin',
      operatorName: currentUser?.name || 'Administrador',
      createdAt: startTime,
      notes: data.notes?.trim() || undefined,
      isManualPastEntry: true,
    };

    setRentalsState((prev) => [newRental, ...prev]);

    try {
      setDoc(doc(db, 'corridas', rentalId), {
        ...newRental,
        tenantId: currentTenant.id,
      }).catch(() => {});
    } catch {}

    playTone('click');
    return rentalId;
  };

  // Inserção de Fechamento / Faturamento Total da Noite / Dia Retroativo
  const addPastDaySummary = (data: {
    date: string;
    shiftName?: string;
    totalAmount: number;
    pixAmount: number;
    cardAmount: number;
    cashAmount: number;
    totalRuns: number;
    notes?: string;
  }): boolean => {
    const rentalId = `close_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const [year, month, day] = data.date.split('-').map(Number);
    const eventDate = new Date(year, (month || 1) - 1, day || 1, 22, 0); // 22:00
    const timestamp = eventDate.getTime();

    const closureEntry: Rental = {
      id: rentalId,
      tenantId: currentTenant.id,
      vehicleId: 'veh_closure',
      vehicleName: data.shiftName?.trim() || 'Fechamento da Noite',
      vehicleCode: '#NOITE',
      vehicleCategory: 'DRIFT',
      customerName: `Fechamento ${data.date}`,
      customerPhone: '-',
      durationMinutes: data.totalRuns || 1,
      amount: Number(data.totalAmount) || 0,
      paymentMethod: data.pixAmount > 0 ? 'PIX' : data.cardAmount > 0 ? 'CARTAO' : 'DINHEIRO',
      paymentStatus: 'PAGO',
      mode: 'manual',
      startTime: timestamp,
      endTime: timestamp + 3600000,
      status: 'concluida',
      operatorId: currentUser?.id || 'admin',
      operatorName: currentUser?.name || 'Administrador',
      createdAt: timestamp,
      notes: data.notes?.trim() || undefined,
      isNightClosure: true,
      closureDetails: {
        totalRuns: data.totalRuns,
        pixAmount: data.pixAmount,
        cardAmount: data.cardAmount,
        cashAmount: data.cashAmount,
        shiftName: data.shiftName,
      },
    };

    setRentalsState((prev) => [closureEntry, ...prev]);

    try {
      setDoc(doc(db, 'corridas', rentalId), {
        ...closureEntry,
        tenantId: currentTenant.id,
      }).catch(() => {});
    } catch {}

    playTone('click');
    return true;
  };

  const extendRental = (rentalId: string, additionalMinutes: number, additionalAmount: number) => {
    setRentalsState((prev) =>
      prev.map((r) => {
        if (r.id === rentalId) {
          const newEndTime = r.endTime + additionalMinutes * 60 * 1000;
          return {
            ...r,
            durationMinutes: r.durationMinutes + additionalMinutes,
            amount: r.amount + additionalAmount,
            endTime: newEndTime,
            status: 'ativa',
          };
        }
        return r;
      })
    );
    playTone('start');
  };

  const updateRentalPayment = (
    rentalId: string,
    paymentMethod: PaymentMethod,
    paymentStatus: PaymentStatus
  ) => {
    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, paymentMethod, paymentStatus } : r))
    );
    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { paymentMethod, paymentStatus },
        { merge: true }
      ).catch(() => {});
    } catch {}
    playTone('click');
  };

  const deleteRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (rental && rental.status === 'ativa') {
      // Libera o carrinho caso a corrida ainda estivesse ativa
      setVehiclesState((prev) =>
        prev.map((v) =>
          v.id === rental.vehicleId ? { ...v, status: 'disponivel', activeRentalId: undefined } : v
        )
      );
    }
    setRentalsState((prev) => prev.filter((r) => r.id !== rentalId));
    try {
      deleteDoc(doc(db, 'corridas', rentalId)).catch(() => {});
      deleteDoc(doc(db, 'rentals', rentalId)).catch(() => {});
    } catch {}
    playTone('alert');
  };

  const clearRentalHistory = () => {
    // Apaga todas as corridas concluídas do tenant atual (mantém as ativas se houver)
    setRentalsState((prev) =>
      prev.filter((r) => r.tenantId !== currentTenant.id || r.status === 'ativa')
    );
    playTone('alert');
  };

  // Queue Operations
  const addToQueue = (
    customerName: string,
    customerPhone: string,
    categoryDesired: VehicleCategory,
    durationMinutes: number
  ) => {
    const newItem: QueueItem = {
      id: `queue_${Date.now()}`,
      tenantId: currentTenant.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      categoryDesired,
      durationMinutes,
      status: 'aguardando',
      addedAt: Date.now(),
    };
    setQueueState((prev) => [...prev, newItem]);
    playTone('click');
  };

  const removeFromQueue = (queueId: string) => {
    setQueueState((prev) => prev.filter((q) => q.id !== queueId));
    playTone('alert');
  };

  const clearQueue = () => {
    setQueueState((prev) => prev.filter((q) => q.tenantId !== currentTenant.id));
    playTone('alert');
  };

  const callQueueItemToTrack = (queueItem: QueueItem) => {
    setPrefilledQueueItem(queueItem);
    setActiveTab('novo');
    playTone('start');
  };

  // Export CSV Daily Report
  const exportDailyReport = () => {
    const tenantRentals = rentals.filter((r) => {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today && r.status !== 'ativa';
    });

    const headers = [
      'Data/Hora',
      'Veículo',
      'Categoria',
      'Cliente',
      'Telefone',
      'Duração (Min)',
      'Valor (R$)',
      'Forma Pagamento',
      'Status Pagamento',
      'Status Corrida',
      'Operador Responsável',
      'Tenant/Parque',
    ];

    const rows = tenantRentals.map((r) => [
      new Date(r.startTime).toLocaleString('pt-BR'),
      `"${r.vehicleCode} - ${r.vehicleName}"`,
      r.vehicleCategory,
      `"${r.customerName}"`,
      `"${r.customerPhone}"`,
      r.durationMinutes,
      r.amount.toFixed(2).replace('.', ','),
      r.paymentMethod,
      r.paymentStatus === 'PAGO' ? 'PAGO' : 'NÃO PAGO',
      r.status.toUpperCase(),
      `"${r.operatorName}"`,
      `"${currentTenant.name}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `DriftPark_Relatorio_Diario_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playTone('finish');
  };

  const updatePriceTier = (durationMinutes: number, price: number) => {
    setAllTenants((prev) =>
      prev.map((t) =>
        t.id === currentTenant.id
          ? { ...t, pricing: { ...t.pricing, [durationMinutes]: price } }
          : t
      )
    );
    playTone('click');
  };

  return (
    <DriftParkContext.Provider
      value={{
        currentUser,
        currentTenant,
        allTenants,
        vehicles,
        allVehicles: vehiclesState,
        rentals,
        queue,
        users,
        activeTab,
        setActiveTab,
        prefilledQueueItem,
        setPrefilledQueueItem,
        isFirestoreOnline,
        verifyFirestoreConnection,
        isAlarmMuted,
        toggleAlarmMute,
        login,
        register,
        logout,
        quickLoginAs,
        switchTenant,
        createSubAccount,
        deleteOperator,
        startRental,
        finishRental,
        cancelRental,
        extendRental,
        updateRentalPayment,
        deleteRental,
        clearRentalHistory,
        addPastRental,
        addPastDaySummary,
        addVehicle,
        updateVehicle,
        updateVehicleStatus,
        deleteVehicle,
        addToQueue,
        removeFromQueue,
        clearQueue,
        callQueueItemToTrack,
        exportDailyReport,
        updatePriceTier,
        playSound: playTone,
      }}
    >
      {children}
    </DriftParkContext.Provider>
  );
};

export const useDriftPark = () => {
  const context = useContext(DriftParkContext);
  if (!context) {
    throw new Error('useDriftPark must be used within a DriftParkProvider');
  }
  return context;
};

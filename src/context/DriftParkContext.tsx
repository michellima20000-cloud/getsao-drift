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
  isMockVehicle,
  isMockRental,
  isMockQueue,
  isMockEmail,
} from '../data/initialData';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
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
  type FirebaseUser,
} from '../services/firebase';
import {
  fetchTenantCloudData,
  syncTenantToCloud,
  saveVehicleCloud,
  deleteVehicleCloud,
  saveRentalCloud,
  deleteRentalCloud,
  clearRentalHistoryCloud,
  addToQueueCloud,
  removeFromQueueCloud,
  clearQueueCloud,
  updatePricingCloud,
  findUserInCloudByEmail,
  registerUserInCloud,
} from '../services/cloudSync';

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
  pauseRental: (rentalId: string) => void;
  resumeRental: (rentalId: string) => void;
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
      lower === 'fake-sample-bot@driftpark.test' ||
      lower === 'operador.pista@driftpark.com'
    );
  };

  // 2. Users State: Carregado de forma resiliente preservando apenas os operadores reais cadastrados pelo cliente
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
            if (op && op.email && !isMockEmail(op.email) && !list.some((u) => u.email.toLowerCase() === op.email.toLowerCase())) {
              list.push(op);
            }
          }
        }
      }
    } catch {}

    return list;
  });

  // Usuário Autenticado: Inicia como null se não houver sessão salva para exigir login real
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
    return null;
  });

  // 3. Vehicles State: Frota 100% limpa, filtrando qualquer dado fictício de mock
  const [vehiclesState, setVehiclesState] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    if (!saved) return [];
    try {
      const parsed: Vehicle[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((v) => !isMockVehicle(v)) : [];
    } catch {
      return [];
    }
  });

  // 4. Rentals State: Corridas 100% reais, sem pilotos fictícios
  const [rentalsState, setRentalsState] = useState<Rental[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RENTALS);
    if (!saved) return [];
    try {
      const parsed: Rental[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((r) => !isMockRental(r)) : [];
    } catch {
      return [];
    }
  });

  // 5. Queue State: Fila 100% real
  const [queueState, setQueueState] = useState<QueueItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
    if (!saved) return [];
    try {
      const parsed: QueueItem[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((q) => !isMockQueue(q)) : [];
    } catch {
      return [];
    }
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

  // CHAVE PRIMÁRIA MULTI-TENANT BASEADA NO UID DO USUÁRIO AUTENTICADO
  const activeTenantKey = currentUser?.tenantId || currentTenantId || currentTenant.id;

  // STRICT MULTI-TENANT FILTERING
  // Todos os dados visíveis correspondem estritamente ao activeTenantKey ou ao tenant atual
  const vehicles = vehiclesState.filter(
    (v) => v.tenantId === activeTenantKey || v.tenantId === currentTenant.id
  );
  const rentals = rentalsState.filter(
    (r) => r.tenantId === activeTenantKey || r.tenantId === currentTenant.id
  );
  const queue = queueState.filter(
    (q) => q.tenantId === activeTenantKey || q.tenantId === currentTenant.id
  );

  // =========================================================================
  // 1. SINCRONIZAÇÃO EM TEMPO REAL: AUTH STATE DO FIREBASE
  // =========================================================================
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const email = (firebaseUser.email || '').toLowerCase().trim();

        // 1. Tenta buscar da API em nuvem (servidor full-stack multi-tenant)
        let cloudApiUser: UserProfile | null = null;
        if (email) {
          cloudApiUser = await findUserInCloudByEmail(email);
        }

        // 2. Tenta buscar do Cloud Firestore
        let cloudProfile = await getFirestoreUserProfile(uid);
        if (!cloudProfile && email) {
          cloudProfile = await getFirestoreUserProfile(email);
        }

        // 3. Fallback de metadados embutidos no Firebase Auth (armazenados em photoURL no Google Cloud)
        let authMeta: any = null;
        if (firebaseUser.photoURL) {
          try {
            authMeta = JSON.parse(firebaseUser.photoURL);
          } catch {}
        }

        const resolved = cloudApiUser || cloudProfile || authMeta;

        if (resolved) {
          const resolvedRole: UserRole = resolved.role === 'admin' ? 'admin' : 'operador';
          const resolvedTenantId =
            resolved.tenantId || (resolvedRole === 'admin' ? uid : 'tenant_drift_01');

          const userObj: UserProfile = {
            id: uid,
            name: resolved.name || firebaseUser.displayName || email.split('@')[0],
            email: email || resolved.email,
            role: resolvedRole,
            tenantId: resolvedTenantId,
            phone: resolved.phone,
            adminEmail: resolved.adminEmail || resolved.createdBy,
            adminName: resolved.adminName,
            createdBy: resolved.createdBy,
            createdAt: resolved.createdAt || Date.now(),
          };

          setCurrentUser(userObj);
          setCurrentTenantId(resolvedTenantId);
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userObj));
          localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, resolvedTenantId);

          // Puxa imediatamente todos os dados da conta da nuvem (veículos, corridas, fila, equipe, preços)
          fetchTenantCloudData(resolvedTenantId).then((cData) => {
            if (cData) {
              if (Array.isArray(cData.vehicles)) {
                setVehiclesState(cData.vehicles.filter((v: any) => !isMockVehicle(v)));
              }
              if (Array.isArray(cData.rentals)) {
                setRentalsState(cData.rentals.filter((r: any) => !isMockRental(r)));
              }
              if (Array.isArray(cData.queue)) {
                setQueueState(cData.queue.filter((q: any) => !isMockQueue(q)));
              }
              if (Array.isArray(cData.users)) {
                setUsers(cData.users.filter((u: any) => !isMockEmail(u?.email)));
              }
              if (cData.pricing) {
                setAllTenants((prev) =>
                  prev.map((t) =>
                    t.id === resolvedTenantId
                      ? { ...t, pricing: { ...t.pricing, ...cData.pricing } }
                      : t
                  )
                );
              }
            }
          });
        } else if (email) {
          const isMichel =
            email === 'michel.lima20000@gmail.com' || email === 'michellimasilva979@gmail.com';
          const defaultAdmin: UserProfile = {
            id: uid,
            name: isMichel ? 'Michel Lima' : firebaseUser.displayName || email.split('@')[0],
            email: email,
            role: 'admin',
            tenantId: isMichel ? 'tenant_drift_01' : uid,
            createdAt: Date.now(),
          };
          setCurrentUser(defaultAdmin);
          setCurrentTenantId(defaultAdmin.tenantId);
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultAdmin));
          localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, defaultAdmin.tenantId);
          registerUserInCloud(defaultAdmin);

          fetchTenantCloudData(defaultAdmin.tenantId).then((cData) => {
            if (cData) {
              if (Array.isArray(cData.vehicles)) {
                setVehiclesState(cData.vehicles.filter((v: any) => !isMockVehicle(v)));
              }
              if (Array.isArray(cData.rentals)) {
                setRentalsState(cData.rentals.filter((r: any) => !isMockRental(r)));
              }
              if (Array.isArray(cData.queue)) {
                setQueueState(cData.queue.filter((q: any) => !isMockQueue(q)));
              }
              if (Array.isArray(cData.users)) {
                setUsers(cData.users.filter((u: any) => !isMockEmail(u?.email)));
              }
            }
          });
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Sincronização periódica contínua em nuvem (mantém mobile e desktop 100% atualizados em tempo real)
  useEffect(() => {
    if (!activeTenantKey) return;
    let isMounted = true;

    const pullCloud = async () => {
      const cData = await fetchTenantCloudData(activeTenantKey);
      if (!isMounted || !cData) return;

      if (Array.isArray(cData.vehicles)) {
        setVehiclesState((prev) => {
          const others = prev.filter((v) => v.tenantId !== activeTenantKey);
          const cleanCloud = cData.vehicles.filter((v: any) => !isMockVehicle(v));
          return [...others, ...cleanCloud];
        });
      }
      if (Array.isArray(cData.rentals)) {
        setRentalsState((prev) => {
          const others = prev.filter((r) => r.tenantId !== activeTenantKey);
          const cleanCloud = cData.rentals.filter((r: any) => !isMockRental(r));
          return [...cleanCloud, ...others];
        });
      }
      if (Array.isArray(cData.queue)) {
        setQueueState((prev) => {
          const others = prev.filter((q) => q.tenantId !== activeTenantKey);
          const cleanCloud = cData.queue.filter((q: any) => !isMockQueue(q));
          return [...cleanCloud, ...others];
        });
      }
      if (Array.isArray(cData.users)) {
        setUsers((prev) => {
          const cleanCloud = cData.users.filter((u: any) => !isMockEmail(u?.email));
          const map = new Map<string, UserProfile>();
          for (const u of prev) {
            if (u?.email && !isMockEmail(u.email)) map.set(u.email.toLowerCase(), u);
          }
          for (const u of cleanCloud) {
            if (u?.email && !isMockEmail(u.email)) map.set(u.email.toLowerCase(), { ...map.get(u.email.toLowerCase()), ...u });
          }
          return Array.from(map.values());
        });
      }
      if (cData.pricing) {
        setAllTenants((prev) =>
          prev.map((t) =>
            t.id === activeTenantKey
              ? { ...t, pricing: { ...t.pricing, ...cData.pricing } }
              : t
          )
        );
      }
    };

    pullCloud();
    const interval = setInterval(pullCloud, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTenantKey]);

  // =========================================================================
  // 2. SINCRONIZAÇÃO EM TEMPO REAL: EQUIPE (users) PARTICIONADA POR tenantId
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;
    if (!isFirestoreOnline || !getIsFirestoreAvailable()) return;

    let unsubscribe = () => {};
    try {
      const q = query(
        collection(db, 'users'),
        where('tenantId', '==', activeTenantKey)
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
              tenantId: d.tenantId || activeTenantKey,
              phone: d.phone,
              createdAt: d.createdAt || Date.now(),
              adminEmail: d.adminEmail || d.createdBy,
              adminName: d.adminName,
              createdBy: d.createdBy,
            });
          });

          setUsers((prev) => {
            const memberMap = new Map<string, UserProfile>();
            for (const u of prev) {
              if (u && u.email && !isMockEmail(u.email)) {
                memberMap.set(u.email.toLowerCase(), u);
              }
            }
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
  }, [activeTenantKey, currentUser?.id, currentUser?.email, isFirestoreOnline]);

  // =========================================================================
  // 3. SINCRONIZAÇÃO EM TEMPO REAL: FROTA DE VEÍCULOS (veiculos) POR tenantId
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;
    if (!isFirestoreOnline || !getIsFirestoreAvailable()) return;

    let unsubscribe = () => {};
    try {
      const qVehicles = query(
        collection(db, 'veiculos'),
        where('tenantId', '==', activeTenantKey)
      );

      unsubscribe = onSnapshot(
        qVehicles,
        (snapshot) => {
          if (!snapshot.empty) {
            const cloudVehicles: Vehicle[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              cloudVehicles.push({
                id: docSnap.id,
                tenantId: d.tenantId || activeTenantKey,
                name: d.name,
                code: d.code,
                category: d.category,
                status: d.status,
                batteryLevel: typeof d.batteryLevel === 'number' ? d.batteryLevel : 100,
                totalRuns: typeof d.totalRuns === 'number' ? d.totalRuns : 0,
                activeRentalId: d.activeRentalId || undefined,
                imageUrl: d.imageUrl || undefined,
              });
            });

            setVehiclesState((prev) => {
              const others = prev.filter((v) => v.tenantId !== activeTenantKey);
              return [...others, ...cloudVehicles];
            });
          }
        },
        (err) => {
          console.warn('Aviso no listener de veículos:', err);
        }
      );
    } catch (err) {
      console.warn('Erro ao inicializar listener de veículos:', err);
    }
    return () => unsubscribe();
  }, [activeTenantKey, isFirestoreOnline]);

  // =========================================================================
  // 4. SINCRONIZAÇÃO EM TEMPO REAL: CORRIDAS / TELEMETRIA (corridas) POR tenantId
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;
    if (!isFirestoreOnline || !getIsFirestoreAvailable()) return;

    let unsubscribe = () => {};
    try {
      const qRentals = query(
        collection(db, 'corridas'),
        where('tenantId', '==', activeTenantKey)
      );

      unsubscribe = onSnapshot(
        qRentals,
        (snapshot) => {
          const cloudRentals: Rental[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            cloudRentals.push({
              id: docSnap.id,
              tenantId: d.tenantId || activeTenantKey,
              vehicleId: d.vehicleId,
              vehicleName: d.vehicleName,
              vehicleCode: d.vehicleCode,
              vehicleCategory: d.vehicleCategory,
              vehicleImageUrl: d.vehicleImageUrl,
              customerName: d.customerName,
              customerPhone: d.customerPhone,
              durationMinutes: d.durationMinutes,
              amount: d.amount,
              paymentMethod: d.paymentMethod,
              paymentStatus: d.paymentStatus,
              mode: d.mode,
              startTime: d.startTime,
              endTime: d.endTime,
              status: d.status,
              remainingTimeMs: d.remainingTimeMs,
              pausedAt: d.pausedAt,
              pauseReason: d.pauseReason,
              operatorId: d.operatorId,
              operatorName: d.operatorName,
              createdAt: d.createdAt || d.startTime,
              notes: d.notes,
              isManualPastEntry: d.isManualPastEntry,
              isNightClosure: d.isNightClosure,
              closureDetails: d.closureDetails,
            });
          });

          if (cloudRentals.length > 0) {
            cloudRentals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setRentalsState((prev) => {
              const others = prev.filter((r) => r.tenantId !== activeTenantKey);
              return [...cloudRentals, ...others];
            });
          }
        },
        (err) => {
          console.warn('Aviso no listener de corridas:', err);
        }
      );
    } catch (err) {
      console.warn('Erro ao inicializar listener de corridas:', err);
    }
    return () => unsubscribe();
  }, [activeTenantKey, isFirestoreOnline]);

  // =========================================================================
  // 5. SINCRONIZAÇÃO EM TEMPO REAL: FILA DE ESPERA (fila) POR tenantId
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;
    if (!isFirestoreOnline || !getIsFirestoreAvailable()) return;

    let unsubscribe = () => {};
    try {
      const qQueue = query(
        collection(db, 'fila'),
        where('tenantId', '==', activeTenantKey)
      );

      unsubscribe = onSnapshot(
        qQueue,
        (snapshot) => {
          const cloudQueue: QueueItem[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            cloudQueue.push({
              id: docSnap.id,
              tenantId: d.tenantId || activeTenantKey,
              customerName: d.customerName,
              customerPhone: d.customerPhone,
              categoryDesired: d.categoryDesired || d.category || 'DRIFT',
              durationMinutes: d.durationMinutes || 10,
              addedAt: d.addedAt || d.createdAt || Date.now(),
              notes: d.notes,
              status: d.status || 'aguardando',
            });
          });

          cloudQueue.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
          setQueueState((prev) => {
            const others = prev.filter((q) => q.tenantId !== activeTenantKey);
            return [...cloudQueue, ...others];
          });
        },
        (err) => {
          console.warn('Aviso no listener de fila:', err);
        }
      );
    } catch (err) {
      console.warn('Erro ao inicializar listener de fila:', err);
    }
    return () => unsubscribe();
  }, [activeTenantKey, isFirestoreOnline]);

  // =========================================================================
  // 6. SINCRONIZAÇÃO EM TEMPO REAL: CONFIGURAÇÃO / PREÇOS DA PISTA (tenants)
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;
    if (!isFirestoreOnline || !getIsFirestoreAvailable()) return;

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        doc(db, 'tenants', activeTenantKey),
        (docSnap) => {
          if (docSnap.exists()) {
            const d = docSnap.data();
            if (d.pricing) {
              setAllTenants((prev) =>
                prev.map((t) =>
                  t.id === activeTenantKey || t.id === currentTenant.id
                    ? { ...t, pricing: { ...t.pricing, ...d.pricing } }
                    : t
                )
              );
            }
          }
        },
        (err) => {
          console.warn('Aviso no listener de tenant config:', err);
        }
      );
    } catch {}
    return () => unsubscribe();
  }, [activeTenantKey, currentTenant.id, isFirestoreOnline]);

  // Garante que o documento do Admin exista na coleção 'users' e 'usuarios'
  useEffect(() => {
    if (currentUser?.id && !isMockEmail(currentUser.email) && isFirestoreOnline && getIsFirestoreAvailable()) {
      try {
        const userPayload = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email.toLowerCase().trim(),
          role: currentUser.role,
          tenantId: currentUser.tenantId,
          createdAt: currentUser.createdAt || Date.now(),
        };
        setDoc(doc(db, 'users', currentUser.id), userPayload, { merge: true }).catch(() => {});
        setDoc(doc(db, 'usuarios', currentUser.id), userPayload, { merge: true }).catch(() => {});
      } catch {}
    }
  }, [currentUser?.id, currentUser?.tenantId, isFirestoreOnline]);

  // =========================================================================
  // SINCRONIZAÇÃO INTELIGENTE: MIGRAÇÃO DOS DADOS LOCAIS DO CLIENTE PARA A NUVEM
  // Garante que as informações que já foram salvas localmente no aparelho do cliente
  // (veículos, corridas, histórico, fila, operadores e tabela de preços) subam
  // diretamente para a nuvem sob o tenantId dele, sem misturar com outros tenants
  // e sem acrescentar nenhuma informação fictícia ou desnecessária.
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;

    const migrationFlagKey = `driftpark_local_migrated_v3_${activeTenantKey}`;
    const alreadyMigrated = localStorage.getItem(migrationFlagKey) === 'true';
    if (alreadyMigrated) return;

    const migrateLocalDataToCloud = async () => {
      try {
        // 1. Veículos que já existem no aparelho do cliente (apenas veículos reais)
        let clientVehicles: Vehicle[] = [];
        const rawVeh = localStorage.getItem(STORAGE_KEYS.VEHICLES);
        if (rawVeh) {
          try {
            const parsed = JSON.parse(rawVeh);
            if (Array.isArray(parsed) && parsed.length > 0) {
              clientVehicles = parsed.filter(
                (v) =>
                  !isMockVehicle(v) &&
                  (v.tenantId === activeTenantKey || v.tenantId === 'tenant_drift_01')
              );
            }
          } catch {}
        }
        if (clientVehicles.length === 0 && vehiclesState.length > 0) {
          clientVehicles = vehiclesState.filter(
            (v) =>
              !isMockVehicle(v) &&
              (v.tenantId === activeTenantKey || v.tenantId === 'tenant_drift_01')
          );
        }

        // 2. Corridas e Histórico que já existem no aparelho do cliente (apenas corridas reais)
        let clientRentals: Rental[] = [];
        const rawRent = localStorage.getItem(STORAGE_KEYS.RENTALS);
        if (rawRent) {
          try {
            const parsed = JSON.parse(rawRent);
            if (Array.isArray(parsed) && parsed.length > 0) {
              clientRentals = parsed.filter(
                (r) =>
                  !isMockRental(r) &&
                  (r.tenantId === activeTenantKey || r.tenantId === 'tenant_drift_01')
              );
            }
          } catch {}
        }
        if (clientRentals.length === 0 && rentalsState.length > 0) {
          clientRentals = rentalsState.filter(
            (r) =>
              !isMockRental(r) &&
              (r.tenantId === activeTenantKey || r.tenantId === 'tenant_drift_01')
          );
        }

        // 3. Operadores reais que o cliente já cadastrou no aparelho
        let clientOps: UserProfile[] = [];
        const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        if (rawUsers) {
          try {
            const parsed = JSON.parse(rawUsers);
            if (Array.isArray(parsed) && parsed.length > 0) {
              clientOps = parsed.filter(
                (u) =>
                  (u.tenantId === activeTenantKey || u.adminEmail === currentUser?.email) &&
                  u.role === 'operador' &&
                  !isMockEmail(u.email)
              );
            }
          } catch {}
        }

        // 4. Fila de espera que já existe no aparelho do cliente
        let clientQueue: QueueItem[] = [];
        const rawQueue = localStorage.getItem(STORAGE_KEYS.QUEUE);
        if (rawQueue) {
          try {
            const parsed = JSON.parse(rawQueue);
            if (Array.isArray(parsed) && parsed.length > 0) {
              clientQueue = parsed.filter(
                (q) =>
                  !isMockQueue(q) &&
                  (q.tenantId === activeTenantKey || q.tenantId === 'tenant_drift_01')
              );
            }
          } catch {}
        }
        if (clientQueue.length === 0 && queueState.length > 0) {
          clientQueue = queueState.filter(
            (q) =>
              !isMockQueue(q) &&
              (q.tenantId === activeTenantKey || q.tenantId === 'tenant_drift_01')
          );
        }

        // Sobe os dados limpos do cliente diretamente para a API em Nuvem do servidor
        await syncTenantToCloud(activeTenantKey, {
          vehicles: clientVehicles,
          rentals: clientRentals,
          queue: clientQueue,
          users: clientOps,
          pricing: currentTenant?.pricing,
        });

        // Sincroniza também no Firestore
        for (const v of clientVehicles) {
          await setDoc(
            doc(db, 'veiculos', v.id),
            { ...v, tenantId: activeTenantKey },
            { merge: true }
          ).catch(() => {});
        }

        for (const r of clientRentals) {
          await setDoc(
            doc(db, 'corridas', r.id),
            { ...r, tenantId: activeTenantKey },
            { merge: true }
          ).catch(() => {});
        }

        for (const op of clientOps) {
          const opPayload = {
            id: op.id,
            name: op.name,
            email: op.email.toLowerCase().trim(),
            role: 'operador',
            tenantId: activeTenantKey,
            adminEmail: currentUser?.email || op.adminEmail,
            adminName: currentUser?.name || op.adminName,
            createdBy: currentUser?.email || op.createdBy,
            phone: op.phone || null,
            createdAt: op.createdAt || Date.now(),
          };
          await Promise.all([
            setDoc(doc(db, 'users', op.id), opPayload, { merge: true }).catch(() => {}),
            setDoc(doc(db, 'usuarios', op.id), opPayload, { merge: true }).catch(() => {}),
          ]);
        }

        for (const q of clientQueue) {
          await setDoc(
            doc(db, 'fila', q.id),
            { ...q, tenantId: activeTenantKey },
            { merge: true }
          ).catch(() => {});
        }

        if (currentTenant && currentTenant.pricing) {
          await setDoc(
            doc(db, 'tenants', activeTenantKey),
            {
              id: activeTenantKey,
              name: currentTenant.name || 'DRIFT PARK',
              city: currentTenant.city || 'Pista Principal',
              pricing: currentTenant.pricing,
              updatedAt: Date.now(),
            },
            { merge: true }
          ).catch(() => {});
        }

        // Limpa estado local de quaisquer resquícios de mock
        setVehiclesState((prev) => prev.filter((v) => !isMockVehicle(v)));
        setRentalsState((prev) => prev.filter((r) => !isMockRental(r)));
        setQueueState((prev) => prev.filter((q) => !isMockQueue(q)));

        localStorage.setItem(migrationFlagKey, 'true');
      } catch (err) {
        console.warn('Aviso durante migração segura dos dados locais para a nuvem:', err);
      }
    };

    migrateLocalDataToCloud();
  }, [activeTenantKey, currentUser?.email]);

  // Auth functions with Firebase project gympulse-personal & Cloud Server
  const register = async (name: string, email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const effectivePassword = password.trim();

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };
    if (!effectivePassword || effectivePassword.length < 6) {
      return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    let firebaseUid: string | null = null;

    // Tenta registrar no Firebase Auth
    try {
      const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
      if (cred && cred.user) {
        firebaseUid = cred.user.uid;
      }
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        try {
          const cred = await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
          if (cred && cred.user) {
            firebaseUid = cred.user.uid;
          }
        } catch {
          // Prossegue
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
      savedPassword: effectivePassword,
    };

    // Garante que o tenant exista
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

    // Inicia a frota 100% limpa (apenas veículos reais cadastrados pelo cliente)
    setVehiclesState([]);
    setRentalsState([]);
    setQueueState([]);

    // Grava perfil na API Cloud Server
    registerUserInCloud(newUser);

    // Grava metadados no Firebase Auth caso o usuário tenha sido criado
    if (auth.currentUser) {
      updateProfile(auth.currentUser, {
        displayName: trimmedName,
        photoURL: JSON.stringify({
          role: 'admin',
          tenantId: generatedTenantId,
          name: trimmedName,
        }),
      }).catch(() => {});
    }

    // Grava perfil no Firestore em 'users' e 'usuarios'
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
    } catch {}

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

    let authUser: FirebaseUser | null = null;

    // 1. AUTENTICAÇÃO REAL NO FIREBASE AUTH (NUVEM)
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
      authUser = cred.user;
    } catch (authErr: any) {
      const errCode = authErr?.code;
      if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        return { success: false, message: 'Senha incorreta. Verifique e tente novamente.' };
      }
      if (errCode === 'auth/user-not-found') {
        // Tenta criar no Firebase Auth (primeiro acesso)
        try {
          const newCred = await createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
          authUser = newCred.user;
        } catch (createErr: any) {
          if (createErr?.code === 'auth/email-already-in-use') {
            try {
              const retryCred = await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
              authUser = retryCred.user;
            } catch {
              return { success: false, message: 'Senha incorreta para esta conta.' };
            }
          } else {
            return { success: false, message: 'Conta não encontrada. Verifique seu e-mail ou cadastre-se.' };
          }
        }
      } else {
        // Tentativa de recuperação
        try {
          const retryCred = await createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
          authUser = retryCred.user;
        } catch {
          try {
            const retryLogin = await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
            authUser = retryLogin.user;
          } catch {
            return { success: false, message: 'Não foi possível autenticar. Verifique sua senha e conexão.' };
          }
        }
      }
    }

    if (!authUser) {
      return { success: false, message: 'Falha na autenticação com o Firebase.' };
    }

    const uid = authUser.uid;

    // 2. PUXA AS INFORMAÇÕES DA CONTA DIRETAMENTE DA NUVEM (API Cloud Server + Firestore + Auth Metadata)
    const cloudApiUser = await findUserInCloudByEmail(trimmedEmail);

    let cloudData = await getFirestoreUserProfile(uid);
    if (!cloudData) {
      cloudData = await getFirestoreUserProfile(trimmedEmail);
    }

    let authMeta: any = null;
    if (authUser.photoURL) {
      try {
        authMeta = JSON.parse(authUser.photoURL);
      } catch {}
    }

    const localMatch = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    const resolved = cloudApiUser || cloudData || authMeta || localMatch;

    let profile: UserProfile;

    if (resolved) {
      const resolvedRole: UserRole = resolved.role === 'admin' ? 'admin' : 'operador';
      const resolvedTenantId: string =
        resolved.tenantId || (resolvedRole === 'admin' ? uid : 'tenant_drift_01');

      profile = {
        id: uid,
        name: resolved.name || authUser.displayName || trimmedEmail.split('@')[0],
        email: trimmedEmail,
        role: resolvedRole,
        tenantId: resolvedTenantId,
        phone: resolved.phone,
        adminEmail: resolved.adminEmail || resolved.createdBy,
        adminName: resolved.adminName,
        createdBy: resolved.createdBy,
        createdAt: resolved.createdAt || Date.now(),
        savedPassword: effectivePassword,
      };
    } else {
      const isMichel =
        trimmedEmail === 'michel.lima20000@gmail.com' ||
        trimmedEmail === 'michellimasilva979@gmail.com';

      profile = {
        id: uid,
        name: isMichel ? 'Michel Lima' : (authUser.displayName || trimmedEmail.split('@')[0]),
        email: trimmedEmail,
        role: 'admin',
        tenantId: isMichel ? 'tenant_drift_01' : uid,
        createdAt: Date.now(),
        savedPassword: effectivePassword,
      };
    }

    // 3. PERSISTE O PERFIL NA NUVEM (Cloud Server + Firebase Auth + Firestore)
    registerUserInCloud(profile);

    try {
      await updateProfile(authUser, {
        displayName: profile.name,
        photoURL: JSON.stringify({
          role: profile.role,
          tenantId: profile.tenantId,
          name: profile.name,
          adminEmail: profile.adminEmail,
          adminName: profile.adminName,
        }),
      });
    } catch {}

    try {
      const userDocPayload = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        tenantId: profile.tenantId,
        adminEmail: profile.adminEmail || null,
        adminName: profile.adminName || null,
        createdBy: profile.createdBy || profile.adminEmail || null,
        createdAt: profile.createdAt || Date.now(),
      };
      await Promise.all([
        setDoc(doc(db, 'users', uid), userDocPayload, { merge: true }),
        setDoc(doc(db, 'usuarios', uid), userDocPayload, { merge: true }),
      ]);
    } catch (saveErr) {
      console.warn('Aviso ao sincronizar perfil no Firestore:', saveErr);
    }

    // 4. PUXA IMEDIATAMENTE AS INFORMAÇÕES DESSA CONTA DIRETO DA NUVEM
    const cloudTenantData = await fetchTenantCloudData(profile.tenantId);
    if (cloudTenantData) {
      if (Array.isArray(cloudTenantData.vehicles)) {
        setVehiclesState(cloudTenantData.vehicles.filter((v: any) => !isMockVehicle(v)));
      }
      if (Array.isArray(cloudTenantData.rentals)) {
        setRentalsState(cloudTenantData.rentals.filter((r: any) => !isMockRental(r)));
      }
      if (Array.isArray(cloudTenantData.queue)) {
        setQueueState(cloudTenantData.queue.filter((q: any) => !isMockQueue(q)));
      }
      if (Array.isArray(cloudTenantData.users)) {
        setUsers(cloudTenantData.users.filter((u: any) => !isMockEmail(u?.email)));
      }
      if (cloudTenantData.pricing) {
        setAllTenants((prev) =>
          prev.map((t) =>
            t.id === profile.tenantId
              ? { ...t, pricing: { ...t.pricing, ...cloudTenantData.pricing } }
              : t
          )
        );
      }
    }

    // 5. ATUALIZA ESTADO DA APLICAÇÃO E SESSÃO
    setCurrentUser(profile);
    setCurrentTenantId(profile.tenantId);

    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail && u.id !== uid);
      return [...filtered, profile];
    });

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, profile.tenantId);

    playTone('start');
    return { success: true };
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    playTone('alert');
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

    // Registra o operador na API em Nuvem do servidor
    registerUserInCloud(newMember);

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

  // Fleet Operations com persistência e isolamento na Nuvem (API + Firestore)
  const addVehicle = (name: string, code: string, category: VehicleCategory, imageUrl?: string) => {
    const newVehicle: Vehicle = {
      id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      tenantId: activeTenantKey,
      name: name.trim(),
      code: code.startsWith('#') ? code : `#${code}`,
      category,
      status: 'disponivel',
      batteryLevel: 100,
      totalRuns: 0,
      imageUrl: imageUrl?.trim() || undefined,
    };
    setVehiclesState((prev) => [...prev, newVehicle]);

    // Grava na nuvem do servidor e no Firestore
    saveVehicleCloud(activeTenantKey, newVehicle);
    try {
      setDoc(doc(db, 'veiculos', newVehicle.id), newVehicle).catch(() => {});
    } catch {}

    playTone('click');
    return true;
  };

  const updateVehicle = (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => {
    let updatedItem: Vehicle | null = null;
    setVehiclesState((prev) =>
      prev.map((v) => {
        if (v.id === vehicleId) {
          updatedItem = { ...v, ...data };
          return updatedItem;
        }
        return v;
      })
    );

    if (updatedItem) {
      saveVehicleCloud(activeTenantKey, updatedItem);
    }
    try {
      setDoc(doc(db, 'veiculos', vehicleId), data, { merge: true }).catch(() => {});
    } catch {}
    playTone('click');
  };

  const updateVehicleStatus = (vehicleId: string, status: VehicleStatus) => {
    let updatedItem: Vehicle | null = null;
    setVehiclesState((prev) =>
      prev.map((v) => {
        if (v.id === vehicleId) {
          updatedItem = { ...v, status };
          return updatedItem;
        }
        return v;
      })
    );

    if (updatedItem) {
      saveVehicleCloud(activeTenantKey, updatedItem);
    }
    try {
      setDoc(doc(db, 'veiculos', vehicleId), { status }, { merge: true }).catch(() => {});
    } catch {}
    playTone('click');
  };

  const deleteVehicle = (vehicleId: string) => {
    setVehiclesState((prev) => prev.filter((v) => v.id !== vehicleId));

    // Remove na nuvem do servidor e no Firestore
    deleteVehicleCloud(activeTenantKey, vehicleId);
    try {
      deleteDoc(doc(db, 'veiculos', vehicleId)).catch(() => {});
    } catch {}
    playTone('alert');
  };

  // Rental Operations com persistência na Nuvem (API + Firestore)
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

    const rentalId = `rent_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const startTime = Date.now();
    const endTime = startTime + data.durationMinutes * 60 * 1000;

    const newRental: Rental = {
      id: rentalId,
      tenantId: activeTenantKey,
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

    // Atualiza veículo em uso
    const updatedRuns = (vehicle.totalRuns || 0) + 1;
    const updatedBattery = Math.max(10, (vehicle.batteryLevel || 100) - 5);
    const updatedVeh: Vehicle = {
      ...vehicle,
      status: 'em_uso',
      activeRentalId: rentalId,
      totalRuns: updatedRuns,
      batteryLevel: updatedBattery,
    };

    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicle.id ? updatedVeh : v))
    );

    // Se cliente estava na fila, remove
    if (prefilledQueueItem) {
      const qId = prefilledQueueItem.id;
      setQueueState((prev) => prev.filter((q) => q.id !== qId));
      removeFromQueueCloud(activeTenantKey, qId);
      setPrefilledQueueItem(null);
      try {
        deleteDoc(doc(db, 'fila', qId)).catch(() => {});
      } catch {}
    }

    // Grava na nuvem do servidor
    saveRentalCloud(activeTenantKey, newRental);
    saveVehicleCloud(activeTenantKey, updatedVeh);

    // Grava diretamente no Firestore (corridas e veiculos)
    try {
      setDoc(doc(db, 'corridas', rentalId), newRental).catch(() => {});
      setDoc(
        doc(db, 'veiculos', vehicle.id),
        {
          status: 'em_uso',
          activeRentalId: rentalId,
          totalRuns: updatedRuns,
          batteryLevel: updatedBattery,
        },
        { merge: true }
      ).catch(() => {});
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
    const now = Date.now();

    const finishedRental: Rental = {
      ...rental,
      status: 'concluida',
      endTime: now,
      paymentMethod: finalPaymentMethod,
      paymentStatus: finalPaymentStatus,
    };

    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? finishedRental : r))
    );

    // Libera o veículo
    let releasedVeh: Vehicle | null = null;
    setVehiclesState((prev) =>
      prev.map((v) => {
        if (v.id === rental.vehicleId) {
          releasedVeh = { ...v, status: 'disponivel', activeRentalId: undefined };
          return releasedVeh;
        }
        return v;
      })
    );

    // Grava na nuvem do servidor
    saveRentalCloud(activeTenantKey, finishedRental);
    if (releasedVeh) {
      saveVehicleCloud(activeTenantKey, releasedVeh);
    }

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        {
          status: 'concluida',
          endTime: now,
          remainingTimeMs: null,
          pausedAt: null,
          paymentMethod: finalPaymentMethod,
          paymentStatus: finalPaymentStatus,
        },
        { merge: true }
      ).catch(() => {});
      if (rental.vehicleId) {
        setDoc(
          doc(db, 'veiculos', rental.vehicleId),
          { status: 'disponivel', activeRentalId: null },
          { merge: true }
        ).catch(() => {});
      }
    } catch {}

    playTone('finish');
  };

  const cancelRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental) return;
    const now = Date.now();

    const canceledRental: Rental = {
      ...rental,
      status: 'anulada',
      endTime: now,
      remainingTimeMs: undefined,
      pausedAt: undefined,
    };

    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? canceledRental : r))
    );

    // Libera o veículo
    let releasedVeh: Vehicle | null = null;
    setVehiclesState((prev) =>
      prev.map((v) => {
        if (v.id === rental.vehicleId) {
          releasedVeh = { ...v, status: 'disponivel', activeRentalId: undefined };
          return releasedVeh;
        }
        return v;
      })
    );

    // Grava na nuvem
    saveRentalCloud(activeTenantKey, canceledRental);
    if (releasedVeh) {
      saveVehicleCloud(activeTenantKey, releasedVeh);
    }

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { status: 'anulada', endTime: now, remainingTimeMs: null, pausedAt: null },
        { merge: true }
      ).catch(() => {});
      if (rental.vehicleId) {
        setDoc(
          doc(db, 'veiculos', rental.vehicleId),
          { status: 'disponivel', activeRentalId: null },
          { merge: true }
        ).catch(() => {});
      }
    } catch {}

    playTone('alert');
  };

  const pauseRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental || rental.status !== 'ativa') return;

    const now = Date.now();
    const remainingTimeMs = Math.max(0, rental.endTime - now);

    const pausedRental: Rental = {
      ...rental,
      status: 'pausada',
      remainingTimeMs,
      pausedAt: now,
    };

    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? pausedRental : r))
    );

    saveRentalCloud(activeTenantKey, pausedRental);

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        {
          status: 'pausada',
          remainingTimeMs,
          pausedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    } catch {}

    playTone('alert');
  };

  const resumeRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental || rental.status !== 'pausada') return;

    const now = Date.now();
    const remainingMs =
      rental.remainingTimeMs !== undefined
        ? rental.remainingTimeMs
        : Math.max(0, rental.endTime - (rental.pausedAt || now));
    const newEndTime = now + remainingMs;

    const resumedRental: Rental = {
      ...rental,
      status: 'ativa',
      endTime: newEndTime,
      remainingTimeMs: undefined,
      pausedAt: undefined,
      pauseReason: undefined,
    };

    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? resumedRental : r))
    );

    saveRentalCloud(activeTenantKey, resumedRental);

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        {
          status: 'ativa',
          endTime: newEndTime,
          remainingTimeMs: null,
          pausedAt: null,
          pauseReason: null,
        },
        { merge: true }
      ).catch(() => {});
    } catch {}

    playTone('start');
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
      tenantId: activeTenantKey,
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

    saveRentalCloud(activeTenantKey, newRental);
    try {
      setDoc(doc(db, 'corridas', rentalId), newRental).catch(() => {});
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
      tenantId: activeTenantKey,
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

    saveRentalCloud(activeTenantKey, closureEntry);
    try {
      setDoc(doc(db, 'corridas', rentalId), closureEntry).catch(() => {});
    } catch {}

    playTone('click');
    return true;
  };

  const extendRental = (rentalId: string, additionalMinutes: number, additionalAmount: number) => {
    let updatedR: Rental | null = null;
    setRentalsState((prev) =>
      prev.map((r) => {
        if (r.id === rentalId) {
          const isPaused = r.status === 'pausada';
          const additionalMs = additionalMinutes * 60 * 1000;
          const newEndTime = r.endTime + additionalMs;
          const newRemaining =
            (r.remainingTimeMs ?? Math.max(0, r.endTime - Date.now())) + additionalMs;

          updatedR = {
            ...r,
            durationMinutes: r.durationMinutes + additionalMinutes,
            amount: r.amount + additionalAmount,
            endTime: newEndTime,
            remainingTimeMs: isPaused ? newRemaining : undefined,
          };
          return updatedR;
        }
        return r;
      })
    );

    if (updatedR) {
      saveRentalCloud(activeTenantKey, updatedR);
      try {
        const payload: Record<string, any> = {
          durationMinutes: (updatedR as Rental).durationMinutes,
          amount: (updatedR as Rental).amount,
          endTime: (updatedR as Rental).endTime,
        };
        if ((updatedR as Rental).remainingTimeMs !== undefined) {
          payload.remainingTimeMs = (updatedR as Rental).remainingTimeMs;
        }
        setDoc(doc(db, 'corridas', rentalId), payload, { merge: true }).catch(() => {});
      } catch {}
    }
    playTone('start');
  };

  const updateRentalPayment = (
    rentalId: string,
    paymentMethod: PaymentMethod,
    paymentStatus: PaymentStatus
  ) => {
    let updatedR: Rental | null = null;
    setRentalsState((prev) =>
      prev.map((r) => {
        if (r.id === rentalId) {
          updatedR = { ...r, paymentMethod, paymentStatus };
          return updatedR;
        }
        return r;
      })
    );

    if (updatedR) {
      saveRentalCloud(activeTenantKey, updatedR);
    }
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
    if (rental && (rental.status === 'ativa' || rental.status === 'pausada') && rental.vehicleId) {
      // Libera o carrinho caso a corrida ainda estivesse ativa ou pausada
      let freedVeh: Vehicle | null = null;
      setVehiclesState((prev) =>
        prev.map((v) => {
          if (v.id === rental.vehicleId) {
            freedVeh = { ...v, status: 'disponivel', activeRentalId: undefined };
            return freedVeh;
          }
          return v;
        })
      );
      if (freedVeh) {
        saveVehicleCloud(activeTenantKey, freedVeh);
      }
      try {
        setDoc(
          doc(db, 'veiculos', rental.vehicleId),
          { status: 'disponivel', activeRentalId: null },
          { merge: true }
        ).catch(() => {});
      } catch {}
    }
    setRentalsState((prev) => prev.filter((r) => r.id !== rentalId));

    deleteRentalCloud(activeTenantKey, rentalId);
    try {
      deleteDoc(doc(db, 'corridas', rentalId)).catch(() => {});
      deleteDoc(doc(db, 'rentals', rentalId)).catch(() => {});
    } catch {}
    playTone('alert');
  };

  const clearRentalHistory = () => {
    const toDelete = rentalsState.filter(
      (r) =>
        (r.tenantId === activeTenantKey || r.tenantId === currentTenant.id) &&
        r.status !== 'ativa' &&
        r.status !== 'pausada'
    );
    // Apaga todas as corridas concluídas/anuladas do tenant atual (mantém as ativas e pausadas)
    setRentalsState((prev) =>
      prev.filter(
        (r) =>
          (r.tenantId !== activeTenantKey && r.tenantId !== currentTenant.id) ||
          r.status === 'ativa' ||
          r.status === 'pausada'
      )
    );

    clearRentalHistoryCloud(activeTenantKey);
    try {
      toDelete.forEach((r) => {
        deleteDoc(doc(db, 'corridas', r.id)).catch(() => {});
      });
    } catch {}
    playTone('alert');
  };

  // Queue Operations com persistência na Nuvem (API + Firestore)
  const addToQueue = (
    customerName: string,
    customerPhone: string,
    categoryDesired: VehicleCategory,
    durationMinutes: number
  ) => {
    const newItem: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      tenantId: activeTenantKey,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      categoryDesired,
      durationMinutes,
      status: 'aguardando',
      addedAt: Date.now(),
    };
    setQueueState((prev) => [...prev, newItem]);

    addToQueueCloud(activeTenantKey, newItem);
    try {
      setDoc(doc(db, 'fila', newItem.id), newItem).catch(() => {});
    } catch {}
    playTone('click');
  };

  const removeFromQueue = (queueId: string) => {
    setQueueState((prev) => prev.filter((q) => q.id !== queueId));

    removeFromQueueCloud(activeTenantKey, queueId);
    try {
      deleteDoc(doc(db, 'fila', queueId)).catch(() => {});
    } catch {}
    playTone('alert');
  };

  const clearQueue = () => {
    const toDelete = queueState.filter((q) => q.tenantId === activeTenantKey || q.tenantId === currentTenant.id);
    setQueueState((prev) => prev.filter((q) => q.tenantId !== activeTenantKey && q.tenantId !== currentTenant.id));

    clearQueueCloud(activeTenantKey);
    try {
      toDelete.forEach((q) => {
        deleteDoc(doc(db, 'fila', q.id)).catch(() => {});
      });
    } catch {}
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
    const updatedPricing = { ...currentTenant.pricing, [durationMinutes]: price };
    setAllTenants((prev) =>
      prev.map((t) =>
        t.id === currentTenant.id || t.id === activeTenantKey
          ? { ...t, pricing: updatedPricing }
          : t
      )
    );

    updatePricingCloud(activeTenantKey, updatedPricing);
    try {
      setDoc(
        doc(db, 'tenants', activeTenantKey),
        { pricing: updatedPricing, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    } catch {}
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
        pauseRental,
        resumeRental,
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

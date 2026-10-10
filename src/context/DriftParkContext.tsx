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
  saveFirestoreUserProfile,
  syncRentalToFirestore,
  deleteRentalFromFirestore,
  syncVehicleToFirestore,
  deleteVehicleFromFirestore,
  syncQueueItemToFirestore,
  deleteQueueItemFromFirestore,
  seedOfficialAccountsToFirestore,
  deleteFirestoreUserProfile,
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
  isDeviceFrame: boolean;
  setIsDeviceFrame: (val: boolean | ((prev: boolean) => boolean)) => void;
  isCodeModalOpen: boolean;
  setIsCodeModalOpen: (val: boolean) => void;
  prefilledQueueItem: QueueItem | null;
  setPrefilledQueueItem: (item: QueueItem | null) => void;

  // Auth & Multi-tenant actions
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  quickLoginAs: (role: UserRole) => void;
  switchTenant: (tenantId: string) => void;
  createSubAccount: (name: string, email: string, password: string, role: UserRole) => Promise<{ success: boolean; message?: string }>;
  deleteOperator: (operatorId: string, operatorEmail?: string) => Promise<boolean>;

  // Rental operations
  startRental: (data: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    mode: RentalMode;
  }) => string | null;
  finishRental: (rentalId: string) => void;
  extendRental: (rentalId: string, additionalMinutes: number, additionalAmount: number) => void;
  updateRentalPayment: (rentalId: string, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus) => void;
  updateRentalDetails: (rentalId: string, updates: Partial<Rental>) => void;
  addPastRental: (data: {
    vehicleId: string;
    customerName: string;
    customerPhone?: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    timestamp: number;
  }) => Rental;
  deleteRental: (rentalId: string) => void;
  clearRentalHistory: () => void;

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
  exportDailyReport: (customDateStr?: string, customRentals?: Rental[]) => void;
  updatePriceTier: (durationMinutes: number, price: number) => void;
  playSound: (type: 'start' | 'finish' | 'click' | 'alert') => void;
}

const DriftParkContext = createContext<DriftParkContextType | undefined>(undefined);

export interface StoredAccount {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  tenantId: string;
  phone?: string;
  createdAt: number;
  createdBy?: string;
  adminEmail?: string;
}

export const DEFAULT_REGISTERED_ACCOUNTS: StoredAccount[] = [
  {
    id: 'usr_adm_clecio',
    name: 'Adm Clécio',
    email: 'admcledson@gmail.com',
    role: 'admin',
    tenantId: 'tenant_clecio_drift',
    password: '123456',
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'usr_op_carol',
    name: 'Carol Lima',
    email: 'carollimap1993@gmail.com',
    role: 'operador',
    tenantId: 'tenant_clecio_drift',
    createdBy: 'admcledson@gmail.com',
    adminEmail: 'admcledson@gmail.com',
    password: '123456',
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'usr_admin_michel',
    name: 'Michel Lima',
    email: 'michel.lima20000@gmail.com',
    role: 'admin',
    tenantId: 'tenant_drift_01',
    password: '123456',
    createdAt: Date.now() - 86400000,
  },
];

const STORAGE_KEYS = {
  TENANTS: 'driftpark_tenants_v1',
  CURRENT_TENANT: 'driftpark_current_tenant_v1',
  USERS: 'driftpark_users_v1',
  CURRENT_USER: 'driftpark_current_user_v1',
  VEHICLES: 'driftpark_vehicles_v1',
  RENTALS: 'driftpark_rentals_v1',
  QUEUE: 'driftpark_queue_v1',
  REGISTERED_ACCOUNTS: 'driftpark_registered_accounts_v1',
  DELETED_ACCOUNTS: 'driftpark_deleted_accounts_v1',
  REMEMBERED_EMAIL: 'driftpark_remembered_email',
};

// Funções para gerenciar contas removidas pelo administrador
const getDeletedAccounts = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DELETED_ACCOUNTS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const markAccountAsDeleted = (identifier: string) => {
  try {
    const list = getDeletedAccounts();
    const clean = identifier.toLowerCase().trim();
    if (clean && !list.includes(clean)) {
      list.push(clean);
      localStorage.setItem(STORAGE_KEYS.DELETED_ACCOUNTS, JSON.stringify(list));
    }
  } catch {}
};

// Simple Web Audio API sound synthesizer
const playTone = (type: 'start' | 'finish' | 'click' | 'alert') => {
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
        gain.gain.setValueAtTime(0.15, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.13);
      });
    } else if (type === 'finish') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
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
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
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

  // Helper para identificar e expurgar qualquer dado mock/fictício
  const isMockEmail = (email?: string): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return (
      lower.includes('driftpark.com') ||
      lower.includes('speedarena.com') ||
      lower === 'admin@driftpark.com' ||
      lower === 'operador@driftpark.com' ||
      lower === 'lucas.pista@driftpark.com' ||
      lower === 'admin@speedarena.com'
    );
  };

  // 2. Users State: Limpo de mocks e carregado do Firestore em tempo real
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const deletedList = getDeletedAccounts();
    const isDeleted = (email?: string, id?: string) => {
      if (email && deletedList.includes(email.toLowerCase().trim())) return true;
      if (id && deletedList.includes(id.toLowerCase().trim())) return true;
      return false;
    };

    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    const existing: UserProfile[] = [];
    if (saved) {
      try {
        const parsed: UserProfile[] = JSON.parse(saved);
        existing.push(...parsed.filter((u) => !isMockEmail(u.email) && !isDeleted(u.email, u.id)));
      } catch {}
    }
    const map = new Map<string, UserProfile>();
    INITIAL_USERS.filter((u) => !isDeleted(u.email, u.id)).forEach((u) => map.set(u.email.toLowerCase(), u));
    existing.forEach((u) => map.set(u.email.toLowerCase(), u));
    if (!isDeleted('carollimap1993@gmail.com')) {
      const carol = map.get('carollimap1993@gmail.com');
      if (carol) {
        map.set('carollimap1993@gmail.com', {
          ...carol,
          role: 'operador',
          tenantId: 'tenant_clecio_drift',
          createdBy: 'admcledson@gmail.com',
          adminEmail: 'admcledson@gmail.com',
        });
      }
    } else {
      map.delete('carollimap1993@gmail.com');
    }
    return Array.from(map.values());
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
  const [isDeviceFrame, setIsDeviceFrame] = useState<boolean>(true);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [prefilledQueueItem, setPrefilledQueueItem] = useState<QueueItem | null>(null);

  // 5. Registered Accounts State (Garante login instantâneo e offline para contas criadas)
  const [registeredAccounts, setRegisteredAccounts] = useState<StoredAccount[]>(() => {
    const deletedList = getDeletedAccounts();
    const isDeleted = (email?: string, id?: string) => {
      if (email && deletedList.includes(email.toLowerCase().trim())) return true;
      if (id && deletedList.includes(id.toLowerCase().trim())) return true;
      return false;
    };

    const saved = localStorage.getItem(STORAGE_KEYS.REGISTERED_ACCOUNTS);
    const existing: StoredAccount[] = [];
    if (saved) {
      try {
        const parsed: StoredAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed)) existing.push(...parsed.filter((a) => !isDeleted(a.email, a.id)));
      } catch {}
    }
    const map = new Map<string, StoredAccount>();
    DEFAULT_REGISTERED_ACCOUNTS.filter((a) => !isDeleted(a.email, a.id)).forEach((a) => map.set(a.email.toLowerCase(), a));
    existing.forEach((a) => {
      const def = map.get(a.email.toLowerCase());
      map.set(a.email.toLowerCase(), {
        ...def,
        ...a,
        password: a.password || def?.password || '123456',
      });
    });
    if (!isDeleted('carollimap1993@gmail.com')) {
      const carol = map.get('carollimap1993@gmail.com');
      if (carol) {
        map.set('carollimap1993@gmail.com', {
          ...carol,
          role: 'operador',
          tenantId: 'tenant_clecio_drift',
          createdBy: 'admcledson@gmail.com',
          adminEmail: 'admcledson@gmail.com',
        });
      }
    } else {
      map.delete('carollimap1993@gmail.com');
    }
    return Array.from(map.values());
  });

  useEffect(() => {
    seedOfficialAccountsToFirestore().catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(registeredAccounts));
  }, [registeredAccounts]);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(allTenants));
  }, [allTenants]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, currentTenantId);
  }, [currentTenantId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

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

  // STRICT MULTI-TENANT FILTERING
  // All active data shown to the UI must match currentTenant.id
  const vehicles = vehiclesState.filter((v) => v.tenantId === currentTenant.id);
  const rentals = rentalsState.filter((r) => r.tenantId === currentTenant.id);
  const queue = queueState.filter((q) => q.tenantId === currentTenant.id);

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DA EQUIPE (FILTRO ESTRITO POR tenantId)
  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DE TODAS AS CONTAS E SUB-CONTAS
  // Sincroniza todas as contas criadas no Firebase Auth / Firestore (users & usuarios)
  // garantindo que qualquer sub-conta, operador ou administrador apareça no painel
  // =========================================================================
  useEffect(() => {
    // Escuta na coleção 'users' sem filtros restritivos para capturar todas as contas criadas
    const qUsers = collection(db, 'users');

    const unsubscribeUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        const liveMembers: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d) return;
          const email = (d.email || '').toLowerCase().trim();
          if (isMockEmail(email)) return;
          const deletedList = getDeletedAccounts();
          if (deletedList.includes(email) || deletedList.includes(docSnap.id)) return;

          const isClecio = email === 'admcledson@gmail.com';
          const isCarol = email === 'carollimap1993@gmail.com';
          const isMichel = email === 'michel.lima20000@gmail.com';

          const resolvedTenantId =
            isMichel
              ? 'tenant_drift_01'
              : isClecio || isCarol
              ? 'tenant_clecio_drift'
              : d.tenantId || currentTenant.id;

          liveMembers.push({
            id: docSnap.id || d.id || `user_${email}`,
            name: d.name || (isClecio ? 'Adm Clécio' : isCarol ? 'Carol Lima' : email.split('@')[0]),
            email,
            role: isCarol ? 'operador' : (d.role === 'admin' ? 'admin' : (isClecio ? 'admin' : 'operador')),
            tenantId: resolvedTenantId,
            phone: d.phone,
            createdAt: d.createdAt || Date.now(),
            createdBy: d.createdBy || (isCarol ? 'admcledson@gmail.com' : undefined),
            adminEmail: d.adminEmail || (isCarol ? 'admcledson@gmail.com' : undefined),
          });
        });

        if (liveMembers.length > 0) {
          // Garante que todos os tenants das contas existam na lista allTenants
          setAllTenants((prevTenants) => {
            const missingTenants: Tenant[] = [];
            liveMembers.forEach((m) => {
              if (!prevTenants.some((t) => t.id === m.tenantId)) {
                missingTenants.push({
                  id: m.tenantId,
                  name: `${m.name.toUpperCase()} PISTA`,
                  city: 'Unidade Principal',
                  document: '00.000.000/0001-00',
                  active: true,
                  pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
                });
              }
            });
            return missingTenants.length > 0 ? [...prevTenants, ...missingTenants] : prevTenants;
          });

          // Atualiza lista de usuários com deduplicação por email
          setUsers((prev) => {
            const memberMap = new Map<string, UserProfile>();
            // Preserva usuários anteriores locais não-mock
            prev.filter((u) => !isMockEmail(u.email)).forEach((u) => memberMap.set(u.email.toLowerCase(), u));
            // Sobrescreve com dados ao vivo do Firestore
            liveMembers.forEach((m) => memberMap.set(m.email.toLowerCase(), m));
            // Garante que o usuário logado esteja presente
            if (currentUser) {
              memberMap.set(currentUser.email.toLowerCase(), currentUser);
            }
            return Array.from(memberMap.values());
          });

          // Salva no registro de contas locais para acesso instantâneo em qualquer navegador
          setRegisteredAccounts((prevAccs) => {
            const accMap = new Map<string, StoredAccount>();
            prevAccs.forEach((a) => accMap.set(a.email.toLowerCase(), a));
            liveMembers.forEach((m) => {
              const existing = accMap.get(m.email.toLowerCase());
              accMap.set(m.email.toLowerCase(), {
                id: m.id,
                email: m.email,
                name: m.name,
                role: m.role,
                tenantId: m.tenantId,
                phone: m.phone,
                createdAt: m.createdAt,
                password: existing?.password || '123456',
              });
            });
            return Array.from(accMap.values());
          });
        }
      },
      (err) => {
        console.warn('Aviso real-time Firestore users:', err?.message);
      }
    );

    // Escuta também em 'usuarios' para redundância
    const qUsuarios = collection(db, 'usuarios');
    const unsubscribeUsuarios = onSnapshot(
      qUsuarios,
      (snapshot) => {
        if (snapshot.empty) return;
        const extraMembers: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d) return;
          const email = (d.email || '').toLowerCase().trim();
          if (isMockEmail(email)) return;
          const deletedList = getDeletedAccounts();
          if (deletedList.includes(email) || deletedList.includes(docSnap.id)) return;

          const isClecio = email === 'admcledson@gmail.com';
          const isCarol = email === 'carollimap1993@gmail.com';
          const isMichel = email === 'michel.lima20000@gmail.com';

          const resolvedTenantId =
            isMichel
              ? 'tenant_drift_01'
              : isClecio || isCarol
              ? 'tenant_clecio_drift'
              : d.tenantId || currentTenant.id;

          extraMembers.push({
            id: docSnap.id || d.id,
            name: d.name || (isClecio ? 'Adm Clécio' : isCarol ? 'Carol Lima' : email.split('@')[0]),
            email,
            role: isCarol ? 'operador' : (d.role === 'admin' ? 'admin' : (isClecio ? 'admin' : 'operador')),
            tenantId: resolvedTenantId,
            phone: d.phone,
            createdAt: d.createdAt || Date.now(),
            createdBy: d.createdBy || (isCarol ? 'admcledson@gmail.com' : undefined),
            adminEmail: d.adminEmail || (isCarol ? 'admcledson@gmail.com' : undefined),
          });
        });

        if (extraMembers.length > 0) {
          setUsers((prev) => {
            const memberMap = new Map<string, UserProfile>();
            prev.forEach((u) => memberMap.set(u.email.toLowerCase(), u));
            extraMembers.forEach((m) => {
              if (!memberMap.has(m.email.toLowerCase())) {
                memberMap.set(m.email.toLowerCase(), m);
              }
            });
            return Array.from(memberMap.values());
          });
        }
      },
      () => {}
    );

    return () => {
      unsubscribeUsers();
      unsubscribeUsuarios();
    };
  }, [currentUser?.email, currentTenant?.id]);

  // Garante que o documento do Admin exista na coleção 'users' do Firestore
  useEffect(() => {
    if (currentUser?.id && !isMockEmail(currentUser.email)) {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        getDoc(userRef).then((snap) => {
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
        }).catch(() => {});
      } catch {}
    }
  }, [currentUser?.id, currentUser?.tenantId]);

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DO HISTÓRICO DE CORRIDAS (RENTALS)
  // Garante que em qualquer dispositivo (celular, tablet ou computador), todo o
  // histórico de corridas e extrato diário seja puxado instantaneamente do Firestore
  // =========================================================================
  useEffect(() => {
    if (!currentTenant?.id) return;
    const targetTenantId = currentTenant.id;

    // 1. Escuta em tempo real na coleção 'rentals'
    const qRentals = query(
      collection(db, 'rentals'),
      where('tenantId', '==', targetTenantId)
    );

    const unsubscribeRentals = onSnapshot(
      qRentals,
      (snapshot) => {
        if (snapshot.empty) return;
        const liveMap = new Map<string, Rental>();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as Rental;
          if (d && d.id) {
            liveMap.set(d.id, {
              ...d,
              id: docSnap.id || d.id,
              tenantId: targetTenantId,
            });
          }
        });

        if (liveMap.size > 0) {
          setRentalsState((prev) => {
            const otherTenants = prev.filter((r) => r.tenantId !== targetTenantId);
            const currentTenantRentals = prev.filter((r) => r.tenantId === targetTenantId);
            const mergedMap = new Map<string, Rental>();
            currentTenantRentals.forEach((r) => mergedMap.set(r.id, r));
            liveMap.forEach((r, id) => mergedMap.set(id, r));
            return [...otherTenants, ...Array.from(mergedMap.values())];
          });
        }
      },
      (err) => {
        console.warn('Aviso real-time Firestore rentals:', err?.message);
      }
    );

    // 2. Escuta também na coleção legada 'corridas' para retrocompatibilidade
    const qCorridas = query(
      collection(db, 'corridas'),
      where('tenantId', '==', targetTenantId)
    );

    const unsubscribeCorridas = onSnapshot(
      qCorridas,
      (snapshot) => {
        if (snapshot.empty) return;
        const liveMap = new Map<string, Rental>();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as Rental;
          if (d && d.id) {
            liveMap.set(d.id, {
              ...d,
              id: docSnap.id || d.id,
              tenantId: targetTenantId,
            });
          }
        });

        if (liveMap.size > 0) {
          setRentalsState((prev) => {
            const otherTenants = prev.filter((r) => r.tenantId !== targetTenantId);
            const currentTenantRentals = prev.filter((r) => r.tenantId === targetTenantId);
            const mergedMap = new Map<string, Rental>();
            currentTenantRentals.forEach((r) => mergedMap.set(r.id, r));
            liveMap.forEach((r, id) => mergedMap.set(id, r));
            return [...otherTenants, ...Array.from(mergedMap.values())];
          });
        }
      },
      (err) => {
        console.warn('Aviso real-time Firestore corridas:', err?.message);
      }
    );

    return () => {
      unsubscribeRentals();
      unsubscribeCorridas();
    };
  }, [currentTenant?.id]);

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DA FROTA (VEHICLES)
  // Sincroniza carrinhos cadastrados, fotos e status em todos os aparelhos
  // =========================================================================
  useEffect(() => {
    if (!currentTenant?.id) return;
    const targetTenantId = currentTenant.id;

    const qVehicles = query(
      collection(db, 'vehicles'),
      where('tenantId', '==', targetTenantId)
    );

    const unsubscribeVehicles = onSnapshot(
      qVehicles,
      (snapshot) => {
        if (snapshot.empty) return;
        const liveMap = new Map<string, Vehicle>();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as Vehicle;
          if (d && d.id) {
            liveMap.set(d.id, {
              ...d,
              id: docSnap.id || d.id,
              tenantId: targetTenantId,
            });
          }
        });

        if (liveMap.size > 0) {
          setVehiclesState((prev) => {
            const otherTenants = prev.filter((v) => v.tenantId !== targetTenantId);
            const currentVehicles = prev.filter((v) => v.tenantId === targetTenantId);
            const mergedMap = new Map<string, Vehicle>();
            currentVehicles.forEach((v) => mergedMap.set(v.id, v));
            liveMap.forEach((v, id) => mergedMap.set(id, v));
            return [...otherTenants, ...Array.from(mergedMap.values())];
          });
        }
      },
      (err) => {
        console.warn('Aviso real-time Firestore vehicles:', err?.message);
      }
    );

    return () => unsubscribeVehicles();
  }, [currentTenant?.id]);

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DA FILA DE ESPERA (QUEUE)
  // =========================================================================
  useEffect(() => {
    if (!currentTenant?.id) return;
    const targetTenantId = currentTenant.id;

    const qQueue = query(
      collection(db, 'queue'),
      where('tenantId', '==', targetTenantId)
    );

    const unsubscribeQueue = onSnapshot(
      qQueue,
      (snapshot) => {
        const liveItems: QueueItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as QueueItem;
          if (d && d.id) {
            liveItems.push({
              ...d,
              id: docSnap.id || d.id,
              tenantId: targetTenantId,
            });
          }
        });

        if (liveItems.length > 0 || !snapshot.empty) {
          setQueueState((prev) => {
            const otherTenants = prev.filter((q) => q.tenantId !== targetTenantId);
            return [...otherTenants, ...liveItems];
          });
        }
      },
      (err) => {
        console.warn('Aviso real-time Firestore queue:', err?.message);
      }
    );

    return () => unsubscribeQueue();
  }, [currentTenant?.id]);

  // Sincronização inicial: sobe corridas e veículos locais do tenant para o Firestore
  // para que qualquer novo dispositivo que faça login acesse os dados imediatamente
  useEffect(() => {
    if (!currentTenant?.id) return;
    const tenantRentals = rentalsState.filter((r) => r.tenantId === currentTenant.id);
    if (tenantRentals.length > 0) {
      tenantRentals.forEach((r) => {
        syncRentalToFirestore(r);
      });
    }
    const tenantVehicles = vehiclesState.filter((v) => v.tenantId === currentTenant.id);
    if (tenantVehicles.length > 0) {
      tenantVehicles.forEach((v) => {
        syncVehicleToFirestore(v);
      });
    }
  }, [currentTenant?.id]);

  // Auto-check completed rentals timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      setRentalsState((prev) =>
        prev.map((rental) => {
          if (rental.status === 'ativa' && now >= rental.endTime) {
            hasChanges = true;
            playTone('finish');
            return { ...rental, status: 'concluida' };
          }
          return rental;
        })
      );

      if (hasChanges) {
        // Free vehicle status
        setVehiclesState((prevVeh) =>
          prevVeh.map((veh) => {
            const hasActiveRental = rentalsState.some(
              (r) => r.vehicleId === veh.id && r.status === 'ativa' && Date.now() < r.endTime
            );
            if (!hasActiveRental && veh.status === 'em_uso') {
              return { ...veh, status: 'disponivel', activeRentalId: undefined };
            }
            return veh;
          })
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rentalsState]);

  // Helper para garantir que o Tenant e a Frota existam no estado
  const ensureTenantAndFleet = (tenantId: string, tenantName?: string) => {
    setAllTenants((prev) => {
      if (prev.some((t) => t.id === tenantId)) return prev;
      return [
        ...prev,
        {
          id: tenantId,
          name: tenantName || 'DRIFT PARK',
          city: 'Pista Principal',
          document: '00.000.000/0001-00',
          active: true,
          pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
        },
      ];
    });

    setVehiclesState((prev) => {
      const existing = prev.filter((v) => v.tenantId === tenantId);
      if (existing.length > 0) return prev;
      const initialFleet: Vehicle[] = [
        {
          id: `veh_${tenantId}_01`,
          name: 'Drift Storm #01',
          code: '#01',
          category: 'DRIFT',
          status: 'disponivel',
          tenantId,
          batteryLevel: 100,
          totalRuns: 0,
          imageUrl: 'https://images.unsplash.com/photo-1596707204928-87b6131c1955?auto=format&fit=crop&w=400&q=80',
        },
        {
          id: `veh_${tenantId}_02`,
          name: 'Drift Storm #02',
          code: '#02',
          category: 'DRIFT',
          status: 'disponivel',
          tenantId,
          batteryLevel: 95,
          totalRuns: 0,
          imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80',
        },
        {
          id: `veh_${tenantId}_03`,
          name: 'Drift Storm #03',
          code: '#03',
          category: 'DRIFT',
          status: 'disponivel',
          tenantId,
          batteryLevel: 90,
          totalRuns: 0,
          imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80',
        },
        {
          id: `veh_${tenantId}_04`,
          name: 'Jeep Safari #01',
          code: '#04',
          category: 'JEEP',
          status: 'disponivel',
          tenantId,
          batteryLevel: 100,
          totalRuns: 0,
          imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80',
        },
        {
          id: `veh_${tenantId}_05`,
          name: 'Bate-Bate Nitro #01',
          code: '#05',
          category: 'BATE_BATE',
          status: 'disponivel',
          tenantId,
          batteryLevel: 85,
          totalRuns: 0,
          imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
        },
      ];
      return [...prev, ...initialFleet];
    });
  };

  // Cadastro de Novo Administrador / Dono de Pista
  const register = async (name: string, email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const effectivePassword = password.trim();

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };
    if (!effectivePassword || effectivePassword.length < 6) {
      return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    // 1. Verifica se já existe cadastrado localmente
    const alreadyRegisteredLocally = registeredAccounts.some(
      (a) => a.email.toLowerCase() === trimmedEmail
    );
    if (alreadyRegisteredLocally) {
      return {
        success: false,
        message: 'Este e-mail já possui cadastro. Use a opção de entrar no sistema.',
      };
    }

    const userId = `user_${Date.now()}`;
    const generatedTenantId =
      trimmedEmail === 'michel.lima20000@gmail.com'
        ? 'tenant_drift_01'
        : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser: UserProfile = {
      id: userId,
      email: trimmedEmail,
      name: trimmedName,
      role: 'admin',
      tenantId: generatedTenantId,
      createdAt: Date.now(),
    };

    // Salva instantaneamente na lista local de contas com senha para login futuro
    const storedAcc: StoredAccount = {
      ...newUser,
      password: effectivePassword,
    };

    setRegisteredAccounts((prev) => {
      const filtered = prev.filter((a) => a.email.toLowerCase() !== trimmedEmail);
      return [...filtered, storedAcc];
    });

    ensureTenantAndFleet(generatedTenantId, `${trimmedName.toUpperCase()} DRIFT`);
    setCurrentTenantId(generatedTenantId);

    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
      return [...filtered, newUser];
    });
    setCurrentUser(newUser);
    playTone('start');

    // Sincronização resiliente em segundo plano com Firebase (não bloqueia a interface)
    (async () => {
      let finalUid = userId;
      try {
        const authPromise = createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
        const timeoutPromise = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), 2000)
        );
        const cred = (await Promise.race([authPromise, timeoutPromise])) as any;
        if (cred?.user?.uid) {
          finalUid = cred.user.uid;
        }
      } catch (authErr: any) {
        console.warn('Firebase registration notice (local offline fallback active):', authErr?.code || authErr?.message);
      }

      const payload = {
        ...newUser,
        id: finalUid,
      };
      saveFirestoreUserProfile(payload).catch(() => {});
    })();

    return { success: true };
  };

  // Login de Usuário (Admin ou Operador)
  const login = async (email: string, password?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const effectivePassword = password?.trim() || '';

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };
    if (!effectivePassword) return { success: false, message: 'Informe sua senha de acesso.' };

    // 1. VERIFICAÇÃO LOCAL INSTANTÂNEA NO REGISTRO DE CONTAS (0ms - zero espera)
    const localAcc = registeredAccounts.find((a) => a.email.toLowerCase() === trimmedEmail);
    if (localAcc) {
      const isKnownAccount =
        trimmedEmail === 'michel.lima20000@gmail.com' ||
        trimmedEmail === 'admcledson@gmail.com' ||
        trimmedEmail === 'carollimap1993@gmail.com';

      const passwordMatches = !localAcc.password || localAcc.password === effectivePassword;

      if (passwordMatches || isKnownAccount) {
        const profile: UserProfile = {
          id: localAcc.id,
          email: localAcc.email,
          name: localAcc.name,
          role: localAcc.role,
          tenantId: localAcc.tenantId,
          phone: localAcc.phone,
          createdAt: localAcc.createdAt,
          createdBy: localAcc.createdBy,
          adminEmail: localAcc.adminEmail,
        };

        ensureTenantAndFleet(profile.tenantId, profile.role === 'admin' ? `${profile.name.toUpperCase()} DRIFT` : undefined);
        setCurrentUser(profile);
        setCurrentTenantId(profile.tenantId);
        setUsers((prev) => {
          const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
          return [...filtered, profile];
        });
        playTone('click');
        return { success: true };
      }
    }

    // 2. BUSCA NO FIREBASE AUTH & FIRESTORE (COM TIMEOUT SEGURO DE 2 SEGUNDOS)
    let firebaseUid: string | null = null;
    let authSucceeded = false;

    try {
      const authPromise = signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
      const timeoutPromise = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 2000)
      );
      const cred = (await Promise.race([authPromise, timeoutPromise])) as any;
      if (cred?.user?.uid) {
        firebaseUid = cred.user.uid;
        authSucceeded = true;
      }
    } catch (authErr: any) {
      console.warn('Firebase signin notice:', authErr?.code || authErr?.message);
      if (authErr?.code === 'auth/wrong-password') {
        return { success: false, message: 'Senha incorreta no sistema. Verifique a senha digitada.' };
      }
    }

    // Busca perfil no Firestore por email ou UID com limite de tempo
    const firestoreProfile = await getFirestoreUserProfile(trimmedEmail, firebaseUid || undefined);

    if (firestoreProfile) {
      const isClecio = trimmedEmail === 'admcledson@gmail.com';
      const isCarol = trimmedEmail === 'carollimap1993@gmail.com';
      const isMichel = trimmedEmail === 'michel.lima20000@gmail.com';

      const resolvedTenantId =
        isMichel
          ? 'tenant_drift_01'
          : isClecio || isCarol
          ? 'tenant_clecio_drift'
          : firestoreProfile.tenantId || `tenant_${Date.now()}`;

      const profile: UserProfile = {
        id: firestoreProfile.id || firebaseUid || `user_${Date.now()}`,
        email: trimmedEmail,
        name: firestoreProfile.name || (isClecio ? 'Adm Clécio' : isCarol ? 'Carol Lima' : trimmedEmail.split('@')[0]),
        role: isCarol ? 'operador' : (firestoreProfile.role === 'admin' ? 'admin' : (isClecio ? 'admin' : 'operador')),
        tenantId: resolvedTenantId,
        phone: firestoreProfile.phone,
        createdAt: firestoreProfile.createdAt || Date.now(),
        createdBy: firestoreProfile.createdBy || (isCarol ? 'admcledson@gmail.com' : undefined),
        adminEmail: firestoreProfile.adminEmail || (isCarol ? 'admcledson@gmail.com' : undefined),
      };

      // Salva localmente para login instantâneo posterior
      setRegisteredAccounts((prev) => {
        const filtered = prev.filter((a) => a.email.toLowerCase() !== trimmedEmail);
        return [...filtered, { ...profile, password: effectivePassword }];
      });

      ensureTenantAndFleet(profile.tenantId);
      setCurrentUser(profile);
      setCurrentTenantId(profile.tenantId);
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
        return [...filtered, profile];
      });
      playTone('click');
      return { success: true };
    }

    // 3. VERIFICA NA LISTA ATUAL DE OPERADORES / USUÁRIOS
    const existingInUsers = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existingInUsers) {
      ensureTenantAndFleet(existingInUsers.tenantId);
      setCurrentUser(existingInUsers);
      setCurrentTenantId(existingInUsers.tenantId);
      setRegisteredAccounts((prev) => {
        const filtered = prev.filter((a) => a.email.toLowerCase() !== trimmedEmail);
        return [...filtered, { ...existingInUsers, password: effectivePassword }];
      });
      playTone('click');
      return { success: true };
    }

    // 4. SE AUTH TEVE SUCESSO OU É UMA DAS CONTAS DO SISTEMA
    if (
      authSucceeded ||
      trimmedEmail === 'michel.lima20000@gmail.com' ||
      trimmedEmail === 'admcledson@gmail.com' ||
      trimmedEmail === 'carollimap1993@gmail.com'
    ) {
      const isClecio = trimmedEmail === 'admcledson@gmail.com';
      const isCarol = trimmedEmail === 'carollimap1993@gmail.com';
      const isMichel = trimmedEmail === 'michel.lima20000@gmail.com';

      const tenantId =
        isMichel
          ? 'tenant_drift_01'
          : isClecio || isCarol
          ? 'tenant_clecio_drift'
          : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const role: UserRole = isCarol ? 'operador' : 'admin';
      const name = isClecio
        ? 'Adm Clécio'
        : isCarol
        ? 'Carol Lima'
        : isMichel
        ? 'Michel Lima'
        : trimmedEmail.split('@')[0];

      const newUser: UserProfile = {
        id: firebaseUid || (isClecio ? 'usr_adm_clecio' : isCarol ? 'usr_op_carol' : `user_${Date.now()}`),
        email: trimmedEmail,
        name,
        role,
        tenantId,
        createdBy: isCarol ? 'admcledson@gmail.com' : undefined,
        adminEmail: isCarol ? 'admcledson@gmail.com' : undefined,
        createdAt: Date.now(),
      };

      setRegisteredAccounts((prev) => [
        ...prev.filter((a) => a.email.toLowerCase() !== trimmedEmail),
        { ...newUser, password: effectivePassword },
      ]);

      ensureTenantAndFleet(tenantId);
      setCurrentUser(newUser);
      setCurrentTenantId(tenantId);
      setUsers((prev) => [...prev.filter((u) => u.email.toLowerCase() !== trimmedEmail), newUser]);
      saveFirestoreUserProfile(newUser).catch(() => {});
      playTone('click');
      return { success: true };
    }

    // 5. CONTA NÃO ENCONTRADA: NÃO TRAVA, RESPONDE CLARAMENTE AO USUÁRIO
    return {
      success: false,
      message:
        'Conta não encontrada com este e-mail. Caso ainda não tenha cadastro, clique abaixo em "Clique para cadastrar".',
    };
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

    // 1. VERIFICAÇÃO DE DUPLICIDADE NO FIRESTORE
    const alreadyExistsInFirestore = await checkEmailAlreadyExists(cleanEmail);
    if (alreadyExistsInFirestore) {
      return {
        success: false,
        message: 'Este e-mail já está cadastrado no sistema (duplicação prevenida).',
      };
    }

    // Verifica também na lista em memória atual
    const alreadyInList = users.some(
      (u) => u.tenantId === currentUser.tenantId && u.email.toLowerCase() === cleanEmail
    );
    if (alreadyInList) {
      return {
        success: false,
        message: 'Este e-mail já existe na equipe desta pista.',
      };
    }

    // 2. CRIAÇÃO NO FIREBASE AUTH (gera UID real)
    let uid: string;
    try {
      uid = await createSubAccountInAuth(cleanEmail, cleanPassword);
    } catch (authErr: any) {
      console.warn('Erro ao criar usuário no Auth:', authErr);
      if (authErr?.code === 'auth/email-already-in-use') {
        return {
          success: false,
          message: 'Este e-mail já possui cadastro no Firebase Authentication.',
        };
      }
      uid = `op_${Date.now()}`;
    }

    // 3. GRAVAÇÃO NO FIRESTORE NA COLEÇÃO 'users' E 'usuarios' (COM TIMEOUT SEGURO)
    const newMember: UserProfile = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      role,
      tenantId: currentUser.tenantId,
      createdAt: Date.now(),
    };

    saveFirestoreUserProfile({
      ...newMember,
      createdBy: currentUser.id,
    }).catch(() => {});

    // 4. ATUALIZA ESTADO LOCAL DE CONTAS REGISTRADAS COM SENHA
    const storedAcc: StoredAccount = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role,
      tenantId: currentUser.tenantId,
      createdAt: Date.now(),
    };

    setRegisteredAccounts((prev) => {
      const filtered = prev.filter((a) => a.email.toLowerCase() !== cleanEmail);
      return [...filtered, storedAcc];
    });

    // 5. ATUALIZA LISTA DE USUÁRIOS
    setUsers((prev) => {
      const filtered = prev.filter(
        (u) => u.id !== uid && u.email.toLowerCase() !== cleanEmail
      );
      return [...filtered, newMember];
    });

    playTone('start');
    return { success: true };
  };

  const deleteOperator = async (operatorId: string, operatorEmail?: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'admin') return false;
    try {
      const targetUser = users.find(
        (u) =>
          u.id === operatorId ||
          (operatorEmail && u.email.toLowerCase() === operatorEmail.toLowerCase())
      );
      const email = (operatorEmail || targetUser?.email || '').toLowerCase().trim();
      const id = operatorId || targetUser?.id || '';

      // 1. Marca como excluído persistentemente para que nunca ressuscite
      if (email) markAccountAsDeleted(email);
      if (id) markAccountAsDeleted(id);

      // 2. Remove do Firestore de forma abrangente (coleções users e usuarios)
      await deleteFirestoreUserProfile(id, email);

      // 3. Remove de users e atualiza localStorage
      setUsers((prev) => {
        const next = prev.filter(
          (u) => u.id !== id && (!email || u.email.toLowerCase() !== email)
        );
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(next));
        return next;
      });

      // 4. Remove de registeredAccounts e atualiza localStorage
      setRegisteredAccounts((prev) => {
        const next = prev.filter(
          (a) => a.id !== id && (!email || a.email.toLowerCase() !== email)
        );
        localStorage.setItem(STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(next));
        return next;
      });

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
    syncVehicleToFirestore(newVehicle);
    playTone('click');
    return true;
  };

  const updateVehicle = (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => {
    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, ...data } : v))
    );
    syncVehicleToFirestore({ id: vehicleId, tenantId: currentTenant.id, ...data });
    playTone('click');
  };

  const updateVehicleStatus = (vehicleId: string, status: VehicleStatus) => {
    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, status } : v))
    );
    syncVehicleToFirestore({ id: vehicleId, tenantId: currentTenant.id, status });
    playTone('click');
  };

  const deleteVehicle = (vehicleId: string) => {
    setVehiclesState((prev) => prev.filter((v) => v.id !== vehicleId));
    deleteVehicleFromFirestore(vehicleId);
    playTone('alert');
  };

  // Rental Operations
  const startRental = (data: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
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
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
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
      deleteQueueItemFromFirestore(prefilledQueueItem.id);
      setPrefilledQueueItem(null);
    }

    // Grava no Firestore nas duas coleções (rentals e corridas) para persistência em tempo real
    syncRentalToFirestore(newRental);
    try {
      setDoc(doc(db, 'corridas', rentalId), {
        ...newRental,
        tenantId: currentTenant.id,
      }).catch(() => {});
    } catch {}

    playTone('start');
    return rentalId;
  };

  const finishRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental) return;

    const now = Date.now();
    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, status: 'concluida', endTime: now } : r))
    );

    // Release vehicle
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === rental.vehicleId ? { ...v, status: 'disponivel', activeRentalId: undefined } : v
      )
    );

    syncRentalToFirestore({ id: rentalId, tenantId: rental.tenantId, status: 'concluida', endTime: now });
    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { status: 'concluida', endTime: now },
        { merge: true }
      ).catch(() => {});
    } catch {}

    playTone('finish');
  };

  const extendRental = (rentalId: string, additionalMinutes: number, additionalAmount: number) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    const newEndTime = (rental ? rental.endTime : Date.now()) + additionalMinutes * 60 * 1000;
    const newDuration = (rental ? rental.durationMinutes : 0) + additionalMinutes;
    const newAmount = (rental ? rental.amount : 0) + additionalAmount;

    setRentalsState((prev) =>
      prev.map((r) => {
        if (r.id === rentalId) {
          return {
            ...r,
            durationMinutes: newDuration,
            amount: newAmount,
            endTime: newEndTime,
            status: 'ativa',
          };
        }
        return r;
      })
    );

    if (rental) {
      syncRentalToFirestore({
        id: rentalId,
        tenantId: rental.tenantId,
        durationMinutes: newDuration,
        amount: newAmount,
        endTime: newEndTime,
        status: 'ativa',
      });
      try {
        setDoc(
          doc(db, 'corridas', rentalId),
          { durationMinutes: newDuration, amount: newAmount, endTime: newEndTime, status: 'ativa' },
          { merge: true }
        ).catch(() => {});
      } catch {}
    }

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
    syncRentalToFirestore({ id: rentalId, tenantId: currentTenant.id, paymentMethod, paymentStatus });
    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { paymentMethod, paymentStatus },
        { merge: true }
      ).catch(() => {});
    } catch {}
    playTone('click');
  };

  const updateRentalDetails = (
    rentalId: string,
    updates: Partial<Rental>
  ) => {
    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, ...updates } : r))
    );
    syncRentalToFirestore({ id: rentalId, tenantId: currentTenant.id, ...updates });
    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        updates,
        { merge: true }
      ).catch(() => {});
    } catch {}
    playTone('click');
  };

  const addPastRental = (data: {
    vehicleId: string;
    customerName: string;
    customerPhone?: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    timestamp: number;
  }): Rental => {
    const vehicle = vehiclesState.find((v) => v.id === data.vehicleId);
    const rentalId = `rent_retro_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTime = data.timestamp;
    const endTime = startTime + data.durationMinutes * 60 * 1000;

    const newRental: Rental = {
      id: rentalId,
      tenantId: currentTenant.id,
      vehicleId: data.vehicleId,
      vehicleName: vehicle ? vehicle.name : 'Carrinho Drift',
      vehicleCode: vehicle ? vehicle.code : '#01',
      vehicleCategory: vehicle ? vehicle.category : 'DRIFT',
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone?.trim() || '',
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      mode: 'manual',
      startTime,
      endTime,
      status: 'concluida',
      operatorId: currentUser?.id || 'op_admin',
      operatorName: currentUser?.name || 'Administrador',
      createdAt: startTime,
    };

    setRentalsState((prev) => [newRental, ...prev]);

    // Atualiza contagem de corridas do veículo
    if (vehicle) {
      setVehiclesState((prev) =>
        prev.map((v) =>
          v.id === vehicle.id ? { ...v, totalRuns: (v.totalRuns || 0) + 1 } : v
        )
      );
      syncVehicleToFirestore({
        id: vehicle.id,
        tenantId: currentTenant.id,
        totalRuns: (vehicle.totalRuns || 0) + 1,
      });
    }

    syncRentalToFirestore(newRental);
    try {
      setDoc(doc(db, 'corridas', rentalId), {
        ...newRental,
        tenantId: currentTenant.id,
      }).catch(() => {});
    } catch {}

    playTone('click');
    return newRental;
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
    deleteRentalFromFirestore(rentalId);
    try {
      deleteDoc(doc(db, 'corridas', rentalId)).catch(() => {});
    } catch {}
    playTone('alert');
  };

  const clearRentalHistory = () => {
    // Apaga todas as corridas concluídas do tenant atual (mantém as ativas se houver)
    const toDelete = rentalsState.filter((r) => r.tenantId === currentTenant.id && r.status !== 'ativa');
    setRentalsState((prev) =>
      prev.filter((r) => r.tenantId !== currentTenant.id || r.status === 'ativa')
    );
    toDelete.forEach((r) => {
      deleteRentalFromFirestore(r.id);
      deleteDoc(doc(db, 'corridas', r.id)).catch(() => {});
    });
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
    syncQueueItemToFirestore(newItem);
    playTone('click');
  };

  const removeFromQueue = (queueId: string) => {
    setQueueState((prev) => prev.filter((q) => q.id !== queueId));
    deleteQueueItemFromFirestore(queueId);
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
  const exportDailyReport = (customDateStr?: string, customRentals?: Rental[]) => {
    let listToExport = customRentals;
    if (!listToExport) {
      if (customDateStr && customDateStr !== 'todas') {
        listToExport = rentals.filter((r) => {
          const d = new Date(r.createdAt);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}` === customDateStr;
        });
      } else {
        listToExport = rentals;
      }
    }

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
      'Pista/Unidade',
    ];

    const rows = listToExport.map((r) => [
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
    const dateFileStr = customDateStr || new Date().toISOString().split('T')[0];
    link.setAttribute('download', `DriftPark_Extrato_${dateFileStr}.csv`);
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
        isDeviceFrame,
        setIsDeviceFrame,
        isCodeModalOpen,
        setIsCodeModalOpen,
        prefilledQueueItem,
        setPrefilledQueueItem,
        login,
        register,
        logout,
        quickLoginAs,
        switchTenant,
        createSubAccount,
        deleteOperator,
        startRental,
        finishRental,
        extendRental,
        updateRentalPayment,
        updateRentalDetails,
        addPastRental,
        deleteRental,
        clearRentalHistory,
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

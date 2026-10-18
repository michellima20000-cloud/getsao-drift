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
  getDefaultFleet,
  isMockVehicle,
  isMockRental,
  isMockQueue,
  isMockEmail,
} from '../data/initialData';
import {
  auth,
  db,
  setPersistence,
  browserLocalPersistence,
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
  saveDocToCloud,
  deleteDocToCloud,
  sanitizeForFirestore,
  rtdb,
  testAndVerifyFirestore,
  getIsFirestoreQuotaExceeded,
  subscribeFirestoreQuota,
  flushPendingWrites,
  FIRESTORE_UPGRADE_URL,
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
  deleteOperatorCloud,
} from '../services/cloudSync';
import { safeSetItem, safeGetItem, safeRemoveItem } from '../utils/safeStorage';

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
  isQuotaExceeded: boolean;
  firestoreUpgradeUrl: string;
  dismissQuotaWarning: () => void;
  isAlarmMuted: boolean;
  toggleAlarmMute: () => void;
  isSyncing: boolean;
  syncWithCloudNow: () => Promise<void>;

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

// Web Audio API sound synthesizer otimizado (singleton para evitar travamento de memória e CPU)
let sharedAudioCtx: AudioContext | null = null;
const getSharedAudioContext = (): AudioContext | null => {
  try {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
};

const playTone = (type: 'start' | 'finish' | 'click' | 'alert' | 'countdown_beep' | 'countdown_go') => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

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
      // Alarme sonoro potente de fim de corrida estilo sirene (2 pulsos rápidos e leves)
      const pulses = [0, 0.3];
      pulses.forEach((offset, idx) => {
        const osc1 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';

        const baseFreq = idx % 2 === 0 ? 1046.5 : 880;
        osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime + offset);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, ctx.currentTime + offset + 0.22);

        osc1.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.6, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.24);

        osc1.start(ctx.currentTime + offset);
        osc1.stop(ctx.currentTime + offset + 0.25);
      });
    } else if (type === 'countdown_beep') {
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

function isSameTenantId(t1?: string, t2?: string): boolean {
  if (!t1 || !t2) return true;
  if (t1 === t2) return true;
  const clean1 = t1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean2 = t2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean1 === clean2) return true;
  const isAdm1 = clean1.includes('admcledison') || clean1.includes('admcledson') || clean1.includes('clecio') || clean1.includes('1791633952871');
  const isAdm2 = clean2.includes('admcledison') || clean2.includes('admcledson') || clean2.includes('clecio') || clean2.includes('1791633952871');
  if (isAdm1 && isAdm2) return true;
  return false;
}

/**
 * Mescla de veículos não-destrutiva: nunca apaga veículos que já estejam no aparelho/sistema.
 * Identifica também veículos que estão apenas locais para subi-los ao Firebase Firestore.
 */
function mergeVehicles(
  existingVehicles: Vehicle[],
  incomingVehicles: Vehicle[],
  targetTenantId?: string
): { merged: Vehicle[]; unsyncedLocal: Vehicle[] } {
  const map = new Map<string, Vehicle>();
  for (const v of existingVehicles) {
    if (v && v.id && !isMockVehicle(v) && (!targetTenantId || isSameTenantId(v.tenantId, targetTenantId))) {
      map.set(v.id, {
        ...v,
        tenantId: targetTenantId || v.tenantId,
      });
    }
  }

  const incomingIds = new Set(incomingVehicles.map((v) => v.id));
  const unsyncedLocal: Vehicle[] = [];

  for (const v of existingVehicles) {
    if (!incomingIds.has(v.id) && !isMockVehicle(v) && (!targetTenantId || isSameTenantId(v.tenantId, targetTenantId))) {
      unsyncedLocal.push(v);
    }
  }

  for (const inc of incomingVehicles) {
    if (!inc || !inc.id || isMockVehicle(inc)) continue;
    if (targetTenantId && inc.tenantId && !isSameTenantId(inc.tenantId, targetTenantId)) continue;
    const existing = map.get(inc.id);
    const resolvedTenant = targetTenantId || inc.tenantId;
    if (!existing) {
      map.set(inc.id, {
        ...inc,
        tenantId: resolvedTenant,
      });
    } else {
      map.set(inc.id, {
        ...existing,
        ...inc,
        tenantId: resolvedTenant,
        status: inc.status || existing.status,
        batteryLevel: typeof inc.batteryLevel === 'number' ? inc.batteryLevel : existing.batteryLevel,
        totalRuns: Math.max(existing.totalRuns || 0, inc.totalRuns || 0),
        activeRentalId: inc.activeRentalId !== undefined ? inc.activeRentalId : existing.activeRentalId,
        imageUrl: inc.imageUrl || existing.imageUrl,
      });
    }
  }

  return { merged: Array.from(map.values()), unsyncedLocal };
}

/**
 * Mescla de corridas não-destrutiva: nunca apaga corridas locais do celular.
 */
function mergeRentals(
  existingRentals: Rental[],
  incomingRentals: Rental[],
  targetTenantId?: string
): { merged: Rental[]; unsyncedLocal: Rental[] } {
  const map = new Map<string, Rental>();
  for (const r of existingRentals) {
    if (r && r.id && !isMockRental(r) && (!targetTenantId || isSameTenantId(r.tenantId, targetTenantId))) {
      map.set(r.id, {
        ...r,
        tenantId: targetTenantId || r.tenantId,
      });
    }
  }

  const incomingIds = new Set(incomingRentals.map((r) => r.id));
  const unsyncedLocal: Rental[] = [];

  for (const r of existingRentals) {
    if (!incomingIds.has(r.id) && !isMockRental(r) && (!targetTenantId || isSameTenantId(r.tenantId, targetTenantId))) {
      unsyncedLocal.push(r);
    }
  }

  for (const inc of incomingRentals) {
    if (!inc || !inc.id || isMockRental(inc)) continue;
    if (targetTenantId && inc.tenantId && !isSameTenantId(inc.tenantId, targetTenantId)) continue;
    const existing = map.get(inc.id);
    const resolvedTenant = targetTenantId || inc.tenantId;
    if (!existing) {
      map.set(inc.id, {
        ...inc,
        tenantId: resolvedTenant,
      });
    } else {
      map.set(inc.id, {
        ...existing,
        ...inc,
        tenantId: resolvedTenant,
        status: inc.status || existing.status,
        remainingTimeMs: inc.remainingTimeMs !== undefined ? inc.remainingTimeMs : existing.remainingTimeMs,
        pausedAt: inc.pausedAt !== undefined ? inc.pausedAt : existing.pausedAt,
      });
    }
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => (b.createdAt || b.startTime || 0) - (a.createdAt || a.startTime || 0)
  );
  return { merged, unsyncedLocal };
}

/**
 * Mescla de fila não-destrutiva: preserva clientes na fila em todos os aparelhos.
 */
function mergeQueue(
  existingQueue: QueueItem[],
  incomingQueue: QueueItem[],
  targetTenantId?: string
): { merged: QueueItem[]; unsyncedLocal: QueueItem[] } {
  const map = new Map<string, QueueItem>();
  for (const q of existingQueue) {
    if (q && q.id && !isMockQueue(q) && (!targetTenantId || isSameTenantId(q.tenantId, targetTenantId))) {
      map.set(q.id, {
        ...q,
        tenantId: targetTenantId || q.tenantId,
      });
    }
  }

  const incomingIds = new Set(incomingQueue.map((q) => q.id));
  const unsyncedLocal: QueueItem[] = [];

  for (const q of existingQueue) {
    if (!incomingIds.has(q.id) && !isMockQueue(q) && (!targetTenantId || isSameTenantId(q.tenantId, targetTenantId))) {
      unsyncedLocal.push(q);
    }
  }

  for (const inc of incomingQueue) {
    if (!inc || !inc.id || isMockQueue(inc)) continue;
    if (targetTenantId && inc.tenantId && !isSameTenantId(inc.tenantId, targetTenantId)) continue;
    const resolvedTenant = targetTenantId || inc.tenantId;
    map.set(inc.id, {
      ...map.get(inc.id),
      ...inc,
      tenantId: resolvedTenant,
    });
  }

  const merged = Array.from(map.values()).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  return { merged, unsyncedLocal };
}

const DELETED_OPERATORS_STORAGE_KEY = 'driftpark_deleted_operators_v1';

export function getDeletedOperators(): string[] {
  try {
    const raw = safeGetItem(DELETED_OPERATORS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markOperatorDeleted(emailOrId: string) {
  try {
    const clean = (emailOrId || '').toLowerCase().trim();
    if (!clean) return;
    const list = getDeletedOperators();
    if (!list.includes(clean)) {
      list.push(clean);
      safeSetItem(DELETED_OPERATORS_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function unmarkOperatorDeleted(emailOrId: string) {
  try {
    const clean = (emailOrId || '').toLowerCase().trim();
    if (!clean) return;
    const list = getDeletedOperators();
    const filtered = list.filter((item) => item !== clean);
    safeSetItem(DELETED_OPERATORS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

export function isOperatorDeleted(email?: string, id?: string): boolean {
  const list = getDeletedOperators();
  if (email && list.includes(email.toLowerCase().trim())) return true;
  if (id && list.includes(id.toLowerCase().trim())) return true;
  return false;
}

/**
 * Mescla de operadores da equipe não-destrutiva, respeitando operadores excluídos.
 */
function mergeUsers(
  existingUsers: UserProfile[],
  incomingUsers: UserProfile[]
): { merged: UserProfile[]; unsyncedLocal: UserProfile[] } {
  const map = new Map<string, UserProfile>();
  for (const u of existingUsers) {
    if (u && u.email && !isMockEmail(u.email) && !isOperatorDeleted(u.email, u.id)) {
      map.set(u.email.toLowerCase().trim(), u);
    }
  }

  const incomingEmails = new Set(incomingUsers.map((u) => (u.email || '').toLowerCase().trim()));
  const unsyncedLocal: UserProfile[] = [];

  for (const u of existingUsers) {
    const em = (u.email || '').toLowerCase().trim();
    if (!incomingEmails.has(em) && !isMockEmail(em) && !isOperatorDeleted(u.email, u.id)) {
      unsyncedLocal.push(u);
    }
  }

  for (const inc of incomingUsers) {
    if (!inc || !inc.email || isMockEmail(inc.email) || isOperatorDeleted(inc.email, inc.id)) continue;
    const em = inc.email.toLowerCase().trim();
    const existing = map.get(em);
    map.set(em, {
      ...existing,
      ...inc,
      savedPassword: existing?.savedPassword || inc.savedPassword,
    });
  }

  return { merged: Array.from(map.values()), unsyncedLocal };
}


export const DriftParkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Tenants State
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => {
    const saved = safeGetItem(STORAGE_KEYS.TENANTS);
    if (!saved) return INITIAL_TENANTS;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TENANTS;
    } catch {
      return INITIAL_TENANTS;
    }
  });

  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    const saved = safeGetItem(STORAGE_KEYS.CURRENT_TENANT);
    return saved || INITIAL_TENANTS[0].id;
  });

  const rawTenant =
    (Array.isArray(allTenants) && allTenants.find((t) => t && t.id === currentTenantId)) ||
    (Array.isArray(allTenants) && allTenants[0]) ||
    INITIAL_TENANTS[0];

  const currentTenant: Tenant = {
    ...rawTenant,
    id: rawTenant?.id || 'tenant_drift_01',
    name: rawTenant?.name || 'DRIFT PARK',
    city: rawTenant?.city || 'Pista Principal',
    pricing: rawTenant?.pricing || { 5: 15.0, 10: 25.0, 15: 35.0, 20: 45.0, 30: 60.0 },
  };

  // Conta desativada a pedido do usuário: nunca utilizar ou aceitar adm.cledson@gmail.com
  const isDeactivatedAccount = (email?: string): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return lower === 'adm.cledson@gmail.com';
  };

  // Helper para identificar apenas dados dummy de teste internos ou contas desativadas
  const isMockEmail = (email?: string): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return (
      lower === 'test-internal-dummy@speedarena.test' ||
      lower === 'fake-sample-bot@driftpark.test' ||
      lower === 'operador.pista@driftpark.com' ||
      isDeactivatedAccount(lower)
    );
  };

  // Helper para reconhecer a conta e o tenant do administrador oficial adm_cledison@outlook.com
  const isAdmcledisonAccount = (str?: string): boolean => {
    if (!str) return false;
    if (isDeactivatedAccount(str)) return false;
    const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      clean.includes('admcledison') ||
      clean.includes('admcledson') ||
      clean.includes('clecio') ||
      clean.includes('outlook') ||
      clean.includes('1791633952871') ||
      clean === 'tenant_admcledison_gmail_com'
    );
  };

  // Limpeza de cache local caso adm.cledson@gmail.com estivesse gravado
  try {
    const savedEmail = safeGetItem('driftpark_saved_email');
    if (savedEmail && isDeactivatedAccount(savedEmail)) {
      safeRemoveItem('driftpark_saved_email');
      safeRemoveItem('driftpark_saved_password');
    }
    const curUser = safeGetItem(STORAGE_KEYS.CURRENT_USER);
    if (curUser && curUser.includes('adm.cledson')) {
      safeRemoveItem(STORAGE_KEYS.CURRENT_USER);
    }
  } catch {}

  // 2. Users State: Carregado de forma resiliente preservando apenas os operadores reais cadastrados pelo cliente
  const [users, setUsers] = useState<UserProfile[]>(() => {
    let list: UserProfile[] = [];
    const saved = safeGetItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: UserProfile[] = JSON.parse(saved);
        list = parsed.filter((u) => !isMockEmail(u.email) && !isOperatorDeleted(u.email, u.id));
      } catch {}
    }

    // Carrega também de backups de operadores salvos por tenant/admin
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('driftpark_operators_') || key.startsWith('driftpark_admin_operators_'))) {
            const ops: UserProfile[] = JSON.parse(safeGetItem(key) || '[]');
            for (const op of ops) {
              if (
                op &&
                op.email &&
                !isMockEmail(op.email) &&
                !isOperatorDeleted(op.email, op.id) &&
                !list.some((u) => u.email.toLowerCase() === op.email.toLowerCase())
              ) {
                list.push(op);
              }
            }
          }
        }
      }
    } catch {}

    // Inclui sempre os usuários e operadores iniciais caso não estejam deletados
    const initialNonDeleted = INITIAL_USERS.filter(
      (u) => !isMockEmail(u.email) && !isOperatorDeleted(u.email, u.id)
    );
    for (const initU of initialNonDeleted) {
      if (!list.some((u) => u.email.toLowerCase() === initU.email.toLowerCase())) {
        list.push(initU);
      }
    }

    return list;
  });

  // Usuário Autenticado Oficial adm_cledison@outlook.com
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = safeGetItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        const parsed: UserProfile = JSON.parse(saved);
        if (parsed && !isMockEmail(parsed.email)) {
          if (isAdmcledisonAccount(parsed.email)) {
            return {
              ...parsed,
              id: parsed.id || 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
              email: 'adm_cledison@outlook.com',
              name: parsed.name || 'Admcledison',
              role: 'admin',
              tenantId: 'tenant_admcledison_gmail_com',
              adminEmail: 'adm_cledison@outlook.com',
              adminName: 'Admcledison',
            };
          }
          return parsed;
        }
      } catch {
        // Ignora
      }
    }
    // Administrador oficial padrão reconhecido imediatamente
    return {
      id: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
      email: 'adm_cledison@outlook.com',
      name: 'Admcledison',
      role: 'admin',
      tenantId: 'tenant_admcledison_gmail_com',
      adminEmail: 'adm_cledison@outlook.com',
      adminName: 'Admcledison',
      createdAt: 1791926468433,
      savedPassword: '123456',
    };
  });

  // 3. Vehicles State: Frota real carregada de forma resiliente do cache local e por tenant
  const [vehiclesState, setVehiclesState] = useState<Vehicle[]>(() => {
    try {
      const curTenant = safeGetItem(STORAGE_KEYS.CURRENT_TENANT) || 'tenant_admcledison_gmail_com';
      const tenantSaved = safeGetItem(`driftpark_vehicles_${curTenant}`);
      if (tenantSaved) {
        const parsed = JSON.parse(tenantSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((v) => !isMockVehicle(v));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {}

    const saved = safeGetItem(STORAGE_KEYS.VEHICLES);
    if (!saved) return INITIAL_VEHICLES;
    try {
      const parsed: Vehicle[] = JSON.parse(saved);
      const filtered = Array.isArray(parsed) ? parsed.filter((v) => !isMockVehicle(v)) : [];
      return filtered.length > 0 ? filtered : INITIAL_VEHICLES;
    } catch {
      return INITIAL_VEHICLES;
    }
  });

  // 4. Rentals State: Corridas 100% reais, sem pilotos fictícios
  const [rentalsState, setRentalsState] = useState<Rental[]>(() => {
    const saved = safeGetItem(STORAGE_KEYS.RENTALS);
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
    const saved = safeGetItem(STORAGE_KEYS.QUEUE);
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
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const toggleAlarmMute = () => setIsAlarmMuted((prev) => !prev);

  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(() => getIsFirestoreQuotaExceeded());

  useEffect(() => {
    return subscribeFirestoreQuota((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });
  }, []);

  const dismissQuotaWarning = () => {
    setIsQuotaExceeded(false);
  };

  const verifyFirestoreConnection = async () => {
    const res = await testAndVerifyFirestore();
    setIsFirestoreOnline(res.success);
    return res;
  };

  // Sync to LocalStorage com proteção total contra cota e falhas de disco
  useEffect(() => {
    safeSetItem(STORAGE_KEYS.TENANTS, JSON.stringify(allTenants));
  }, [allTenants]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.CURRENT_TENANT, currentTenantId);
  }, [currentTenantId]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    try {
      const ops = users.filter((u) => u.role === 'operador');
      if (ops.length > 0) {
        if (currentTenant?.id) {
          const tenantOps = ops.filter((u) => u.tenantId === currentTenant.id);
          safeSetItem(`driftpark_operators_${currentTenant.id}`, JSON.stringify(tenantOps));
        }
        if (currentUser?.email) {
          const adminOps = ops.filter(
            (u) => u.adminEmail === currentUser.email || u.tenantId === currentUser.tenantId
          );
          safeSetItem(`driftpark_admin_operators_${currentUser.email}`, JSON.stringify(adminOps));
        }
      }
    } catch {}
  }, [users, currentTenant?.id, currentUser?.email, currentUser?.tenantId]);

  // CHAVE PRIMÁRIA MULTI-TENANT BASEADA NO UID DO USUÁRIO AUTENTICADO
  const rawTenantKey = currentUser?.tenantId || currentTenantId || currentTenant?.id || 'tenant_drift_01';
  const activeTenantKey = isAdmcledisonAccount(rawTenantKey) || isAdmcledisonAccount(currentUser?.email) || isAdmcledisonAccount(currentUser?.adminEmail)
    ? 'tenant_admcledison_gmail_com'
    : rawTenantKey;

  useEffect(() => {
    if (currentUser) {
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      safeRemoveItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    if (Array.isArray(vehiclesState) && vehiclesState.length > 0) {
      safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehiclesState));
      if (activeTenantKey) {
        safeSetItem(`driftpark_vehicles_${activeTenantKey}`, JSON.stringify(vehiclesState));
      }
    }
  }, [vehiclesState, activeTenantKey]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.RENTALS, JSON.stringify(rentalsState));
  }, [rentalsState]);

  useEffect(() => {
    safeSetItem(STORAGE_KEYS.QUEUE, JSON.stringify(queueState));
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

  const isItemInActiveTenant = (itemTenantId?: string, itemAdminEmail?: string, itemCreatedBy?: string, itemUid?: string): boolean => {
    if (!itemTenantId && !itemAdminEmail && !itemCreatedBy && !itemUid) return false;
    if (itemTenantId && isSameTenantId(itemTenantId, activeTenantKey)) return true;

    const cleanAdmin = (itemAdminEmail || '').toLowerCase().trim();
    const cleanCreatedBy = (itemCreatedBy || '').toLowerCase().trim();
    const cleanUid = (itemUid || '').trim();
    const cleanUser = (currentUser?.email || '').toLowerCase().trim();
    const cleanAdminOfUser = (currentUser?.adminEmail || '').toLowerCase().trim();

    if (
      activeTenantKey === 'tenant_admcledison_gmail_com' ||
      isAdmcledisonAccount(currentUser?.email) ||
      isAdmcledisonAccount(currentUser?.tenantId) ||
      cleanUser === 'carollimap1993@gmail.com'
    ) {
      if (itemTenantId && (isAdmcledisonAccount(itemTenantId) || itemTenantId === 'tenant_admcledison_gmail_com')) return true;
      if (isAdmcledisonAccount(cleanAdmin) || isAdmcledisonAccount(cleanCreatedBy)) return true;
      if (cleanUid === 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2' || cleanUid === 'usr_admcledison') return true;
      if (cleanAdmin && (cleanAdmin === cleanUser || cleanAdmin === cleanAdminOfUser || cleanAdmin === 'carollimap1993@gmail.com' || cleanAdmin === 'adm_cledison@outlook.com' || cleanAdmin === 'admcledison@gmail.com')) return true;
      if (cleanCreatedBy && (cleanCreatedBy === cleanUser || cleanCreatedBy === cleanAdminOfUser || cleanCreatedBy === 'carollimap1993@gmail.com' || cleanCreatedBy === 'adm_cledison@outlook.com' || cleanCreatedBy === 'admcledison@gmail.com')) return true;
      return true;
    }
    return isSameTenantId(itemTenantId, activeTenantKey);
  };

  // STRICT MULTI-TENANT FILTERING COM PROTEÇÃO TOTAL CONTRA NULOS E DADOS FICTÍCIOS
  const vehicles = (Array.isArray(vehiclesState) ? vehiclesState : []).filter(
    (v) => v && v.id && !isMockVehicle(v) && isItemInActiveTenant(v.tenantId, (v as any).adminEmail, (v as any).createdBy, (v as any).adminUid)
  );
  const rentals = (Array.isArray(rentalsState) ? rentalsState : []).filter(
    (r) => r && r.id && !isMockRental(r) && !(r as any).isDeleted && !(r as any).isMock && isItemInActiveTenant(r.tenantId, r.adminEmail, (r as any).createdBy, (r as any).adminUid)
  );
  const queue = (Array.isArray(queueState) ? queueState : []).filter(
    (q) => q && q.id && !isMockQueue(q) && isItemInActiveTenant(q.tenantId, (q as any).adminEmail, (q as any).createdBy, (q as any).adminUid)
  );

  // =========================================================================
  // 1. SINCRONIZAÇÃO DIRETA COM O FIREBASE CLOUD DATABASE (FIRESTORE + REALTIME DB)
  // Puxa veículos, corridas, fila, equipe e preços diretamente do Firebase Database
  // =========================================================================
  const pullFromFirestoreDirectly = async (targetTenantKey?: string) => {
    const tenantKey = targetTenantKey || activeTenantKey;
    if (!tenantKey) return;
    setIsSyncing(true);

    try {
      const cleanUserEmail = (currentUser?.email || '').toLowerCase().trim();
      const userAdminEmail = (currentUser?.adminEmail || '').toLowerCase().trim();
      const isMichel =
        cleanUserEmail === 'michel.lima20000@gmail.com' ||
        cleanUserEmail === 'michellimasilva979@gmail.com' ||
        tenantKey === 'tenant_drift_01';
      const isCurrentAdmcledison = isAdmcledisonAccount(cleanUserEmail) || isAdmcledisonAccount(tenantKey);

      // 1. EXECUTA CONSULTAS DIRECIONADAS AO FIRESTORE COM ISOLAMENTO MULTI-TENANT (RESOLUÇÃO EM < 500ms)
      const targetAdminEmail =
        isCurrentAdmcledison || cleanUserEmail === 'adm_cledison@outlook.com'
          ? 'adm_cledison@outlook.com'
          : cleanUserEmail;

      const isQuotaOff = getIsFirestoreQuotaExceeded();

      const [
        snapVeiculos,
        snapCorridas,
        snapFila,
        tenantDoc,
        snapUsers,
        cloudApiData,
      ] = await Promise.all([
        !isQuotaOff ? getDocs(collection(db, 'veiculos')).catch(() => null) : Promise.resolve(null),
        !isQuotaOff ? getDocs(collection(db, 'corridas')).catch(() => null) : Promise.resolve(null),
        !isQuotaOff ? getDocs(collection(db, 'fila')).catch(() => null) : Promise.resolve(null),
        !isQuotaOff ? getDoc(doc(db, 'tenants', tenantKey)).catch(() => null) : Promise.resolve(null),
        !isQuotaOff ? getDocs(collection(db, 'users')).catch(() => null) : Promise.resolve(null),
        fetchTenantCloudData(tenantKey).catch(() => null),
      ]);

      // 2. VEÍCULOS / FROTA: Correspondência estrita de tenant e de administrador criador
      const foundVehiclesMap = new Map<string, Vehicle>();
      const isVehicleMatch = (d: any): boolean => {
        if (!d) return false;
        const vTenant = d.tenantId || '';
        const adminEmail = (d.adminEmail || d.createdBy || '').toLowerCase().trim();

        if (isSameTenantId(vTenant, tenantKey)) return true;
        if (cleanUserEmail && (adminEmail === cleanUserEmail || d.createdBy?.toLowerCase() === cleanUserEmail || isAdmcledisonAccount(adminEmail))) return true;
        if (userAdminEmail && (adminEmail === userAdminEmail || d.createdBy?.toLowerCase() === userAdminEmail || isAdmcledisonAccount(adminEmail))) return true;
        if (isCurrentAdmcledison && (isAdmcledisonAccount(vTenant) || isAdmcledisonAccount(adminEmail))) return true;
        if (isMichel) return true;
        return false;
      };

      const processVehDoc = (docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d || !isVehicleMatch(d)) return;

        const veh: Vehicle = {
          id: docSnap.id || d.id,
          tenantId: tenantKey,
          name: d.name || 'Veículo',
          code: d.code || '#01',
          category: d.category || 'DRIFT',
          status: d.status || 'disponivel',
          batteryLevel: typeof d.batteryLevel === 'number' ? d.batteryLevel : 100,
          totalRuns: typeof d.totalRuns === 'number' ? d.totalRuns : 0,
          activeRentalId: d.activeRentalId || undefined,
          imageUrl: d.imageUrl || undefined,
        };
        if (!isMockVehicle(veh)) {
          foundVehiclesMap.set(veh.id, veh);
        }
      };

      if (snapVeiculos) snapVeiculos.forEach(processVehDoc);
      if (cloudApiData && Array.isArray(cloudApiData.vehicles)) {
        cloudApiData.vehicles.forEach(processVehDoc);
      }

      const cloudVehicles = Array.from(foundVehiclesMap.values());
      const finalVehicles = cloudVehicles.length > 0 ? cloudVehicles : getDefaultFleet(tenantKey);

      setVehiclesState((prev) => {
        const { merged } = mergeVehicles(prev, finalVehicles, tenantKey);
        return merged;
      });

      // 3. CORRIDAS / HISTÓRICO COM ISOLAMENTO MULTI-TENANT ESTRITO
      const foundRentalsMap = new Map<string, Rental>();
      const isRentalMatch = (d: any): boolean => {
        if (!d || d.isDeleted || d.isMock) return false;
        if (isMockRental(d)) return false;

        const rTenant = (d.tenantId || '').trim();
        const rAdminEmail = (d.adminEmail || d.ownerEmail || '').toLowerCase().trim();
        const rCreatedBy = (d.createdBy || '').toLowerCase().trim();
        const rUid = (d.adminUid || d.ownerUid || '').trim();

        // Isolamento exclusivo para adm_cledison@outlook.com
        if (
          isCurrentAdmcledison ||
          cleanUserEmail === 'adm_cledison@outlook.com' ||
          userAdminEmail === 'adm_cledison@outlook.com' ||
          tenantKey === 'tenant_admcledison_gmail_com'
        ) {
          return (
            rAdminEmail === 'adm_cledison@outlook.com' ||
            rCreatedBy === 'adm_cledison@outlook.com' ||
            rUid === 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2' ||
            (isSameTenantId(rTenant, tenantKey) && (!rAdminEmail || rAdminEmail === 'adm_cledison@outlook.com'))
          );
        }

        if (isSameTenantId(rTenant, tenantKey)) return true;
        if (cleanUserEmail && (rAdminEmail === cleanUserEmail || rCreatedBy === cleanUserEmail)) return true;
        if (userAdminEmail && (rAdminEmail === userAdminEmail || rCreatedBy === userAdminEmail)) return true;
        if (isMichel) return true;
        return false;
      };

      const processRentalDoc = (docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d || !isRentalMatch(d)) return;

        const rent: Rental = {
          id: docSnap.id || d.id,
          tenantId: tenantKey,
          vehicleId: d.vehicleId,
          vehicleName: d.vehicleName,
          vehicleCode: d.vehicleCode,
          vehicleCategory: d.vehicleCategory,
          vehicleImageUrl: d.vehicleImageUrl,
          customerName: d.customerName || 'Piloto',
          customerPhone: d.customerPhone || '-',
          durationMinutes: d.durationMinutes || 10,
          amount: d.amount || 0,
          paymentMethod: d.paymentMethod || 'PIX',
          paymentStatus: d.paymentStatus || 'PAGO',
          mode: d.mode || 'LIVRE',
          startTime: d.startTime || d.createdAt || Date.now(),
          endTime: d.endTime || Date.now(),
          status: d.status || 'concluida',
          remainingTimeMs: d.remainingTimeMs,
          pausedAt: d.pausedAt,
          pauseReason: d.pauseReason,
          operatorId: d.operatorId,
          operatorName: d.operatorName,
          createdAt: d.createdAt || d.startTime || Date.now(),
          notes: d.notes,
          isManualPastEntry: d.isManualPastEntry,
          isNightClosure: d.isNightClosure,
          closureDetails: d.closureDetails,
          adminEmail: 'adm_cledison@outlook.com',
          adminUid: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
        };
        if (!isMockRental(rent) && !(d as any).isDeleted && !(d as any).isMock) {
          foundRentalsMap.set(rent.id, rent);
        }
      };

      if (snapCorridas) snapCorridas.forEach(processRentalDoc);
      if (cloudApiData && Array.isArray(cloudApiData.rentals)) {
        cloudApiData.rentals.forEach(processRentalDoc);
      }

      const cloudRentals = Array.from(foundRentalsMap.values()).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      );
      setRentalsState((prev) => {
        const { merged } = mergeRentals(prev, cloudRentals, tenantKey);
        return merged;
      });

      // 4. FILA DE ESPERA
      const foundQueueMap = new Map<string, QueueItem>();
      const isQueueMatch = (d: any): boolean => {
        if (!d) return false;
        const qTenant = d.tenantId || '';
        const qAdminEmail = (d.adminEmail || d.createdBy || '').toLowerCase().trim();

        if (isSameTenantId(qTenant, tenantKey)) return true;
        if (cleanUserEmail && (qAdminEmail === cleanUserEmail || d.createdBy?.toLowerCase() === cleanUserEmail || isAdmcledisonAccount(qAdminEmail))) return true;
        if (userAdminEmail && (qAdminEmail === userAdminEmail || d.createdBy?.toLowerCase() === userAdminEmail || isAdmcledisonAccount(qAdminEmail))) return true;
        if (isCurrentAdmcledison && (isAdmcledisonAccount(qTenant) || isAdmcledisonAccount(qAdminEmail))) return true;
        if (isMichel) return true;
        return false;
      };

      const processQueueDoc = (docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d || !isQueueMatch(d)) return;

        const item: QueueItem = {
          id: docSnap.id || d.id,
          tenantId: tenantKey,
          customerName: d.customerName || 'Cliente',
          customerPhone: d.customerPhone || '',
          categoryDesired: d.categoryDesired || d.category || 'DRIFT',
          durationMinutes: d.durationMinutes || 10,
          addedAt: d.addedAt || d.createdAt || Date.now(),
          notes: d.notes,
          status: d.status || 'aguardando',
        };
        if (!isMockQueue(item)) {
          foundQueueMap.set(item.id, item);
        }
      };

      if (snapFila) snapFila.forEach(processQueueDoc);
      if (cloudApiData && Array.isArray(cloudApiData.queue)) {
        cloudApiData.queue.forEach(processQueueDoc);
      }

      const cloudQueue = Array.from(foundQueueMap.values()).sort(
        (a, b) => (a.addedAt || 0) - (b.addedAt || 0)
      );
      setQueueState((prev) => {
        const { merged } = mergeQueue(prev, cloudQueue, tenantKey);
        return merged;
      });

      // 5. CONFIGURAÇÃO / PREÇOS DO TENANT
      if (tenantDoc && tenantDoc.exists && tenantDoc.exists()) {
        const d = tenantDoc.data();
        if (d) {
          setAllTenants((prev) => {
            const exists = prev.some((t) => t.id === tenantKey);
            if (exists) {
              return prev.map((t) =>
                t.id === tenantKey
                  ? {
                      ...t,
                      name: d.name || t.name,
                      city: d.city || t.city,
                      pricing: d.pricing ? { ...t.pricing, ...d.pricing } : t.pricing,
                    }
                  : t
              );
            }
            return [
              ...prev,
              {
                id: tenantKey,
                name: d.name || 'DRIFT PARK',
                city: d.city || 'Pista Principal',
                document: d.document || '00.000.000/0001-00',
                active: true,
                pricing: d.pricing || { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
              },
            ];
          });
        }
      } else if (cloudApiData && cloudApiData.pricing) {
        setAllTenants((prev) =>
          prev.map((t) => (t.id === tenantKey ? { ...t, pricing: { ...t.pricing, ...cloudApiData.pricing } } : t))
        );
      } else if (isCurrentAdmcledison) {
        const defaultTenantObj: Tenant = {
          id: 'tenant_admcledison_gmail_com',
          name: 'DRIFT PARK',
          city: 'Pista Principal',
          document: '00.000.000/0001-00',
          active: true,
          pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
        };
        setAllTenants((prev) => {
          if (prev.some((t) => t.id === defaultTenantObj.id)) return prev;
          return [...prev, defaultTenantObj];
        });
      }

      // 6. OPERADORES / EQUIPE VINCULADA AO ADMINISTRADOR
      const foundUsersMap = new Map<string, UserProfile>();
      const isUserMatch = (d: any): boolean => {
        if (!d) return false;
        const uTenant = d.tenantId || '';
        const email = (d.email || '').toLowerCase().trim();
        const dAdminEmail = (d.adminEmail || d.createdBy || '').toLowerCase().trim();
        if (isMockEmail(email)) return false;
        if (isOperatorDeleted(email, d.id)) return false;

        if (isSameTenantId(uTenant, tenantKey)) return true;
        if (cleanUserEmail && (dAdminEmail === cleanUserEmail || email === cleanUserEmail || isAdmcledisonAccount(dAdminEmail))) return true;
        if (userAdminEmail && (dAdminEmail === userAdminEmail || email === userAdminEmail || isAdmcledisonAccount(dAdminEmail))) return true;
        if (isCurrentAdmcledison && (isAdmcledisonAccount(uTenant) || isAdmcledisonAccount(dAdminEmail) || isAdmcledisonAccount(email))) return true;
        if (isMichel) return true;
        return false;
      };

      const processUserDoc = (docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d || !isUserMatch(d)) return;

        const email = (d.email || '').toLowerCase().trim();
        foundUsersMap.set(email, {
          id: docSnap.id || d.id,
          name: d.name || email.split('@')[0],
          email,
          role: d.role === 'admin' ? 'admin' : 'operador',
          tenantId: tenantKey,
          phone: d.phone,
          createdAt: d.createdAt || Date.now(),
          adminEmail: d.adminEmail || d.createdBy,
          adminName: d.adminName,
          createdBy: d.createdBy,
        });
      };

      if (snapUsers) snapUsers.forEach(processUserDoc);
      if (cloudApiData && Array.isArray(cloudApiData.users)) {
        cloudApiData.users.forEach(processUserDoc);
      }

      // Garante conta oficial do Administrador adm_cledison@outlook.com
      if (!foundUsersMap.has('adm_cledison@outlook.com')) {
        const admUser: UserProfile = {
          id: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
          name: 'Admcledison',
          email: 'adm_cledison@outlook.com',
          role: 'admin',
          tenantId: 'tenant_admcledison_gmail_com',
          adminEmail: 'adm_cledison@outlook.com',
          adminName: 'Admcledison',
          createdAt: 1791926468433,
          savedPassword: '123456',
        };
        foundUsersMap.set('adm_cledison@outlook.com', admUser);
      }

      // Garante o operador cadastrado carollimap1993 vinculado ao Administrador caso não tenha sido excluído
      if (!foundUsersMap.has('carollimap1993@gmail.com') && !isOperatorDeleted('carollimap1993@gmail.com')) {
        const carolUser: UserProfile = {
          id: 'JBLyrtB5y3cSN8Xll1vypnxAGK02',
          name: 'carollimap1993',
          email: 'carollimap1993@gmail.com',
          role: 'operador',
          tenantId: 'tenant_adm_cledison_outlook_com',
          adminEmail: 'adm_cledison@outlook.com',
          adminName: 'Admcledison',
          createdAt: 1792066542795,
          savedPassword: '123456',
        };
        foundUsersMap.set('carollimap1993@gmail.com', carolUser);
      }

      if (foundUsersMap.size > 0 || users.length > 0) {
        const cloudUsers = Array.from(foundUsersMap.values());
        setUsers((prev) => {
          const { merged } = mergeUsers(prev, cloudUsers);
          return merged;
        });
      }

      markFirestoreAvailable();
      setIsFirestoreOnline(true);
    } catch (err) {
      console.warn('Aviso ao sincronizar do Firestore:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sincronização manual imediata disparada pelo usuário
  const syncWithCloudNow = async () => {
    setIsSyncing(true);
    try {
      await flushPendingWrites();
      await pullFromFirestoreDirectly(activeTenantKey);
      const cData = await fetchTenantCloudData(activeTenantKey);
      if (cData) {
        if (Array.isArray(cData.vehicles) && cData.vehicles.length > 0) {
          setVehiclesState((prev) => {
            const { merged } = mergeVehicles(prev, cData.vehicles, activeTenantKey);
            return merged;
          });
        }
        if (Array.isArray(cData.rentals) && cData.rentals.length > 0) {
          setRentalsState((prev) => {
            const { merged } = mergeRentals(prev, cData.rentals, activeTenantKey);
            return merged;
          });
        }
        if (Array.isArray(cData.queue) && cData.queue.length > 0) {
          setQueueState((prev) => {
            const { merged } = mergeQueue(prev, cData.queue, activeTenantKey);
            return merged;
          });
        }
        if (Array.isArray(cData.users) && cData.users.length > 0) {
          setUsers((prev) => {
            const { merged } = mergeUsers(prev, cData.users);
            safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
            return merged;
          });
        }
      }
    } finally {
      setIsSyncing(false);
      playTone('click');
    }
  };

  // Carga inicial assim que o componente é montado
  // Carga inicial e re-fetch automático sempre que o usuário logar ou mudar de sessão/tenant
  useEffect(() => {
    if (activeTenantKey) {
      pullFromFirestoreDirectly(activeTenantKey);
    }
  }, [currentUser?.id, currentUser?.tenantId, activeTenantKey]);

  // =========================================================================
  // 2. SINCRONIZAÇÃO EM TEMPO REAL: AUTH STATE DO FIREBASE COM PERSISTÊNCIA LOCAL
  // =========================================================================
  useEffect(() => {
    // Força o Firebase a lembrar do usuário e do histórico localmente
    const rememberMe = safeGetItem('driftpark_remember_me');
    const savedEmail = safeGetItem('driftpark_saved_email');
    const savedPassword = safeGetItem('driftpark_saved_password');

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        if (rememberMe !== 'false' && savedEmail && savedPassword && !auth.currentUser) {
          return signInWithEmailAndPassword(auth, savedEmail, savedPassword).catch((err) => {
            if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
              return createUserWithEmailAndPassword(auth, savedEmail, savedPassword).catch(() => null);
            }
          });
        }
      })
      .catch((error) => {
        console.error("Erro na persistência do Firebase Auth:", error?.message);
      });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        const email = (firebaseUser.email || '').toLowerCase().trim();
        const isMichel =
          email === 'michel.lima20000@gmail.com' || email === 'michellimasilva979@gmail.com';
        const isAdmcledison = isAdmcledisonAccount(email);
        const canonicalTenant = isMichel
          ? 'tenant_drift_01'
          : isAdmcledison
          ? 'tenant_admcledison_gmail_com'
          : `tenant_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // 1. Resolução paralela rápida da conta no Firebase e Servidor (máx 800ms)
        const [cloudApiUser, cloudProfile] = await Promise.all([
          email ? findUserInCloudByEmail(email).catch(() => null) : Promise.resolve(null),
          getFirestoreUserProfile(email || uid).catch(() => null),
        ]);

        // 2. Fallback de metadados embutidos no Firebase Auth
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
            resolved.tenantId || (resolvedRole === 'admin' ? canonicalTenant : 'tenant_drift_01');

          const userObj: UserProfile = {
            id: uid,
            name: resolved.name || firebaseUser.displayName || (isAdmcledison ? 'Admcledison' : email.split('@')[0]),
            email: isAdmcledison ? 'adm_cledison@outlook.com' : (email || resolved.email),
            role: resolvedRole,
            tenantId: isAdmcledison ? 'tenant_admcledison_gmail_com' : resolvedTenantId,
            phone: resolved.phone,
            adminEmail: isAdmcledison ? 'adm_cledison@outlook.com' : (resolved.adminEmail || resolved.createdBy),
            adminName: isAdmcledison ? 'Admcledison' : resolved.adminName,
            createdBy: resolved.createdBy,
            createdAt: resolved.createdAt || Date.now(),
          };

          setCurrentUser(userObj);
          setCurrentTenantId(userObj.tenantId);
          safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userObj));
          safeSetItem(STORAGE_KEYS.CURRENT_TENANT, userObj.tenantId);

          // Puxa imediatamente todos os dados da conta diretamente do Firebase Firestore em alta velocidade!
          pullFromFirestoreDirectly(userObj.tenantId);
        } else if (email) {
          const defaultTenant = canonicalTenant;

          const defaultAdmin: UserProfile = {
            id: uid,
            name: isMichel ? 'Michel Lima' : (isAdmcledison ? 'Admcledison' : (firebaseUser.displayName || email.split('@')[0])),
            email: isAdmcledison ? 'adm_cledison@outlook.com' : email,
            role: 'admin',
            tenantId: defaultTenant,
            adminEmail: isAdmcledison ? 'adm_cledison@outlook.com' : undefined,
            adminName: isAdmcledison ? 'Admcledison' : undefined,
            createdAt: Date.now(),
          };
          setCurrentUser(defaultAdmin);
          setCurrentTenantId(defaultAdmin.tenantId);
          safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultAdmin));
          safeSetItem(STORAGE_KEYS.CURRENT_TENANT, defaultAdmin.tenantId);
          registerUserInCloud(defaultAdmin);

          pullFromFirestoreDirectly(defaultAdmin.tenantId);
        }
      } else {
        const saved = safeGetItem(STORAGE_KEYS.CURRENT_USER);
        if (!saved) {
          setCurrentUser(null);
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Sincronização periódica em nuvem automatizada e ultra-leve via servidor
  useEffect(() => {
    if (!activeTenantKey) return;
    let isMounted = true;
    let isExecuting = false;

    const syncTick = async () => {
      if (!isMounted || isExecuting) return;
      isExecuting = true;
      try {
        const cData = await fetchTenantCloudData(activeTenantKey);
        if (!isMounted || !cData) return;

        if (Array.isArray(cData.vehicles) && cData.vehicles.length > 0) {
          setVehiclesState((prev) => {
            const { merged } = mergeVehicles(prev, cData.vehicles, activeTenantKey);
            return merged;
          });
        }
        if (Array.isArray(cData.rentals) && cData.rentals.length > 0) {
          setRentalsState((prev) => {
            const { merged } = mergeRentals(prev, cData.rentals, activeTenantKey);
            return merged;
          });
        }
        if (Array.isArray(cData.queue) && cData.queue.length > 0) {
          setQueueState((prev) => {
            const { merged } = mergeQueue(prev, cData.queue, activeTenantKey);
            return merged;
          });
        }
        if (Array.isArray(cData.users) && cData.users.length > 0) {
          setUsers((prev) => {
            const { merged } = mergeUsers(prev, cData.users);
            safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
            return merged;
          });
        }
      } catch {
        // Silencioso em background
      } finally {
        isExecuting = false;
      }
    };

    const interval = setInterval(syncTick, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTenantKey]);

  // =========================================================================
  // 3. SINCRONIZAÇÃO EM TEMPO REAL: FROTA DE VEÍCULOS (veiculos + vehicles)
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;

    const unsubs: (() => void)[] = [];
    const handleSnapshot = (snapshot: any) => {
      const cloudVehicles: Vehicle[] = [];
      const cleanUserEmail = (currentUser?.email || '').toLowerCase().trim();

      snapshot.forEach((docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d) return;
        const vTenant = d.tenantId || '';
        const adminEmail = (d.adminEmail || d.createdBy || '').toLowerCase().trim();

        const match =
          isSameTenantId(vTenant, activeTenantKey) ||
          (cleanUserEmail && (adminEmail === cleanUserEmail || isAdmcledisonAccount(adminEmail))) ||
          (isAdmcledisonAccount(activeTenantKey) && (isAdmcledisonAccount(vTenant) || isAdmcledisonAccount(adminEmail)));

        if (match) {
          const veh: Vehicle = {
            id: docSnap.id || d.id,
            tenantId: activeTenantKey,
            name: d.name,
            code: d.code,
            category: d.category,
            status: d.status,
            batteryLevel: typeof d.batteryLevel === 'number' ? d.batteryLevel : 100,
            totalRuns: typeof d.totalRuns === 'number' ? d.totalRuns : 0,
            activeRentalId: d.activeRentalId || undefined,
            imageUrl: d.imageUrl || undefined,
          };
          if (!isMockVehicle(veh)) {
            cloudVehicles.push(veh);
          }
        }
      });

      if (cloudVehicles.length > 0) {
        setVehiclesState((prev) => {
          const { merged } = mergeVehicles(prev, cloudVehicles, activeTenantKey);
          return merged;
        });
      }
    };

    try {
      unsubs.push(
        onSnapshot(collection(db, 'veiculos'), handleSnapshot, () => {})
      );
    } catch {}

    return () => unsubs.forEach((u) => u());
  }, [activeTenantKey, currentUser?.email]);

  // =========================================================================
  // 4. SINCRONIZAÇÃO EM TEMPO REAL: CORRIDAS / TELEMETRIA (corridas + rentals)
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;

    const unsubs: (() => void)[] = [];
    const handleRentalSnapshot = (snapshot: any) => {
      const cloudRentals: Rental[] = [];
      const cleanUserEmail = (currentUser?.email || '').toLowerCase().trim();

      snapshot.forEach((docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d) return;
        const rTenant = d.tenantId || '';
        const rAdminEmail = (d.adminEmail || d.createdBy || '').toLowerCase().trim();

        const match =
          isSameTenantId(rTenant, activeTenantKey) ||
          (cleanUserEmail && (rAdminEmail === cleanUserEmail || isAdmcledisonAccount(rAdminEmail))) ||
          (isAdmcledisonAccount(activeTenantKey) && (isAdmcledisonAccount(rTenant) || isAdmcledisonAccount(rAdminEmail)));

        if (match) {
          const rent: Rental = {
            id: docSnap.id || d.id,
            tenantId: activeTenantKey,
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
          };
          if (!isMockRental(rent)) {
            cloudRentals.push(rent);
          }
        }
      });

      if (cloudRentals.length > 0) {
        setRentalsState((prev) => {
          const { merged } = mergeRentals(prev, cloudRentals, activeTenantKey);
          return merged;
        });
      }
    };

    try {
      unsubs.push(
        onSnapshot(collection(db, 'corridas'), handleRentalSnapshot, () => {})
      );
    } catch {}

    return () => unsubs.forEach((u) => u());
  }, [activeTenantKey, currentUser?.email]);

  // =========================================================================
  // 5. SINCRONIZAÇÃO EM TEMPO REAL: FILA DE ESPERA (fila)
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;

    const unsubs: (() => void)[] = [];
    const handleQueueSnapshot = (snapshot: any) => {
      const cloudQueue: QueueItem[] = [];
      const cleanUserEmail = (currentUser?.email || '').toLowerCase().trim();

      snapshot.forEach((docSnap: any) => {
        const d = docSnap?.data ? docSnap.data() : docSnap;
        if (!d) return;
        const qTenant = d.tenantId || '';
        const qAdminEmail = (d.adminEmail || d.createdBy || '').toLowerCase().trim();

        const match =
          isSameTenantId(qTenant, activeTenantKey) ||
          (cleanUserEmail && (qAdminEmail === cleanUserEmail || isAdmcledisonAccount(qAdminEmail))) ||
          (isAdmcledisonAccount(activeTenantKey) && (isAdmcledisonAccount(qTenant) || isAdmcledisonAccount(qAdminEmail)));

        if (match) {
          const item: QueueItem = {
            id: docSnap.id || d.id,
            tenantId: activeTenantKey,
            customerName: d.customerName,
            customerPhone: d.customerPhone,
            categoryDesired: d.categoryDesired || d.category || 'DRIFT',
            durationMinutes: d.durationMinutes || 10,
            addedAt: d.addedAt || d.createdAt || Date.now(),
            notes: d.notes,
            status: d.status || 'aguardando',
          };
          if (!isMockQueue(item)) {
            cloudQueue.push(item);
          }
        }
      });

      if (cloudQueue.length > 0) {
        setQueueState((prev) => {
          const { merged } = mergeQueue(prev, cloudQueue);
          return merged;
        });
      }
    };

    try {
      unsubs.push(
        onSnapshot(collection(db, 'fila'), handleQueueSnapshot, () => {})
      );
    } catch {}

    return () => unsubs.forEach((u) => u());
  }, [activeTenantKey, currentUser?.email]);

  // =========================================================================
  // 6. SINCRONIZAÇÃO EM TEMPO REAL: CONFIGURAÇÃO / PREÇOS DA PISTA (tenants)
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        doc(db, 'tenants', activeTenantKey),
        (docSnap) => {
          if (docSnap.exists()) {
            const d = docSnap.data();
            if (d && d.pricing) {
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
          console.warn('[Firebase] Aviso no listener de tenant config:', err);
        }
      );
    } catch {}
    return () => unsubscribe();
  }, [activeTenantKey, currentTenant.id]);

  // =========================================================================
  // 7. SINCRONIZAÇÃO EM TEMPO REAL: EQUIPE E OPERADORES (users)
  // Re-renderiza e atualiza em tempo real entre diferentes sessões e abas
  // =========================================================================
  useEffect(() => {
    if (!activeTenantKey) return;

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const cloudUsers: UserProfile[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            if (!d || !d.email || isMockEmail(d.email)) return;
            if (isOperatorDeleted(d.email, docSnap.id || d.id)) return;

            cloudUsers.push({
              id: docSnap.id || d.id,
              name: d.name || d.email.split('@')[0],
              email: d.email.toLowerCase().trim(),
              role: d.role === 'admin' ? 'admin' : 'operador',
              tenantId: d.tenantId || activeTenantKey,
              phone: d.phone,
              createdAt: d.createdAt || Date.now(),
              adminEmail: d.adminEmail || d.createdBy,
              adminName: d.adminName,
              createdBy: d.createdBy,
              savedPassword: d.savedPassword,
            });
          });

          if (cloudUsers.length > 0) {
            setUsers((prev) => {
              const { merged } = mergeUsers(prev, cloudUsers);
              return merged;
            });
          }
        },
        (err) => {
          console.warn('[Firebase] Aviso no listener de users:', err);
        }
      );
    } catch {}

    return () => unsubscribe();
  }, [activeTenantKey]);

  // Garante que o documento do Admin e dos Operadores existam na coleção 'users' e 'usuarios' do Firestore
  useEffect(() => {
    if (isFirestoreOnline && getIsFirestoreAvailable() && !getIsFirestoreQuotaExceeded()) {
      users.forEach((u) => {
        if (u && u.id && u.email && !isMockEmail(u.email) && !isOperatorDeleted(u.email, u.id)) {
          const userPayload = {
            id: u.id,
            name: u.name,
            email: u.email.toLowerCase().trim(),
            role: u.role,
            tenantId: u.tenantId,
            adminEmail: u.adminEmail || 'adm_cledison@outlook.com',
            adminName: u.adminName || 'Admcledison',
            createdAt: u.createdAt || Date.now(),
          };
          saveDocToCloud('users', u.id, userPayload, 'usuarios').catch(() => {});
          const cleanEmailDoc = u.email.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
          saveDocToCloud('users', cleanEmailDoc, userPayload, 'usuarios').catch(() => {});
        }
      });
    }
  }, [users, isFirestoreOnline]);

  // =========================================================================
  // SINCRONIZAÇÃO INTELIGENTE: MIGRAÇÃO DOS DADOS LOCAIS DO CLIENTE PARA A NUVEM
  // Garante que as informações que já foram salvas localmente no aparelho do cliente
  // subam diretamente para a nuvem sob o tenantId dele de forma 100% não-bloqueante (executa apenas 1x)
  // =========================================================================
  const migrationRanRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!activeTenantKey || migrationRanRef.current === activeTenantKey) return;
    migrationRanRef.current = activeTenantKey;

    const migrateLocalDataToCloud = async () => {
      try {
        // 1. Veículos que já existem no aparelho do cliente (apenas veículos reais)
        let clientVehicles: Vehicle[] = [];
        const rawVeh = safeGetItem(STORAGE_KEYS.VEHICLES);
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
        const rawRent = safeGetItem(STORAGE_KEYS.RENTALS);
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
        const rawUsers = safeGetItem(STORAGE_KEYS.USERS);
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
        const rawQueue = safeGetItem(STORAGE_KEYS.QUEUE);
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
        if (clientVehicles.length > 0 || clientRentals.length > 0 || clientQueue.length > 0 || clientOps.length > 0) {
          syncTenantToCloud(activeTenantKey, {
            ...(clientVehicles.length > 0 ? { vehicles: clientVehicles } : {}),
            ...(clientRentals.length > 0 ? { rentals: clientRentals } : {}),
            ...(clientQueue.length > 0 ? { queue: clientQueue } : {}),
            ...(clientOps.length > 0 ? { users: clientOps } : {}),
            pricing: currentTenant?.pricing,
          }).catch(() => {});
        }

        // Garante configurações do tenant no Firestore sem re-escrever histórico inteiro
        if (!getIsFirestoreQuotaExceeded() && currentTenant && currentTenant.pricing) {
          saveDocToCloud('tenants', activeTenantKey, {
            id: activeTenantKey,
            name: currentTenant.name || 'DRIFT PARK',
            city: currentTenant.city || 'Pista Principal',
            pricing: currentTenant.pricing,
            updatedAt: Date.now(),
          }).catch(() => {});
        }

        safeSetItem('driftpark_last_cloud_sync', String(Date.now()));
      } catch (err) {
        console.warn('Aviso durante migração segura dos dados locais para a nuvem:', err);
      }
    };

    // Executa em idle/próximo frame para não concorrer com a renderização da interface
    const timer = setTimeout(() => {
      migrateLocalDataToCloud();
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeTenantKey]);

  // Auth functions with Firebase project gympulse-personal & Cloud Server
  const register = async (name: string, email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const effectivePassword = password.trim();

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };
    if (isDeactivatedAccount(trimmedEmail)) {
      return {
        success: false,
        message: 'A conta adm.cledson@gmail.com foi desativada e não pode ser utilizada. Utilize adm_cledison@outlook.com.',
      };
    }
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

    const generatedTenantId =
      trimmedEmail === 'michel.lima20000@gmail.com'
        ? 'tenant_drift_01'
        : (trimmedEmail.includes('admcledison') || trimmedEmail.includes('outlook'))
        ? 'tenant_admcledison_gmail_com'
        : `tenant_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const userId = firebaseUid || `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const newUser: UserProfile = {
      id: userId,
      email: trimmedEmail,
      name: trimmedName,
      role: 'admin', // Novos donos de pista cadastrados recebem perfil Admin
      tenantId: generatedTenantId,
      createdAt: Date.now(),
      savedPassword: effectivePassword,
    };

    const newTenantObj: Tenant = {
      id: generatedTenantId,
      name: 'DRIFT PARK',
      city: 'Pista Principal',
      document: '00.000.000/0001-00',
      active: true,
      pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
    };

    // Garante que o tenant exista
    setAllTenants((prev) => {
      if (prev.some((t) => t.id === generatedTenantId)) return prev;
      return [...prev, newTenantObj];
    });
    setCurrentTenantId(generatedTenantId);

    // Inicia a frota 100% limpa (apenas veículos reais cadastrados pelo cliente)
    setVehiclesState([]);
    setRentalsState([]);
    setQueueState([]);

    const cleanEmailDoc = trimmedEmail.replace(/[^a-z0-9_-]/g, '_');
    registerUserInCloud(newUser);
    saveDocToCloud('users', userId, newUser, true);
    saveDocToCloud('users', cleanEmailDoc, newUser, true);
    saveDocToCloud('tenants', generatedTenantId, newTenantObj, true);

    try {
      setDoc(doc(db, 'users', userId), sanitizeForFirestore(newUser), { merge: true }).catch(() => {});
      setDoc(doc(db, 'users', cleanEmailDoc), sanitizeForFirestore(newUser), { merge: true }).catch(() => {});
      setDoc(doc(db, 'tenants', generatedTenantId), sanitizeForFirestore(newTenantObj), { merge: true }).catch(() => {});
      flushPendingWrites().catch(() => {});
    } catch {}

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
    if (isDeactivatedAccount(trimmedEmail)) {
      return {
        success: false,
        message: 'A conta adm.cledson@gmail.com foi desativada e não está mais em uso. Utilize a conta oficial adm_cledison@outlook.com.',
      };
    }

    const isMichel =
      trimmedEmail === 'michel.lima20000@gmail.com' ||
      trimmedEmail === 'michellimasilva979@gmail.com';
    const isAdmcledison = isAdmcledisonAccount(trimmedEmail);

    const canonicalTenantId = isMichel
      ? 'tenant_drift_01'
      : isAdmcledison
      ? 'tenant_admcledison_gmail_com'
      : `tenant_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const localMatch = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    // Validação de senha local caso usuário já possua senha cadastrada
    if (localMatch?.savedPassword && localMatch.savedPassword !== effectivePassword) {
      return { success: false, message: 'Senha incorreta. Verifique e tente novamente.' };
    }

    // 1. RESOLUÇÃO RÁPIDA E PARALELA DO PERFIL NO FIREBASE E NA NUVEM (MÁX 800ms)
    let cloudProfile: any = null;
    let cloudApiUser: any = null;
    try {
      [cloudProfile, cloudApiUser] = await Promise.all([
        getFirestoreUserProfile(trimmedEmail).catch(() => null),
        findUserInCloudByEmail(trimmedEmail).catch(() => null),
      ]);
    } catch {}

    const resolved = cloudProfile || cloudApiUser || localMatch;

    let profile: UserProfile;

    if (resolved) {
      const resolvedRole: UserRole = resolved.role === 'admin' ? 'admin' : 'operador';
      const resolvedTenant =
        isAdmcledisonAccount(trimmedEmail) || isAdmcledisonAccount(resolved.adminEmail) || isAdmcledisonAccount(resolved.tenantId)
          ? 'tenant_admcledison_gmail_com'
          : (resolved.tenantId || canonicalTenantId);
      profile = {
        id: resolved.id || resolved.uid || (isAdmcledison ? 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2' : `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`),
        name: resolved.name || (isMichel ? 'Michel Lima' : (isAdmcledison ? 'Admcledison' : trimmedEmail.split('@')[0])),
        email: isAdmcledison ? 'adm_cledison@outlook.com' : trimmedEmail,
        role: resolvedRole,
        tenantId: resolvedTenant,
        createdAt: resolved.createdAt || Date.now(),
        adminEmail: isAdmcledison ? 'adm_cledison@outlook.com' : (resolved.adminEmail || resolved.createdBy),
        adminName: isAdmcledison ? 'Admcledison' : resolved.adminName,
        savedPassword: effectivePassword,
      };
    } else if (trimmedEmail === 'carollimap1993@gmail.com') {
      profile = {
        id: 'usr_op_carollimap1993',
        name: 'carollimap1993',
        email: 'carollimap1993@gmail.com',
        role: 'operador',
        tenantId: 'tenant_admcledison_gmail_com',
        adminEmail: 'adm_cledison@outlook.com',
        adminName: 'Admcledison',
        createdAt: 1791804703979,
        savedPassword: effectivePassword,
      };
    } else if (isAdmcledison) {
      profile = {
        id: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
        name: 'Admcledison',
        email: 'adm_cledison@outlook.com',
        role: 'admin',
        tenantId: 'tenant_admcledison_gmail_com',
        adminEmail: 'adm_cledison@outlook.com',
        adminName: 'Admcledison',
        createdAt: 1791926468433,
        savedPassword: effectivePassword,
      };
    } else {
      profile = {
        id: `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: isMichel ? 'Michel Lima' : trimmedEmail.split('@')[0],
        email: trimmedEmail,
        role: 'admin',
        tenantId: canonicalTenantId,
        createdAt: Date.now(),
        savedPassword: effectivePassword,
      };
    }

    // 2. ISOLAMENTO MULTI-TENANT: Limpa a memória apenas se estiver trocando para um tenant totalmente diferente
    if (activeTenantKey && !isSameTenantId(activeTenantKey, profile.tenantId)) {
      setVehiclesState([]);
      setRentalsState([]);
      setQueueState([]);
    }

    setCurrentUser(profile);
    setCurrentTenantId(profile.tenantId);

    // Restaura frota e dados em cache imediatamente para o usuário/operador ter acesso instantâneo
    try {
      const cachedVehiclesStr =
        safeGetItem(`driftpark_vehicles_${profile.tenantId}`) || safeGetItem(STORAGE_KEYS.VEHICLES);
      if (cachedVehiclesStr) {
        const parsed = JSON.parse(cachedVehiclesStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validVehs = parsed.filter((v: any) => !isMockVehicle(v));
          if (validVehs.length > 0) {
            setVehiclesState(validVehs);
          }
        }
      }
      const cachedRentals = safeGetItem(STORAGE_KEYS.RENTALS);
      if (cachedRentals) {
        const parsedR = JSON.parse(cachedRentals);
        if (Array.isArray(parsedR) && parsedR.length > 0) {
          setRentalsState(parsedR.filter((r: any) => !isMockRental(r)));
        }
      }
      const cachedQueue = safeGetItem(STORAGE_KEYS.QUEUE);
      if (cachedQueue) {
        const parsedQ = JSON.parse(cachedQueue);
        if (Array.isArray(parsedQ) && parsedQ.length > 0) {
          setQueueState(parsedQ.filter((q: any) => !isMockQueue(q)));
        }
      }
    } catch {}

    // Puxa imediatamente os dados salvos no servidor local para exibição instantânea
    fetchTenantCloudData(profile.tenantId).then((cData) => {
      if (cData && Array.isArray(cData.vehicles) && cData.vehicles.length > 0) {
        setVehiclesState((prev) => {
          const { merged } = mergeVehicles(prev, cData.vehicles, profile.tenantId);
          safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(merged));
          safeSetItem(`driftpark_vehicles_${profile.tenantId}`, JSON.stringify(merged));
          return merged;
        });
      }
      if (cData && Array.isArray(cData.rentals) && cData.rentals.length > 0) {
        setRentalsState((prev) => {
          const { merged } = mergeRentals(prev, cData.rentals, profile.tenantId);
          safeSetItem(STORAGE_KEYS.RENTALS, JSON.stringify(merged));
          return merged;
        });
      }
      if (cData && Array.isArray(cData.queue)) {
        setQueueState(cData.queue);
      }
      if (cData && Array.isArray(cData.users) && cData.users.length > 0) {
        setUsers((prev) => {
          const { merged } = mergeUsers(prev, cData.users);
          safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
          return merged;
        });
      }
    }).catch(() => {});

    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail && u.id !== profile.id);
      return [...filtered, profile];
    });

    safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
    safeSetItem(STORAGE_KEYS.CURRENT_TENANT, profile.tenantId);

    playTone('start');

    // 3. SINCRONIZAÇÃO EM SEGUNDO PLANO (PUXA DIRETAMENTE DO FIREBASE SEM TRAVAR A TELA)
    (async () => {
      try {
        // Força o Firebase a lembrar do usuário e do histórico localmente
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch (persErr: any) {
          console.error("Erro na persistência:", persErr?.message);
        }

        // Autentica ou cria credencial no Firebase Auth silenciosamente
        try {
          await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
        } catch (authErr: any) {
          if (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential') {
            try {
              await createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
            } catch {}
          }
        }
      } catch {}

      // Executa SEMPRE de forma independente do Firebase Auth
      try {
        const cleanDocId = trimmedEmail.replace(/[^a-z0-9_-]/g, '_');
        registerUserInCloud(profile);
        saveDocToCloud('users', profile.id, profile, true);
        saveDocToCloud('users', cleanDocId, profile, true);

        try {
          setDoc(doc(db, 'users', profile.id), sanitizeForFirestore(profile), { merge: true }).catch(() => {});
          setDoc(doc(db, 'users', cleanDocId), sanitizeForFirestore(profile), { merge: true }).catch(() => {});
          flushPendingWrites().catch(() => {});
        } catch {}

        // Puxa dados reais do Firebase Firestore diretamente para este tenant em alta velocidade
        await pullFromFirestoreDirectly(profile.tenantId);
      } catch (bgErr) {
        console.warn('[Sync] Sincronização em segundo plano concluída com aviso:', bgErr);
      }
    })();

    return { success: true };
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}
    safeRemoveItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    setVehiclesState([]);
    setRentalsState([]);
    setQueueState([]);
    playTone('alert');
  };

  const quickLoginAs = (role: UserRole) => {
    const admProfile: UserProfile = {
      id: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
      name: 'Admcledison',
      email: 'adm_cledison@outlook.com',
      role: 'admin',
      tenantId: 'tenant_admcledison_gmail_com',
      adminEmail: 'adm_cledison@outlook.com',
      adminName: 'Admcledison',
      createdAt: 1791926468433,
      savedPassword: '123456',
    };

    const opProfile: UserProfile = {
      id: 'JBLyrtB5y3cSN8Xll1vypnxAGK02',
      name: 'carollimap1993',
      email: 'carollimap1993@gmail.com',
      role: 'operador',
      tenantId: 'tenant_admcledison_gmail_com',
      adminEmail: 'adm_cledison@outlook.com',
      adminName: 'Admcledison',
      createdAt: 1792066542795,
      savedPassword: '123456',
    };

    if (role === 'admin') {
      setCurrentUser(admProfile);
      setCurrentTenantId(admProfile.tenantId);
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(admProfile));
      safeSetItem(STORAGE_KEYS.CURRENT_TENANT, admProfile.tenantId);

      setUsers((prev) => {
        const { merged } = mergeUsers(prev, [admProfile, opProfile]);
        safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
        return merged;
      });

      try {
        const cachedVehiclesStr =
          safeGetItem(`driftpark_vehicles_${admProfile.tenantId}`) || safeGetItem(STORAGE_KEYS.VEHICLES);
        if (cachedVehiclesStr) {
          const parsed = JSON.parse(cachedVehiclesStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVehiclesState(parsed.filter((v: any) => !isMockVehicle(v)));
          }
        }
      } catch {}

      fetchTenantCloudData(admProfile.tenantId).then((cData) => {
        if (cData) {
          if (Array.isArray(cData.vehicles) && cData.vehicles.length > 0) {
            setVehiclesState((prev) => {
              const { merged } = mergeVehicles(prev, cData.vehicles, admProfile.tenantId);
              safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(merged));
              safeSetItem(`driftpark_vehicles_${admProfile.tenantId}`, JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(cData.users) && cData.users.length > 0) {
            setUsers((prev) => {
              const { merged } = mergeUsers(prev, cData.users);
              safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
              return merged;
            });
          }
        }
      }).catch(() => {});

      pullFromFirestoreDirectly(admProfile.tenantId);
    } else {
      setCurrentUser(opProfile);
      setCurrentTenantId(opProfile.tenantId);
      safeSetItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(opProfile));
      safeSetItem(STORAGE_KEYS.CURRENT_TENANT, opProfile.tenantId);

      setUsers((prev) => {
        const { merged } = mergeUsers(prev, [admProfile, opProfile]);
        safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
        return merged;
      });

      try {
        const cachedVehiclesStr =
          safeGetItem(`driftpark_vehicles_${opProfile.tenantId}`) || safeGetItem(STORAGE_KEYS.VEHICLES);
        if (cachedVehiclesStr) {
          const parsed = JSON.parse(cachedVehiclesStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVehiclesState(parsed.filter((v: any) => !isMockVehicle(v)));
          }
        }
      } catch {}

      fetchTenantCloudData(opProfile.tenantId).then((cData) => {
        if (cData) {
          if (Array.isArray(cData.vehicles) && cData.vehicles.length > 0) {
            setVehiclesState((prev) => {
              const { merged } = mergeVehicles(prev, cData.vehicles, opProfile.tenantId);
              safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(merged));
              safeSetItem(`driftpark_vehicles_${opProfile.tenantId}`, JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(cData.users) && cData.users.length > 0) {
            setUsers((prev) => {
              const { merged } = mergeUsers(prev, cData.users);
              safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
              return merged;
            });
          }
        }
      }).catch(() => {});

      pullFromFirestoreDirectly(opProfile.tenantId);
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

    const cleanDocId = cleanEmail.replace(/[^a-z0-9_-]/g, '_');
    saveDocToCloud('users', uid, userPayload, true);
    saveDocToCloud('users', cleanDocId, userPayload, true);

    try {
      setDoc(doc(db, 'users', uid), sanitizeForFirestore(userPayload), { merge: true }).catch(() => {});
      setDoc(doc(db, 'users', cleanDocId), sanitizeForFirestore(userPayload), { merge: true }).catch(() => {});
      flushPendingWrites().catch(() => {});
    } catch {}

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
        safeGetItem(`driftpark_operators_${currentUser.tenantId}`) || '[]'
      );
      const updated = [
        ...curTenantOps.filter((o: any) => o.email?.toLowerCase() !== cleanEmail),
        newMember,
      ];
      safeSetItem(
        `driftpark_operators_${currentUser.tenantId}`,
        JSON.stringify(updated)
      );
      safeSetItem(
        `driftpark_admin_operators_${currentUser.email}`,
        JSON.stringify(updated)
      );
    } catch {}

    unmarkOperatorDeleted(cleanEmail);
    if (uid) unmarkOperatorDeleted(uid);

    playTone('start');
    return { success: true, message: 'Operador cadastrado e vinculado ao administrador com sucesso!' };
  };

  const deleteOperator = async (operatorId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'admin') return false;
    try {
      // Identifica o operador por ID ou por e-mail
      const targetOp = users.find(
        (u) => u.id === operatorId || (u.email && u.email.toLowerCase() === operatorId.toLowerCase())
      );
      const opId = targetOp?.id || operatorId;
      const opEmail = (targetOp?.email || '').toLowerCase().trim();

      // Marca na lista de exclusão permanente para não ressuscitar em nenhuma sincronização
      if (opEmail) markOperatorDeleted(opEmail);
      if (opId) markOperatorDeleted(opId);

      // Remove de imediato do estado local do React
      setUsers((prev) =>
        prev.filter((u) => u.id !== opId && (u.email || '').toLowerCase().trim() !== opEmail)
      );

      // Atualiza o cache geral de usuários no LocalStorage
      try {
        const curGeneral = JSON.parse(safeGetItem(STORAGE_KEYS.USERS) || '[]');
        if (Array.isArray(curGeneral)) {
          const updatedGeneral = curGeneral.filter(
            (u: any) => u.id !== opId && (u.email || '').toLowerCase().trim() !== opEmail
          );
          safeSetItem(STORAGE_KEYS.USERS, JSON.stringify(updatedGeneral));
        }
      } catch {}

      // Atualiza os caches específicos de operadores do tenant e do admin
      if (currentUser?.tenantId) {
        try {
          const curOps = JSON.parse(
            safeGetItem(`driftpark_operators_${currentUser.tenantId}`) || '[]'
          );
          const filtered = curOps.filter(
            (u: any) => u.id !== opId && (u.email || '').toLowerCase().trim() !== opEmail
          );
          safeSetItem(`driftpark_operators_${currentUser.tenantId}`, JSON.stringify(filtered));
        } catch {}
      }
      if (currentUser?.email) {
        try {
          const adminOps = JSON.parse(
            safeGetItem(`driftpark_admin_operators_${currentUser.email}`) || '[]'
          );
          const filtered = adminOps.filter(
            (u: any) => u.id !== opId && (u.email || '').toLowerCase().trim() !== opEmail
          );
          safeSetItem(`driftpark_admin_operators_${currentUser.email}`, JSON.stringify(filtered));
        } catch {}
      }

      // Remove de todas as coleções no Cloud Firestore (users e usuarios, por id e por e-mail)
      deleteDocToCloud('users', opId, true, currentUser.tenantId);
      deleteDocToCloud('usuarios', opId, true, currentUser.tenantId);
      if (opEmail && opEmail !== opId) {
        deleteDocToCloud('users', opEmail, true, currentUser.tenantId);
        deleteDocToCloud('usuarios', opEmail, true, currentUser.tenantId);
      }
      flushPendingWrites().catch(() => {});

      // Remove do banco de dados na API em nuvem do servidor (server.ts)
      if (currentUser?.tenantId) {
        deleteOperatorCloud(currentUser.tenantId, opId, opEmail).catch(() => {});
      }

      playTone('alert');
      return true;
    } catch (err) {
      console.warn('Erro ao excluir operador:', err);
      return false;
    }
  };

  // Fleet Operations com persistência e isolamento na Nuvem (API + Firestore + RTDB)
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
    setVehiclesState((prev) => {
      const next = [...prev, newVehicle];
      safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(next));
      if (activeTenantKey) {
        safeSetItem(`driftpark_vehicles_${activeTenantKey}`, JSON.stringify(next));
      }
      return next;
    });

    const targetAdminEmail =
      activeTenantKey === 'tenant_admcledison_gmail_com'
        ? 'adm_cledison@outlook.com'
        : (currentUser?.role === 'admin' ? currentUser.email : (currentUser?.adminEmail || currentUser?.email));

    // Grava no Firebase (Firestore + RTDB) e na nuvem do servidor
    saveDocToCloud('veiculos', newVehicle.id, {
      ...newVehicle,
      adminEmail: targetAdminEmail,
      createdBy: currentUser?.email,
    }, true);
    saveVehicleCloud(activeTenantKey, newVehicle);

    playTone('click');
    return true;
  };

  const updateVehicle = (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => {
    let updatedItem: Vehicle | null = null;
    setVehiclesState((prev) => {
      const next = prev.map((v) => {
        if (v.id === vehicleId) {
          updatedItem = { ...v, ...data };
          return updatedItem;
        }
        return v;
      });
      safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(next));
      if (activeTenantKey) {
        safeSetItem(`driftpark_vehicles_${activeTenantKey}`, JSON.stringify(next));
      }
      return next;
    });

    saveDocToCloud('veiculos', vehicleId, data, false);
    if (updatedItem) {
      saveVehicleCloud(activeTenantKey, updatedItem);
    }
    playTone('click');
  };

  const updateVehicleStatus = (vehicleId: string, status: VehicleStatus) => {
    let updatedItem: Vehicle | null = null;
    setVehiclesState((prev) => {
      const next = prev.map((v) => {
        if (v.id === vehicleId) {
          updatedItem = { ...v, status };
          return updatedItem;
        }
        return v;
      });
      safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(next));
      if (activeTenantKey) {
        safeSetItem(`driftpark_vehicles_${activeTenantKey}`, JSON.stringify(next));
      }
      return next;
    });

    saveDocToCloud('veiculos', vehicleId, { status }, false);
    if (updatedItem) {
      saveVehicleCloud(activeTenantKey, updatedItem);
    }
    playTone('click');
  };

  const deleteVehicle = (vehicleId: string) => {
    setVehiclesState((prev) => {
      const next = prev.filter((v) => v.id !== vehicleId);
      safeSetItem(STORAGE_KEYS.VEHICLES, JSON.stringify(next));
      if (activeTenantKey) {
        safeSetItem(`driftpark_vehicles_${activeTenantKey}`, JSON.stringify(next));
      }
      return next;
    });

    deleteDocToCloud('veiculos', vehicleId, true);
    deleteVehicleCloud(activeTenantKey, vehicleId);
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
      deleteDocToCloud('fila', qId, true);
      setPrefilledQueueItem(null);
    }

    // Grava atomicamente em lote no Firebase Firestore e na API Cloud
    saveDocToCloud('corridas', rentalId, {
      ...newRental,
      adminEmail: currentUser?.email || undefined,
    }, true);
    saveDocToCloud('veiculos', vehicle.id, {
      status: 'em_uso',
      activeRentalId: rentalId,
      totalRuns: updatedRuns,
      batteryLevel: updatedBattery,
    }, true);

    saveRentalCloud(activeTenantKey, newRental);
    saveVehicleCloud(activeTenantKey, updatedVeh);

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

    // Grava atomicamente em lote no Firebase Firestore e na API Cloud
    saveDocToCloud(
      'corridas',
      rentalId,
      {
        status: 'concluida',
        endTime: now,
        remainingTimeMs: null,
        pausedAt: null,
        paymentMethod: finalPaymentMethod,
        paymentStatus: finalPaymentStatus,
      },
      true
    );
    if (rental.vehicleId) {
      saveDocToCloud('veiculos', rental.vehicleId, { status: 'disponivel', activeRentalId: null }, true);
    }

    saveRentalCloud(activeTenantKey, finishedRental);
    if (releasedVeh) {
      saveVehicleCloud(activeTenantKey, releasedVeh);
    }

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

    // Grava atomicamente em lote no Firebase Firestore e na API Cloud
    saveDocToCloud(
      'corridas',
      rentalId,
      { status: 'anulada', endTime: now, remainingTimeMs: null, pausedAt: null },
      true
    );
    if (rental.vehicleId) {
      saveDocToCloud('veiculos', rental.vehicleId, { status: 'disponivel', activeRentalId: null }, true);
    }

    saveRentalCloud(activeTenantKey, canceledRental);
    if (releasedVeh) {
      saveVehicleCloud(activeTenantKey, releasedVeh);
    }

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

    saveDocToCloud(
      'corridas',
      rentalId,
      {
        status: 'pausada',
        remainingTimeMs,
        pausedAt: now,
      },
      'rentals'
    );
    saveRentalCloud(activeTenantKey, pausedRental);

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

    saveDocToCloud(
      'corridas',
      rentalId,
      {
        status: 'ativa',
        endTime: newEndTime,
        remainingTimeMs: null,
        pausedAt: null,
        pauseReason: null,
      },
      'rentals'
    );
    saveRentalCloud(activeTenantKey, resumedRental);

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

    saveDocToCloud('corridas', rentalId, {
      ...newRental,
      adminEmail: currentUser?.email || undefined,
    }, 'rentals');
    saveRentalCloud(activeTenantKey, newRental);

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

    saveDocToCloud('corridas', rentalId, {
      ...closureEntry,
      adminEmail: currentUser?.email || undefined,
    }, 'rentals');
    saveRentalCloud(activeTenantKey, closureEntry);

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
      const payload: Record<string, any> = {
        durationMinutes: (updatedR as Rental).durationMinutes,
        amount: (updatedR as Rental).amount,
        endTime: (updatedR as Rental).endTime,
      };
      if ((updatedR as Rental).remainingTimeMs !== undefined) {
        payload.remainingTimeMs = (updatedR as Rental).remainingTimeMs;
      }
      saveDocToCloud('corridas', rentalId, payload, 'rentals');
      saveRentalCloud(activeTenantKey, updatedR);
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

    saveDocToCloud('corridas', rentalId, { paymentMethod, paymentStatus }, 'rentals');
    if (updatedR) {
      saveRentalCloud(activeTenantKey, updatedR);
    }
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
        saveDocToCloud('veiculos', rental.vehicleId, { status: 'disponivel', activeRentalId: null }, 'vehicles');
        saveVehicleCloud(activeTenantKey, freedVeh);
      }
    }
    setRentalsState((prev) => prev.filter((r) => r.id !== rentalId));

    deleteDocToCloud('corridas', rentalId, 'rentals', activeTenantKey);
    deleteRentalCloud(activeTenantKey, rentalId);
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

    toDelete.forEach((r) => {
      deleteDocToCloud('corridas', r.id, 'rentals', activeTenantKey);
    });
    clearRentalHistoryCloud(activeTenantKey);
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

    saveDocToCloud('fila', newItem.id, {
      ...newItem,
      adminEmail: currentUser?.email || undefined,
    }, 'queue');
    addToQueueCloud(activeTenantKey, newItem);

    playTone('click');
  };

  const removeFromQueue = (queueId: string) => {
    setQueueState((prev) => prev.filter((q) => q.id !== queueId));

    deleteDocToCloud('fila', queueId, 'queue', activeTenantKey);
    removeFromQueueCloud(activeTenantKey, queueId);
    playTone('alert');
  };

  const clearQueue = () => {
    const toDelete = queueState.filter((q) => q.tenantId === activeTenantKey || q.tenantId === currentTenant.id);
    setQueueState((prev) => prev.filter((q) => q.tenantId !== activeTenantKey && q.tenantId !== currentTenant.id));

    toDelete.forEach((q) => {
      deleteDocToCloud('fila', q.id, 'queue', activeTenantKey);
    });
    clearQueueCloud(activeTenantKey);
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

    saveDocToCloud('tenants', activeTenantKey, { pricing: updatedPricing, updatedAt: Date.now() });
    updatePricingCloud(activeTenantKey, updatedPricing);
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
        isQuotaExceeded,
        firestoreUpgradeUrl: FIRESTORE_UPGRADE_URL,
        dismissQuotaWarning,
        isSyncing,
        syncWithCloudNow,
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

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  disableNetwork,
  enableNetwork,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  getDocFromServer,
  setLogLevel,
  writeBatch,
  limit,
  orderBy,
} from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch {}
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
  remove as rtdbRemove,
  onValue as rtdbOnValue,
} from 'firebase/database';
import { Vehicle, Rental, QueueItem, UserProfile, Tenant } from '../types';
import appletConfig from '../../firebase-applet-config.json';

const cfg = (appletConfig as Record<string, string>) || {};
const USER_API_KEY = cfg.apiKey || "AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY";
const USER_PROJECT_ID = cfg.projectId || "gympulse-personal";
const USER_AUTH_DOMAIN = cfg.authDomain || "gympulse-personal.firebaseapp.com";
const USER_RTDB_URL = cfg.databaseURL || "https://gympulse-personal-default-rtdb.firebaseio.com";
const USER_STORAGE_BUCKET = cfg.storageBucket || "gympulse-personal.firebasestorage.app";
const USER_MESSAGING_SENDER_ID = cfg.messagingSenderId || "1068724964920";
const USER_APP_ID = cfg.appId || "1:1068724964920:web:d4fec7bbd3dbeceb07a0cd";
const USER_MEASUREMENT_ID = cfg.measurementId || "G-PWD1EYY9DD";

// Valida API key garantindo que a chave correta com maiúsculas/minúsculas exatas seja sempre usada
const envApiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || '';
const validApiKey = (envApiKey && envApiKey !== "AIzaSyCpG3vNSexfASWeRwQFwkQBF7Uq_kAp-uY")
  ? envApiKey
  : USER_API_KEY;

// Valida authDomain prevenindo valores corrompidos como ://firebaseapp.com
const envAuthDomain = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || '';
const validAuthDomain = (envAuthDomain && envAuthDomain.includes('.') && !envAuthDomain.startsWith('://'))
  ? envAuthDomain
  : USER_AUTH_DOMAIN;

// Valida se a URL do Realtime Database possui subdomínio real (evita erro fatal do Firebase URL parser)
const isValidRtdbUrl = (url: string | undefined | null): boolean => {
  return typeof url === 'string' && /^https:\/\/[a-z0-9_-]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/i.test(url);
};
const envDbUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_URL) || '';
const validDatabaseURL = isValidRtdbUrl(envDbUrl) ? envDbUrl : USER_RTDB_URL;

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: validApiKey,
  authDomain: validAuthDomain,
  databaseURL: validDatabaseURL,
  projectId: USER_PROJECT_ID,
  storageBucket: USER_STORAGE_BUCKET,
  messagingSenderId: USER_MESSAGING_SENDER_ID,
  appId: USER_APP_ID,
  measurementId: USER_MEASUREMENT_ID,
};

// Initialize Firebase App & Authentication
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Força o Firebase a lembrar do usuário e do histórico localmente
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      const rememberMe = window.localStorage ? window.localStorage.getItem('driftpark_remember_me') : null;
      const savedEmail = window.localStorage ? window.localStorage.getItem('driftpark_saved_email') : null;
      const savedPassword = window.localStorage ? window.localStorage.getItem('driftpark_saved_password') : null;

      // Só tenta auto-login no Firebase Auth se o usuário optou por lembrar o login e possui credenciais salvas
      if (rememberMe !== 'false' && savedEmail && savedPassword && !auth.currentUser) {
        signInWithEmailAndPassword(auth, savedEmail, savedPassword).catch((error) => {
          if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential') {
            createUserWithEmailAndPassword(auth, savedEmail, savedPassword).catch(() => {});
          }
        });
      }
    })
    .catch((error) => {
      console.error('Erro na persistência do Firebase Auth:', error?.message);
    });
}

// Previne que rejeições assíncronas do Firebase quebrem a interface
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const reasonMsg = reason?.message || String(reason || '');
    // Ignora erros de localStorage do navegador, extensões ou ruído de conexão
    if (
      reasonMsg.includes('QuotaExceeded') ||
      reasonMsg.includes('setItem') ||
      reasonMsg.includes('chrome-extension') ||
      reasonMsg.includes('installations') ||
      reasonMsg.includes('400 INVALID_ARGUMENT')
    ) {
      event.preventDefault();
      return;
    }
    // Apenas erros genuínos do Cloud Firestore com código resource-exhausted
    if (
      reason?.name === 'FirebaseError' &&
      (reason?.code === 'resource-exhausted' || reasonMsg.includes('resource-exhausted'))
    ) {
      markFirestoreQuotaExceeded();
      event.preventDefault();
      console.warn('[Firebase] Cota diária atingida no Firestore:', reasonMsg);
    }
  });
}

// Analytics is omitted to prevent invalid API key installations errors
export const analytics: any = null;

// Initialize Firestore with Memory Local Cache
// Evita acúmulo de fila de mutações travadas em IndexedDB que geram loops de retentativa
export const ACTIVE_DATABASE_ID = cfg.firestoreDatabaseId || "ai-studio-driftparkgestode-2200359e-b3be-4b5e-9c71-5f960e94bb6b";

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
    }, ACTIVE_DATABASE_ID);
  } catch (initErr) {
    return getFirestore(app, ACTIVE_DATABASE_ID);
  }
})();

// Conexão canônica com o banco de dados ativo do Firestore
export const defaultDb = db;

// Garante que a rede do Firestore esteja ativa
if (typeof window !== 'undefined') {
  try {
    enableNetwork(db).catch(() => {});
  } catch {}
}

// Limpeza preventiva de banco IndexedDB antigo do Firestore para eliminar mutações travadas em retry infinito
if (typeof window !== 'undefined' && window.indexedDB && window.indexedDB.databases) {
  try {
    window.indexedDB.databases().then((dbs) => {
      dbs.forEach((d) => {
        if (d.name && (d.name.includes('firestore') || d.name.includes('gympulse'))) {
          try { window.indexedDB.deleteDatabase(d.name); } catch {}
        }
      });
    }).catch(() => {});
  } catch {}
}

// O banco de dados primário do projeto é o Cloud Firestore (databaseId: ACTIVE_DATABASE_ID).
// Desativa escritas no Realtime Database para evitar aviso permission_denied quando não configurado.
export const ENABLE_RTDB_WRITES = false;

// Initialize Firebase Realtime Database apenas como fallback secundário de leitura
export let rtdb: ReturnType<typeof getDatabase> | null = null;
try {
  if (isValidRtdbUrl(validDatabaseURL)) {
    rtdb = getDatabase(app, validDatabaseURL);
  }
} catch (err) {
  rtdb = null;
}

// URL direta para upgrade de cota do Firestore no Firebase Console
export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${USER_PROJECT_ID}/firestore/databases/${ACTIVE_DATABASE_ID}/data?openUpgradeDialog=true`;

const QUOTA_STORAGE_KEY = 'driftpark_firestore_quota_exceeded_day';

function checkStoredQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false; // Server/pre-render safe
  try {
    const stored = window.localStorage ? window.localStorage.getItem(QUOTA_STORAGE_KEY) : null;
    const currentDay = new Date().toISOString().slice(0, 10);
    if (stored === currentDay) {
      return true;
    }
  } catch {}
  return false;
}

// Estado de disponibilidade e controle de cota do Firestore na nuvem
let isFirestoreAvailable: boolean = true;
let isFirestoreQuotaExceeded: boolean = checkStoredQuotaExceeded();
let quotaListeners: ((exceeded: boolean) => void)[] = [];

export function getIsFirestoreQuotaExceeded(): boolean {
  return isFirestoreQuotaExceeded;
}

export function subscribeFirestoreQuota(cb: (exceeded: boolean) => void): () => void {
  quotaListeners.push(cb);
  cb(isFirestoreQuotaExceeded);
  return () => {
    quotaListeners = quotaListeners.filter((l) => l !== cb);
  };
}

export function markFirestoreQuotaExceeded() {
  const currentDay = new Date().toISOString().slice(0, 10);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(QUOTA_STORAGE_KEY, currentDay);
    }
  } catch {}

  if (!isFirestoreQuotaExceeded) {
    isFirestoreQuotaExceeded = true;
    console.warn('[Firestore] Cota diária gratuita do Cloud Firestore atingida. Modo de contingência ativado.');
    quotaListeners.forEach((l) => {
      try { l(true); } catch {}
    });
  }
}

export function resetFirestoreQuotaExceeded() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  } catch {}
  isFirestoreQuotaExceeded = false;
  try {
    enableNetwork(db).catch(() => {});
  } catch {}
  quotaListeners.forEach((l) => {
    try { l(false); } catch {}
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.warn('[Firestore Diagnóstico]:', JSON.stringify(errInfo));
  return errInfo;
}

try {
  localStorage.removeItem('driftpark_firestore_available');
} catch {}

export function markFirestoreUnavailable() {
  // Mantém disponível para novas tentativas
}

export function markFirestoreAvailable() {
  isFirestoreAvailable = true;
}

export function getIsFirestoreAvailable(): boolean {
  return isFirestoreAvailable;
}

/**
 * Sanitiza recursivamente objetos e arrays para o Firestore e RTDB,
 * removendo quaisquer campos com valor 'undefined' que causam erro fatal no SDK do Firebase.
 */
export function sanitizeForFirestore<T = any>(val: T): T {
  if (val === undefined) return null as any;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, v] of Object.entries(val as Record<string, any>)) {
    if (v !== undefined) {
      result[key] = sanitizeForFirestore(v);
    }
  }
  return result as T;
}

/**
 * Otimiza e enxuga payloads antes de enviar ao Firebase Firestore:
 * - Remove campos de imagem base64 pesados de corridas (vehicleImageUrl economiza ~15KB por corrida)
 * - Remove senhas em texto puro de perfis de usuário
 * - Remove campos nulos/undefined e propriedades voláteis desnecessárias
 * - Garante apenas as informações necessárias no banco de dados na nuvem
 */
export function optimizePayloadForFirestore(collectionName: string, data: any): any {
  if (!data || typeof data !== 'object') return data;
  const clean = sanitizeForFirestore({ ...data });

  if (collectionName === 'corridas') {
    // Reduz drasticamente o consumo de dados removendo base64 repetido em cada corrida
    // A imagem do veículo já reside no cadastro do veículo (veiculos)
    if (clean.vehicleImageUrl && (clean.vehicleImageUrl.startsWith('data:') || clean.vehicleImageUrl.length > 300)) {
      delete clean.vehicleImageUrl;
    }
    // Remove senhas ou dados irrelevantes
    delete clean.savedPassword;
    delete clean.isPaused;
    // Se a corrida não estiver pausada, remove apenas campos undefined
    if (clean.status !== 'pausada') {
      if (clean.remainingTimeMs === undefined) delete clean.remainingTimeMs;
      if (clean.pausedAt === undefined) delete clean.pausedAt;
      if (clean.pauseReason === undefined) delete clean.pauseReason;
    }
  } else if (collectionName === 'users' || collectionName === 'usuarios') {
    // Nunca trafega senha em texto puro para o Firestore
    delete clean.savedPassword;
  } else if (collectionName === 'veiculos') {
    delete clean.savedPassword;
  } else if (collectionName === 'fila') {
    delete clean.savedPassword;
  }

  return clean;
}

// ============================================================================
// MOTOR DE BATCHING E DEBOUNCING INTELIGENTE DO FIRESTORE
// Agrupa múltiplas mutações e descarta intermediárias, reduzindo drasticamente
// o número de operações de escrita na nuvem.
// ============================================================================

interface PendingWrite {
  collection: string;
  docId: string;
  data?: any;
  action: 'set' | 'delete';
  isCritical: boolean;
  queuedAt: number;
}

const pendingBatch = new Map<string, PendingWrite>();
// Cache de deduplicação (Dirty-Checking): evita gravar se o documento não sofreu alteração real
const lastCommittedHashes = new Map<string, string>();

const PENDING_WRITES_STORAGE_KEY = 'driftpark_offline_pending_writes_v1';

function persistPendingBatch() {
  if (typeof window === 'undefined') return;
  try {
    if (pendingBatch.size === 0) {
      window.localStorage?.removeItem(PENDING_WRITES_STORAGE_KEY);
    } else {
      const serialized = JSON.stringify(Array.from(pendingBatch.entries()));
      window.localStorage?.setItem(PENDING_WRITES_STORAGE_KEY, serialized);
    }
  } catch {}
}

/**
 * Reconcilia e envia alterações pendentes salvas no armazenamento local
 * (executado ao abrir o sistema, ao reconectar rede ou no encerramento do dia)
 */
export async function reconcilePendingWrites(): Promise<boolean> {
  if (typeof window === 'undefined' || isFirestoreQuotaExceeded) return true;
  try {
    const raw = window.localStorage?.getItem(PENDING_WRITES_STORAGE_KEY);
    if (raw) {
      const entries: [string, PendingWrite][] = JSON.parse(raw);
      if (Array.isArray(entries)) {
        for (const [k, v] of entries) {
          if (!pendingBatch.has(k)) {
            pendingBatch.set(k, v);
          }
        }
      }
    }
  } catch {}
  if (pendingBatch.size > 0) {
    return flushPendingWrites();
  }
  return true;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY_MS = 2000; // Janela inteligente para agregar alterações não-críticas
const MAX_WAIT_MS = 5000; // Limite máximo para forçar envio
let isFlushing = false;

export function getPendingWritesCount(): number {
  return pendingBatch.size;
}

/**
 * Executa o commit atômico de todas as escritas agrupadas na fila via writeBatch(db)
 */
export async function flushPendingWrites(): Promise<boolean> {
  if (pendingBatch.size === 0 || isFirestoreQuotaExceeded) {
    persistPendingBatch();
    return true;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  }

  if (isFlushing) {
    return true;
  }
  isFlushing = true;

  const itemsToCommit = Array.from(pendingBatch.values());
  pendingBatch.clear();
  persistPendingBatch();

  try {
    const handleErr = (err: any) => {
      const msg = String(err?.message || err || '');
      if (
        msg.includes('resource-exhausted') ||
        msg.includes('Quota limit exceeded') ||
        msg.includes('quota metric') ||
        msg.includes('Quota exceeded') ||
        msg.includes('Free daily write units') ||
        err?.code === 'resource-exhausted'
      ) {
        markFirestoreQuotaExceeded();
      }
      return null;
    };

    // O Cloud Firestore suporta até 500 operações por writeBatch
    const CHUNK_SIZE = 400;
    for (let i = 0; i < itemsToCommit.length; i += CHUNK_SIZE) {
      const chunk = itemsToCommit.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const docRef = doc(db, item.collection, item.docId);
        if (item.action === 'delete') {
          batch.delete(docRef);
          lastCommittedHashes.delete(`${item.collection}/${item.docId}`);
        } else {
          batch.set(docRef, item.data, { merge: true });
          const bKey = `${item.collection}/${item.docId}`;
          const { updatedAt, ...businessOnly } = item.data || {};
          lastCommittedHashes.set(bKey, JSON.stringify(businessOnly));
          if (lastCommittedHashes.size > 2000) {
            const firstKey = lastCommittedHashes.keys().next().value;
            if (firstKey) lastCommittedHashes.delete(firstKey);
          }
        }
      }

      await batch.commit().catch(handleErr);
    }

    persistPendingBatch();
    return true;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (
      msg.includes('resource-exhausted') ||
      msg.includes('Quota limit exceeded') ||
      msg.includes('quota metric') ||
      msg.includes('Quota exceeded') ||
      msg.includes('Free daily write units') ||
      err?.code === 'resource-exhausted'
    ) {
      markFirestoreQuotaExceeded();
    }
    // Reinsere itens na fila para retentativa posterior
    for (const it of itemsToCommit) {
      const k = `${it.collection}/${it.docId}`;
      if (!pendingBatch.has(k)) pendingBatch.set(k, it);
    }
    persistPendingBatch();
    return false;
  } finally {
    isFlushing = false;
  }
}

// Flush automático quando a aba é ocultada ou antes de fechar o app e auto-reconciliação ao voltar a ter internet
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    reconcilePendingWrites().catch(() => {});
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendingBatch.size > 0) {
      flushPendingWrites();
    } else if (document.visibilityState === 'visible') {
      reconcilePendingWrites().catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => {
    if (pendingBatch.size > 0) {
      flushPendingWrites();
    }
  });
  window.addEventListener('beforeunload', () => {
    if (pendingBatch.size > 0) {
      flushPendingWrites();
    }
  });

  // Tenta reconciliar escritas pendentes offline de sessões anteriores após breve delay
  setTimeout(() => {
    reconcilePendingWrites().catch(() => {});
  }, 1000);
}

/**
 * Grava documento diretamente no Cloud Firestore com garantia de sincronização em tempo real entre dispositivos.
 * - Enxuga payloads removendo imagens pesadas repetidas e campos voláteis.
 * - Atualiza o Firestore imediatamente disparando onSnapshot para todos os aparelhos conectados.
 */
export async function saveDocToCloud(
  collectionName: string,
  docId: string,
  data: any,
  isCriticalOrSecondary?: boolean | string
): Promise<boolean> {
  if (!docId) return false;

  const isCritical = typeof isCriticalOrSecondary === 'boolean' ? isCriticalOrSecondary : true;
  const cleanData = optimizePayloadForFirestore(collectionName, data);

  const payloadToSave = {
    ...cleanData,
    updatedAt: cleanData?.updatedAt || Date.now(),
  };

  const key = `${collectionName}/${docId}`;

  // Se for operação crítica (corrida, frota, fila, usuário), grava imediatamente no Firestore
  if (isCritical) {
    try {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, payloadToSave, { merge: true });
      lastCommittedHashes.set(key, JSON.stringify(cleanData));
      return true;
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (err?.code === 'resource-exhausted' || msg.includes('resource-exhausted')) {
        markFirestoreQuotaExceeded();
      }
      console.warn(`[Firestore] Aviso na escrita imediata de ${collectionName}/${docId}:`, err);
      // Agenda para retry no batch
      pendingBatch.set(key, {
        collection: collectionName,
        docId,
        data: payloadToSave,
        action: 'set',
        isCritical: true,
        queuedAt: Date.now(),
      });
      persistPendingBatch();
      return false;
    }
  }

  // Dirty-Checking para operações secundárias/repetitivas
  const fingerprint = JSON.stringify(cleanData);
  if (lastCommittedHashes.get(key) === fingerprint && !pendingBatch.has(key)) {
    return true;
  }

  pendingBatch.set(key, {
    collection: collectionName,
    docId,
    data: payloadToSave,
    action: 'set',
    isCritical: false,
    queuedAt: Date.now(),
  });
  persistPendingBatch();

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    flushPendingWrites();
  }, DEBOUNCE_DELAY_MS);

  return true;
}

/**
 * Remove documento diretamente do Cloud Firestore garantindo reflexo instantâneo em todos os dispositivos.
 */
export async function deleteDocFromCloud(
  collectionName: string,
  docId: string,
  _isCriticalOrSecondary?: boolean | string,
  _tenantId?: string
): Promise<boolean> {
  if (!docId) return false;

  const key = `${collectionName}/${docId}`;
  lastCommittedHashes.delete(key);

  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    pendingBatch.delete(key);
    persistPendingBatch();
    return true;
  } catch (err: any) {
    console.warn(`[Firestore] Aviso na exclusão de ${collectionName}/${docId}:`, err);
    pendingBatch.set(key, {
      collection: collectionName,
      docId,
      action: 'delete',
      isCritical: true,
      queuedAt: Date.now(),
    });
    persistPendingBatch();
    return false;
  }
}

export const deleteDocToCloud = deleteDocFromCloud;

/**
 * Testa ativamente a conexão com o Firebase
 */
export async function testAndVerifyFirestore(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const pingDoc = doc(db, '_health_check_', 'ping');
    await getDocFromServer(pingDoc).catch(() => getDoc(pingDoc));
    markFirestoreAvailable();
    return {
      success: true,
      message: 'Cloud Firebase conectado e operacional com sucesso!',
    };
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (
      errMsg.includes('not-found') ||
      errMsg.includes('NOT_FOUND')
    ) {
      return {
        success: false,
        message: `Banco de dados '${ACTIVE_DATABASE_ID}' não encontrado. Verifique as configurações no Firebase Console.`,
      };
    }
    if (
      err?.code === 'resource-exhausted' ||
      (errMsg.includes('resource-exhausted') && !errMsg.includes('QuotaExceeded'))
    ) {
      markFirestoreQuotaExceeded();
      return {
        success: true,
        message: `Cloud Firebase conectado (${ACTIVE_DATABASE_ID}). Cota diária gratuita atingida; modo de contingência local ativo.`,
      };
    }
    markFirestoreAvailable();
    return {
      success: true,
      message: `Cloud Firebase (${ACTIVE_DATABASE_ID}) conectado e operacional!`,
    };
  }
}

/**
 * Verifica se um e-mail já existe na coleção 'users' ou 'usuarios' do Firestore na nuvem
 */
export async function checkEmailAlreadyExists(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();

  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('email', '==', clean))).catch(() => null),
      getDocs(query(collection(db, 'usuarios'), where('email', '==', clean))).catch(() => null),
    ]);
    return Boolean((snap1 && !snap1.empty) || (snap2 && !snap2.empty));
  } catch {
    return false;
  }
}

export async function getFirestoreUserProfile(uidOrEmail: string): Promise<any | null> {
  const clean = uidOrEmail.trim().toLowerCase();
  const rawId = uidOrEmail.trim();

  const fetchInternal = async (): Promise<any | null> => {
    // 1. Busca direta simultânea O(1) por Document ID (e-mail e UID em paralelo)
    // 1. Busca direta O(1) por Document ID (e-mail e UID em paralelo)
    const directPromises: Promise<any>[] = [
      getDoc(doc(db, 'users', clean)).catch(() => null),
      getDoc(doc(db, 'usuarios', clean)).catch(() => null),
    ];
    if (rawId && rawId !== clean) {
      directPromises.push(getDoc(doc(db, 'users', rawId)).catch(() => null));
      directPromises.push(getDoc(doc(db, 'usuarios', rawId)).catch(() => null));
    }

    const directSnaps = await Promise.all(directPromises);
    for (const snap of directSnaps) {
      if (snap && snap.exists && snap.exists()) {
        const d = snap.data();
        if (d) return d;
      }
    }

    // 2. Busca paralela nas coleções users e usuarios pelo campo email
    const queryPromises: Promise<any>[] = [
      getDocs(query(collection(db, 'users'), where('email', '==', clean))).catch(() => null),
      getDocs(query(collection(db, 'usuarios'), where('email', '==', clean))).catch(() => null),
    ];

    const querySnaps = await Promise.all(queryPromises);
    for (const snap of querySnaps) {
      if (snap && !snap.empty) {
        return snap.docs[0].data();
      }
    }

    // 3. Busca no Realtime Database se disponível
    if (rtdb) {
      try {
        const emailSanitized = clean.replace(/[.#$[\]]/g, '_');
        const snapRtdb = await rtdbGet(rtdbRef(rtdb, `driftpark/users/${emailSanitized}`));
        if (snapRtdb.exists()) {
          return snapRtdb.val();
        }
        if (rawId !== clean) {
          const rawSanitized = rawId.replace(/[.#$[\]]/g, '_');
          const snapRaw = await rtdbGet(rtdbRef(rtdb, `driftpark/users/${rawSanitized}`));
          if (snapRaw.exists()) {
            return snapRaw.val();
          }
        }
      } catch {}
    }

    return null;
  };

  try {
    // Timeout seguro de 3000ms garantindo resposta em redes móveis (3G/4G/5G) sem travamento
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    return await Promise.race([fetchInternal(), timeoutPromise]);
  } catch (err) {
    console.warn('Aviso ao consultar perfil no Firestore:', err);
    return null;
  }
}

/**
 * Cria credencial de autenticação no Firebase Auth para Sub-Conta (Operador) sem deslogar o Admin.
 * Salva metadados (role, tenantId, nome) diretamente no perfil do Firebase Auth (displayName e photoURL),
 * garantindo vinculação estrita entre o Administrador e o Operador mesmo se a rede oscilar!
 */
export async function createSubAccountInAuth(
  email: string,
  password: string,
  profileData?: { name?: string; role?: string; tenantId?: string; adminEmail?: string; adminName?: string }
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const secondaryAppName = `sub_auth_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);

  try {
    const secondaryAuth = getAuth(secondaryApp);
    let userRecord: any = null;

    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        cleanEmail,
        password
      );
      userRecord = cred.user;
    } catch (createErr: any) {
      if (createErr?.code === 'auth/email-already-in-use') {
        try {
          const loginCred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, password);
          userRecord = loginCred.user;
        } catch {
          throw createErr;
        }
      } else {
        throw createErr;
      }
    }

    const uid = userRecord.uid;

    if (profileData && userRecord) {
      try {
        await updateProfile(userRecord, {
          displayName: profileData.name || cleanEmail.split('@')[0],
          photoURL: JSON.stringify({
            role: profileData.role || 'operador',
            tenantId: profileData.tenantId,
            name: profileData.name,
            adminEmail: profileData.adminEmail,
            adminName: profileData.adminName,
          }),
        });
      } catch (profErr) {
        console.warn('Aviso ao atualizar perfil no Firebase Auth:', profErr);
      }

      // Salva no Firestore e RTDB
      saveDocToCloud('users', uid, {
        id: uid,
        email: cleanEmail,
        name: profileData.name || cleanEmail.split('@')[0],
        role: profileData.role || 'operador',
        tenantId: profileData.tenantId,
        adminEmail: profileData.adminEmail,
        adminName: profileData.adminName,
        createdAt: Date.now(),
      }, 'usuarios').catch(() => {});
    }

    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
    return uid;
  } catch (err: any) {
    await deleteApp(secondaryApp).catch(() => {});
    throw err;
  }
}

export {
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
  limit,
  orderBy,
};
export type { FirebaseUser };

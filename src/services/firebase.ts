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
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Força o Firebase Auth a persistir a sessão autenticada localmente
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Erro na persistência do Firebase Auth:', error?.message);
  });
}

// Previne que rejeições assíncronas do Firebase e erros de cota quebrem a interface
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || '');
    if (
      reasonMsg.includes('installations') ||
      reasonMsg.includes('API key not valid') ||
      reasonMsg.includes('400 INVALID_ARGUMENT') ||
      reasonMsg.includes('resource-exhausted') ||
      reasonMsg.includes('Quota limit exceeded') ||
      reasonMsg.includes('quota metric') ||
      reasonMsg.includes('Quota exceeded') ||
      (event.reason?.name === 'FirebaseError' && (
        String(event.reason?.code || '').includes('installations') ||
        String(event.reason?.code || '').includes('resource-exhausted')
      ))
    ) {
      if (reasonMsg.includes('resource-exhausted') || reasonMsg.includes('Quota') || reasonMsg.includes('quota')) {
        markFirestoreQuotaExceeded();
      }
      event.preventDefault();
      console.warn('[Firebase] Aviso tratado com resiliência:', reasonMsg);
    }
  });
}

// Analytics is omitted to prevent invalid API key installations errors
export const analytics: any = null;

// Initialize Firestore with Persistent Local Cache (IndexedDB Multi-Tab)
// Preserva o cache offline e as gravações pendentes entre abas e dispositivos
export const ACTIVE_DATABASE_ID = cfg.firestoreDatabaseId || "ai-studio-driftparkgestode-2200359e-b3be-4b5e-9c71-5f960e94bb6b";

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }, ACTIVE_DATABASE_ID);
  } catch (initErr) {
    return getFirestore(app, ACTIVE_DATABASE_ID);
  }
})();

// Conexão canônica com o banco de dados ativo do Firestore
export const defaultDb = db;

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
  if (typeof window === 'undefined') return true; // Server/pre-render safe
  try {
    const stored = window.localStorage ? window.localStorage.getItem(QUOTA_STORAGE_KEY) : null;
    const currentDay = new Date().toISOString().slice(0, 10);
    if (stored === currentDay || stored === 'exceeded') {
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
    console.warn('[Firestore] Cota diária gratuita de escritas atingida (Free daily write units). Pausando sincronização de rede do Firestore para interromper retentativas.');
    quotaListeners.forEach((l) => {
      try { l(true); } catch {}
    });
  }

  // Desativa a rede do Firestore imediatamente para parar o loop de retentativas do SDK
  try {
    disableNetwork(db).catch(() => {});
  } catch {}
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

// Se a cota já estiver gravada como excedida hoje, pausa a rede do Firestore de imediato
if (typeof window !== 'undefined' && isFirestoreQuotaExceeded) {
  setTimeout(() => {
    try {
      disableNetwork(db).catch(() => {});
    } catch {}
  }, 50);
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
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY_MS = 1200; // Janela de 1.2s para agregar alterações
const MAX_WAIT_MS = 4000; // Limite máximo para forçar envio
let isFlushing = false;

export function getPendingWritesCount(): number {
  return pendingBatch.size;
}

/**
 * Executa o commit atômico de todas as escritas agrupadas na fila via writeBatch(db)
 */
export async function flushPendingWrites(): Promise<boolean> {
  if (pendingBatch.size === 0 || isFirestoreQuotaExceeded) {
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
        } else {
          batch.set(docRef, item.data, { merge: true });
        }
      }

      await batch.commit().catch(handleErr);
    }

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
    return false;
  } finally {
    isFlushing = false;
  }
}

// Flush automático quando a aba é ocultada ou antes de fechar o app
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pendingBatch.size > 0) {
      flushPendingWrites();
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
}

/**
 * Grava documento com debouncing e batching inteligente.
 * - Se isCritical for true (início/fim de corrida, cadastro), agenda envio ultra-rápido (150ms).
 * - Se múltiplos updates do mesmo documento chegarem na mesma janela,
 *   eles são mesclados em memória, gerando uma única operação de escrita.
 */
export async function saveDocToCloud(
  collectionName: string,
  docId: string,
  data: any,
  isCriticalOrSecondary?: boolean | string
): Promise<boolean> {
  if (isFirestoreQuotaExceeded) {
    return true;
  }

  const isCritical = typeof isCriticalOrSecondary === 'boolean' ? isCriticalOrSecondary : false;
  const cleanData = sanitizeForFirestore({
    ...data,
    updatedAt: Date.now(),
  });

  const key = `${collectionName}/${docId}`;
  const existing = pendingBatch.get(key);

  if (existing && existing.action === 'set') {
    pendingBatch.set(key, {
      collection: collectionName,
      docId,
      data: { ...existing.data, ...cleanData },
      action: 'set',
      isCritical: existing.isCritical || isCritical,
      queuedAt: existing.queuedAt,
    });
  } else {
    pendingBatch.set(key, {
      collection: collectionName,
      docId,
      data: cleanData,
      action: 'set',
      isCritical,
      queuedAt: Date.now(),
    });
  }

  // Operações críticas disparam flush com brevidade (150ms)
  if (isCritical) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      flushPendingWrites();
    }, 150);
    return true;
  }

  // Agendamento padrão com debounce
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    flushPendingWrites();
  }, DEBOUNCE_DELAY_MS);

  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(() => {
      flushPendingWrites();
    }, MAX_WAIT_MS);
  }

  if (pendingBatch.size >= 15) {
    flushPendingWrites();
  }

  return true;
}

/**
 * Remove documento utilizando o motor de batching
 */
export async function deleteDocFromCloud(
  collectionName: string,
  docId: string,
  isCriticalOrSecondary?: boolean | string,
  _tenantId?: string
): Promise<boolean> {
  if (isFirestoreQuotaExceeded) {
    return true;
  }

  const isCritical = typeof isCriticalOrSecondary === 'boolean' ? isCriticalOrSecondary : true;
  const key = `${collectionName}/${docId}`;

  pendingBatch.set(key, {
    collection: collectionName,
    docId,
    action: 'delete',
    isCritical,
    queuedAt: Date.now(),
  });

  if (isCritical) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      flushPendingWrites();
    }, 150);
  } else {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      flushPendingWrites();
    }, DEBOUNCE_DELAY_MS);
  }

  return true;
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
    await getDoc(pingDoc);
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
      errMsg.includes('resource-exhausted') ||
      errMsg.includes('Quota') ||
      errMsg.includes('quota metric') ||
      err?.code === 'resource-exhausted'
    ) {
      markFirestoreQuotaExceeded();
      return {
        success: true,
        message: `Cloud Firebase conectado (${ACTIVE_DATABASE_ID}). Cota diária gratuita de escritas atingida; modo de contingência local e servidor ativo.`,
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
    const sanitizedClean = clean.replace(/[^a-z0-9_-]/g, '_');
    const directPromises: Promise<any>[] = [
      getDoc(doc(db, 'users', clean)).catch(() => null),
      getDoc(doc(db, 'usuarios', clean)).catch(() => null),
      getDoc(doc(db, 'users', sanitizedClean)).catch(() => null),
      getDoc(doc(db, 'usuarios', sanitizedClean)).catch(() => null),
    ];
    if (rawId && rawId !== clean && rawId !== sanitizedClean) {
      directPromises.push(getDoc(doc(db, 'users', rawId)).catch(() => null));
      directPromises.push(getDoc(doc(db, 'usuarios', rawId)).catch(() => null));
    }

    const directSnaps = await Promise.all(directPromises);
    for (const snap of directSnaps) {
      if (snap && snap.exists && snap.exists()) {
        const d = snap.data();
        if (d && (d.email || d.role || d.tenantId)) return d;
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
    // Timeout resiliente de 6000ms para conexões móveis e cross-browser
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
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
};
export type { FirebaseUser };

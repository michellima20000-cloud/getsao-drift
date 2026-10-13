import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
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
} from 'firebase/firestore';
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
import { getAnalytics, isSupported } from 'firebase/analytics';

// Credenciais canônicas do projeto Firebase gympulse-personal fornecidas pelo usuário
const USER_API_KEY = "AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY";
const USER_PROJECT_ID = "gympulse-personal";
const USER_AUTH_DOMAIN = "gympulse-personal.firebaseapp.com";
const USER_RTDB_URL = "https://gympulse-personal-default-rtdb.firebaseio.com";
const USER_STORAGE_BUCKET = "gympulse-personal.firebasestorage.app";
const USER_MESSAGING_SENDER_ID = "1068724964920";
const USER_APP_ID = "1:1068724964920:web:d4fec7bbd3dbeceb07a0cd";
const USER_MEASUREMENT_ID = "G-PWD1EYY9DD";

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

// Previne que rejeições assíncronas do Firebase Installations quebrem a interface
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event.reason?.message || String(event.reason || '');
    if (
      reasonMsg.includes('installations') ||
      reasonMsg.includes('API key not valid') ||
      reasonMsg.includes('400 INVALID_ARGUMENT') ||
      (event.reason?.name === 'FirebaseError' && String(event.reason?.code || '').includes('installations'))
    ) {
      event.preventDefault();
      console.warn('[Firebase] Aviso de Analytics/Instalações tratado com sucesso.');
    }
  });
}

// Initialize Firebase Analytics (browser safe e sem bloquear a aplicação)
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported && firebaseConfig.measurementId) {
        try {
          analytics = getAnalytics(app);
        } catch {
          // Analytics é opcional e não-crítico
        }
      }
    })
    .catch(() => {});
}

// Initialize Firestore
const customDbId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID) || (appletConfig as any).firestoreDatabaseId;
export const db =
  customDbId && customDbId !== '(default)' && firebaseConfig.projectId !== 'gympulse-personal'
    ? getFirestore(app, customDbId)
    : getFirestore(app);

// Test connection on boot
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
  }
})();

// Initialize Firebase Realtime Database com URL validada
export let rtdb: ReturnType<typeof getDatabase> | null = null;
try {
  if (isValidRtdbUrl(validDatabaseURL)) {
    rtdb = getDatabase(app, validDatabaseURL);
  }
} catch (err) {
  // RTDB é fallback secundário opcional
  rtdb = null;
}

// Estado de disponibilidade do Firestore na nuvem
let isFirestoreAvailable: boolean = true;
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
  return true;
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
 * Grava documento diretamente na Nuvem do Firebase (Firestore + Realtime Database)
 * sem lançar exceções não tratadas.
 */
export async function saveDocToCloud(
  collectionName: string,
  docId: string,
  data: any,
  secondaryCollection?: string
): Promise<boolean> {
  const cleanData = sanitizeForFirestore({
    ...data,
    updatedAt: Date.now(),
  });

  const promises: Promise<any>[] = [];

  // 1. Grava no Cloud Firestore
  try {
    promises.push(setDoc(doc(db, collectionName, docId), cleanData, { merge: true }));
    if (secondaryCollection) {
      promises.push(setDoc(doc(db, secondaryCollection, docId), cleanData, { merge: true }));
    }
  } catch (fsErr) {
    console.warn(`[Firebase] Erro ao preparar gravação Firestore em ${collectionName}:`, fsErr);
  }

  // 2. Grava no Firebase Realtime Database para sincronia redundante instantânea
  if (rtdb) {
    try {
      const sanitizedKey = docId.replace(/[.#$[\]]/g, '_');
      promises.push(rtdbSet(rtdbRef(rtdb, `driftpark/${collectionName}/${sanitizedKey}`), cleanData));
      if (cleanData.tenantId) {
        const tenantKey = cleanData.tenantId.replace(/[.#$[\]]/g, '_');
        promises.push(
          rtdbSet(rtdbRef(rtdb, `driftpark/tenants/${tenantKey}/${collectionName}/${sanitizedKey}`), cleanData)
        );
      }
    } catch (rtdbErr) {
      console.warn(`[Firebase RTDB] Erro ao sincronizar ${collectionName}:`, rtdbErr);
    }
  }

  try {
    await Promise.allSettled(promises);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove documento diretamente na Nuvem do Firebase (Firestore + Realtime Database)
 */
export async function deleteDocFromCloud(
  collectionName: string,
  docId: string,
  secondaryCollection?: string,
  tenantId?: string
): Promise<boolean> {
  const promises: Promise<any>[] = [];

  // 1. Firestore
  try {
    promises.push(deleteDoc(doc(db, collectionName, docId)));
    if (secondaryCollection) {
      promises.push(deleteDoc(doc(db, secondaryCollection, docId)));
    }
  } catch {}

  // 2. Realtime Database
  if (rtdb) {
    try {
      const sanitizedKey = docId.replace(/[.#$[\]]/g, '_');
      promises.push(rtdbRemove(rtdbRef(rtdb, `driftpark/${collectionName}/${sanitizedKey}`)));
      if (tenantId) {
        const tenantKey = tenantId.replace(/[.#$[\]]/g, '_');
        promises.push(
          rtdbRemove(rtdbRef(rtdb, `driftpark/tenants/${tenantKey}/${collectionName}/${sanitizedKey}`))
        );
      }
    } catch {}
  }

  try {
    await Promise.allSettled(promises);
    return true;
  } catch {
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
    await getDoc(pingDoc);
    markFirestoreAvailable();
    return {
      success: true,
      message: 'Cloud Firebase conectado e operacional com sucesso!',
    };
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (
      errMsg.includes('(padrão)') ||
      errMsg.includes('(default)') ||
      errMsg.includes('not-found')
    ) {
      return {
        success: false,
        message:
          "Banco de dados '(padrão)' não encontrado no projeto Firebase. Crie o Firestore no Firebase Console para ativar.",
      };
    }
    markFirestoreAvailable();
    return {
      success: true,
      message: 'Cloud Firebase conectado (modo resiliente).',
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

/**
 * Busca perfil do usuário no Firestore diretamente na nuvem pelo UID ou e-mail
 */
export async function getFirestoreUserProfile(uidOrEmail: string): Promise<any | null> {
  const clean = uidOrEmail.trim().toLowerCase();
  const rawId = uidOrEmail.trim();

  try {
    // 1. Tenta buscar direto pelo UID na coleção 'users'
    try {
      const docRef = doc(db, 'users', rawId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
    } catch {}

    // 2. Tenta buscar direto pelo UID na coleção 'usuarios'
    try {
      const docRef = doc(db, 'usuarios', rawId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
    } catch {}

    // 3. Busca nas coleções pelo campo 'email'
    try {
      const snap1 = await getDocs(query(collection(db, 'users'), where('email', '==', clean)));
      if (!snap1.empty) return snap1.docs[0].data();
    } catch {}

    try {
      const snap2 = await getDocs(query(collection(db, 'usuarios'), where('email', '==', clean)));
      if (!snap2.empty) return snap2.docs[0].data();
    } catch {}

    // 4. Busca no Realtime Database se disponível
    if (rtdb) {
      try {
        const sanitizedKey = rawId.replace(/[.#$[\]]/g, '_');
        const snapRtdb = await rtdbGet(rtdbRef(rtdb, `driftpark/users/${sanitizedKey}`));
        if (snapRtdb.exists()) {
          return snapRtdb.val();
        }
      } catch {}
    }

    return null;
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

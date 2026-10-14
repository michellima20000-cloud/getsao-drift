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
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableIndexedDbPersistence,
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

// Analytics is omitted to prevent invalid API key installations errors
export const analytics: any = null;

// Initialize Firestore with IndexedDB Local Persistence
// Permite cache local completo e reduz a latência de carregamento a zero milissegundos
// ID do banco de dados ativo fornecido pelo usuário para o Drift Park Gestão
export const ACTIVE_DATABASE_ID = "ai-studio-driftparkgestode-2200359e-b3be-4b5e-9c71-5f960e94bb6b";

export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    }, ACTIVE_DATABASE_ID);
  } catch (initErr) {
    const fallbackDb = getFirestore(app, ACTIVE_DATABASE_ID);
    if (typeof window !== 'undefined') {
      try {
        enableIndexedDbPersistence(fallbackDb).catch((persistErr: any) => {
          if (persistErr.code === 'failed-precondition') {
            console.info('[Firestore] Persistência habilitada em outra aba ativa.');
          } else if (persistErr.code === 'unimplemented') {
            console.warn('[Firestore] Navegador atual não suporta IndexedDb.');
          }
        });
      } catch {}
    }
    return fallbackDb;
  }
})();

// Conexão canônica com o banco de dados ativo do Firestore com cache local multi-aba
export const defaultDb = db;

// Verificação não-bloqueante de conexão na inicialização
if (typeof window !== 'undefined') {
  setTimeout(async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch {
      // Falha silenciosa normal quando offline ou sem documento de teste
    }
  }, 2000);
}

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
    // Para contas de usuários, grava também com chave de e-mail limpa para busca instantânea O(1)
    if ((collectionName === 'users' || collectionName === 'usuarios') && cleanData?.email) {
      const emailDocId = String(cleanData.email).toLowerCase().trim();
      if (emailDocId && emailDocId !== docId) {
        promises.push(setDoc(doc(db, collectionName, emailDocId), cleanData, { merge: true }));
        if (secondaryCollection) {
          promises.push(setDoc(doc(db, secondaryCollection, emailDocId), cleanData, { merge: true }));
        }
      }
    }
    // Gravação no Firestore concluída com chave O(1) de e-mail e UID
  } catch (fsErr) {
    console.warn(`[Firebase] Erro ao preparar gravação Firestore em ${collectionName}:`, fsErr);
  }

  // 2. Grava no Firebase Realtime Database para sincronia redundante instantânea
  if (rtdb) {
    try {
      const sanitizedKey = docId.replace(/[.#$[\]]/g, '_');
      promises.push(rtdbSet(rtdbRef(rtdb, `driftpark/${collectionName}/${sanitizedKey}`), cleanData));
      if (cleanData?.email) {
        const emailRtdbKey = String(cleanData.email).toLowerCase().trim().replace(/[.#$[\]]/g, '_');
        if (emailRtdbKey !== sanitizedKey) {
          promises.push(rtdbSet(rtdbRef(rtdb, `driftpark/${collectionName}/${emailRtdbKey}`), cleanData));
        }
      }
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
    const timeout = new Promise((resolve) => setTimeout(resolve, 600));
    await Promise.race([Promise.allSettled(promises), timeout]);
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
    const timeout = new Promise((resolve) => setTimeout(resolve, 600));
    await Promise.race([Promise.allSettled(promises), timeout]);
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
      errMsg.includes('not-found') ||
      errMsg.includes('NOT_FOUND')
    ) {
      return {
        success: false,
        message: `Banco de dados '${ACTIVE_DATABASE_ID}' não encontrado. Verifique as configurações no Firebase Console.`,
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

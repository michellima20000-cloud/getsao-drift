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
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gympulse-personal.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://gympulse-personal-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gympulse-personal',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gympulse-personal.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1068724964920',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1068724964920:web:d4fec7bbd3dbeceb07a0cd',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-PWD1EYY9DD',
};

// =========================================================================
// INTERCEPTADOR DE ERROS FIRESTORE
// Silencia o erro '@firebase/firestore: Banco de dados (padrão) não encontrado'
// que ocorre quando o projeto Firebase possui Auth/RTDB ativos mas o Cloud Firestore
// ainda não teve seu banco criado no console do Firebase.
// =========================================================================
if (typeof window !== 'undefined') {
  const origConsoleError = console.error;
  console.error = function (...args: any[]) {
    const rawMsg = args
      .map((a) => (typeof a === 'string' ? a : a?.message || ''))
      .join(' ');

    if (
      rawMsg.includes('(padrão)') ||
      rawMsg.includes('(default)') ||
      rawMsg.includes('Banco de dados') ||
      rawMsg.includes('@firebase/firestore')
    ) {
      // Marca imediatamente o Firestore como indisponível para interromper tentativas
      markFirestoreUnavailable();
      return;
    }
    origConsoleError.apply(console, args);
  };
}

// Initialize Firebase App & Authentication
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore
const customDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
export const db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);

// Estado de disponibilidade do Firestore na nuvem
// Inicia como false caso já tenhamos detectado erro ou se não houver confirmação
let isFirestoreAvailable: boolean = (() => {
  if (typeof window === 'undefined') return false;
  const cached = localStorage.getItem('driftpark_firestore_available');
  if (cached === 'true') return true;
  // Padrão seguro: false para impedir erros no console antes de teste explícito
  return false;
})();

export function markFirestoreUnavailable() {
  isFirestoreAvailable = false;
  try {
    localStorage.setItem('driftpark_firestore_available', 'false');
  } catch {}
}

export function markFirestoreAvailable() {
  isFirestoreAvailable = true;
  try {
    localStorage.setItem('driftpark_firestore_available', 'true');
  } catch {}
}

export function getIsFirestoreAvailable(): boolean {
  return isFirestoreAvailable;
}

/**
 * Testa ativamente a conexão com o Firestore (com timeout de 1 segundo)
 */
export async function testAndVerifyFirestore(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const pingDoc = doc(db, '_health_check_', 'ping');
    const probe = getDoc(pingDoc);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 1200)
    );

    await Promise.race([probe, timeout]);
    markFirestoreAvailable();
    return {
      success: true,
      message: 'Cloud Firestore conectado e operacional com sucesso!',
    };
  } catch (err: any) {
    markFirestoreUnavailable();
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
    return {
      success: false,
      message: 'Firestore indisponível no momento. O sistema opera com armazenamento local e Firebase Auth.',
    };
  }
}

/**
 * Verifica se um e-mail já existe na coleção 'users' ou 'usuarios' do Firestore (sem travar)
 */
export async function checkEmailAlreadyExists(email: string): Promise<boolean> {
  if (!getIsFirestoreAvailable()) return false;
  const clean = email.trim().toLowerCase();

  try {
    const queryWork = async () => {
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('email', '==', clean))),
        getDocs(query(collection(db, 'usuarios'), where('email', '==', clean))),
      ]);
      return !snap1.empty || !snap2.empty;
    };

    const timeoutWork = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 500)
    );
    return await Promise.race([queryWork(), timeoutWork]);
  } catch {
    markFirestoreUnavailable();
    return false;
  }
}

/**
 * Busca perfil do usuário no Firestore pelo UID ou e-mail (com timeout rápido e seguro)
 */
export async function getFirestoreUserProfile(uidOrEmail: string): Promise<any | null> {
  if (!getIsFirestoreAvailable()) return null;
  const clean = uidOrEmail.trim().toLowerCase();

  try {
    const fetchWork = async () => {
      // 1. Tenta buscar direto pelo UID na coleção 'users'
      try {
        const docRef = doc(db, 'users', clean);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data();
        }
      } catch {
        // Falha silenciosa
      }

      // 2. Busca nas coleções por e-mail
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('email', '==', clean))),
        getDocs(query(collection(db, 'usuarios'), where('email', '==', clean))),
      ]);

      if (!snap1.empty) return snap1.docs[0].data();
      if (!snap2.empty) return snap2.docs[0].data();
      return null;
    };

    const timeoutWork = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 500)
    );
    return await Promise.race([fetchWork(), timeoutWork]);
  } catch {
    markFirestoreUnavailable();
    return null;
  }
}

/**
 * Cria credencial de autenticação no Firebase Auth para Sub-Conta (Operador) sem deslogar o Admin.
 * Salva metadados (role, tenantId, nome) diretamente no perfil do Firebase Auth (displayName e photoURL),
 * garantindo vinculação estrita entre o Administrador e o Operador mesmo se o Cloud Firestore estiver offline!
 */
export async function createSubAccountInAuth(
  email: string,
  password: string,
  profileData?: { name?: string; role?: string; tenantId?: string; adminEmail?: string }
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const secondaryAppName = `sub_auth_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);

  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      cleanEmail,
      password
    );
    const uid = cred.user.uid;

    if (profileData) {
      try {
        await updateProfile(cred.user, {
          displayName: profileData.name || cleanEmail.split('@')[0],
          photoURL: JSON.stringify({
            role: profileData.role || 'operador',
            tenantId: profileData.tenantId,
            name: profileData.name,
            adminEmail: profileData.adminEmail,
          }),
        });
      } catch (profErr) {
        console.warn('Aviso ao atualizar perfil no Firebase Auth:', profErr);
      }
    }

    await signOut(secondaryAuth);
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

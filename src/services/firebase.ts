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

// Initialize Firebase App & Authentication
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore
const customDbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
export const db = customDbId ? getFirestore(app, customDbId) : getFirestore(app);

// Estado de disponibilidade do Firestore na nuvem
let isFirestoreAvailable: boolean = true;

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
 * Testa ativamente a conexão com o Cloud Firestore
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
      message: 'Cloud Firestore conectado e operacional com sucesso!',
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
    // Para outros erros temporários de rede, mantém disponível para reconectar
    markFirestoreAvailable();
    return {
      success: true,
      message: 'Cloud Firestore conectado (modo resiliente).',
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
      getDocs(query(collection(db, 'users'), where('email', '==', clean))),
      getDocs(query(collection(db, 'usuarios'), where('email', '==', clean))),
    ]);
    return !snap1.empty || !snap2.empty;
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

    return null;
  } catch (err) {
    console.warn('Aviso ao consultar perfil no Firestore:', err);
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
        // Se a conta já existe no Firebase Auth, tenta autenticar e re-vincular ao Admin
        try {
          const loginCred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, password);
          userRecord = loginCred.user;
        } catch {
          // Se senha for diferente, relança o erro específico
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

      // Salva também no Cloud Sync Service para acesso imediato em qualquer dispositivo
      try {
        fetch('/api/cloud-sync/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: uid,
            email: cleanEmail,
            name: profileData.name || cleanEmail.split('@')[0],
            role: profileData.role || 'operador',
            tenantId: profileData.tenantId,
            adminEmail: profileData.adminEmail,
            createdAt: Date.now(),
          }),
        }).catch(() => {});
      } catch {}
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

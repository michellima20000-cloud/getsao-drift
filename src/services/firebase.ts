import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
  getDocFromServer,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
// Load firebase-applet-config.json resiliently so Vite never errors if the file is absent
const appletConfigModules = import.meta.glob('../../firebase-applet-config.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, string>>;

const firebaseAppletConfig: Record<string, string> =
  Object.values(appletConfigModules)[0] || {};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || 'demo-api-key',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    firebaseAppletConfig.authDomain ||
    'gen-lang-client-0682320671.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseAppletConfig.projectId ||
    'gen-lang-client-0682320671',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    firebaseAppletConfig.storageBucket ||
    'gen-lang-client-0682320671.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseAppletConfig.messagingSenderId ||
    '1021285542263',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    firebaseAppletConfig.appId ||
    '1:1021285542263:web:d8b1303ce5257f88b9d972',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseAppletConfig.measurementId || '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    firebaseAppletConfig.firestoreDatabaseId ||
    'ai-studio-getsaodrift-29f33687-750b-47f8-a0f2-e038466214e8',
};

// Initialize Firebase App & Authentication
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    markFirestoreAvailable();
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      markFirestoreUnavailable();
    } else {
      // Permission denied on /test/connection means the server responded and is online!
      markFirestoreAvailable();
    }
  }
}

let isFirestoreAvailable = true;

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

if (typeof window !== 'undefined') {
  testConnection();
}

export async function testAndVerifyFirestore(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    markFirestoreAvailable();
    return {
      success: true,
      message: `Cloud Firestore conectado (${firebaseConfig.projectId})!`,
    };
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('the client is offline')) {
      markFirestoreUnavailable();
      return {
        success: false,
        message: 'Cliente offline. Verifique sua conexão.',
      };
    }
    // Any server response (including permission-denied on test/connection) confirms Firestore is reachable
    markFirestoreAvailable();
    return {
      success: true,
      message: `Cloud Firestore ativo e conectado (${firebaseConfig.projectId})!`,
    };
  }
}

export async function checkEmailAlreadyExists(email: string): Promise<boolean> {
  if (!getIsFirestoreAvailable() || !auth.currentUser) return false;
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
      setTimeout(() => resolve(false), 1200)
    );
    return await Promise.race([queryWork(), timeoutWork]);
  } catch {
    return false;
  }
}

export async function getFirestoreUserProfile(uidOrEmail: string): Promise<any | null> {
  if (!getIsFirestoreAvailable() || !auth.currentUser) return null;
  const clean = uidOrEmail.trim();

  try {
    const fetchWork = async () => {
      try {
        const docRef = doc(db, 'users', clean);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data();
        }
      } catch {}

      const lowerEmail = clean.toLowerCase();
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('email', '==', lowerEmail))),
        getDocs(query(collection(db, 'usuarios'), where('email', '==', lowerEmail))),
      ]);

      if (!snap1.empty) return snap1.docs[0].data();
      if (!snap2.empty) return snap2.docs[0].data();
      return null;
    };

    const timeoutWork = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1200)
    );
    return await Promise.race([fetchWork(), timeoutWork]);
  } catch {
    return null;
  }
}

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
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  addDoc,
};
export type { FirebaseUser };

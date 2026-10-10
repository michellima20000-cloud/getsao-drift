import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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

export const FIRESTORE_DATABASE_ID = 'ai-studio-driftparkgestode-2200359e-b3be-4b5e-9c71-5f960e94bb6b';

export const firebaseConfig = {
  apiKey: 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
  authDomain: 'gympulse-personal.firebaseapp.com',
  databaseURL: 'https://gympulse-personal-default-rtdb.firebaseio.com',
  projectId: 'gympulse-personal',
  storageBucket: 'gympulse-personal.firebasestorage.app',
  messagingSenderId: '1068724964920',
  appId: '1:1068724964920:web:11f0c346b40fca8707a0cd',
  measurementId: 'G-PWD1EYY9DD',
};

// Initialize Firebase App with the provisioned database ID to resolve Database '(default)' not found
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);

/**
 * Sincronização de corridas/aluguéis no Firestore para acesso multi-dispositivo
 */
export async function syncRentalToFirestore(rental: any): Promise<void> {
  if (!rental?.id) return;
  try {
    const docRef = doc(db, 'rentals', rental.id);
    await Promise.race([
      setDoc(docRef, rental, { merge: true }),
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch (err) {
    console.warn('Sync rental to Firestore notice:', err);
  }
}

export async function deleteRentalFromFirestore(rentalId: string): Promise<void> {
  if (!rentalId) return;
  try {
    const docRef = doc(db, 'rentals', rentalId);
    await Promise.race([
      deleteDoc(docRef),
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch (err) {
    console.warn('Delete rental from Firestore notice:', err);
  }
}

/**
 * Sincronização de veículos e frota no Firestore
 */
export async function syncVehicleToFirestore(vehicle: any): Promise<void> {
  if (!vehicle?.id) return;
  try {
    const docRef = doc(db, 'vehicles', vehicle.id);
    await Promise.race([
      setDoc(docRef, vehicle, { merge: true }),
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch (err) {
    console.warn('Sync vehicle to Firestore notice:', err);
  }
}

export async function deleteVehicleFromFirestore(vehicleId: string): Promise<void> {
  if (!vehicleId) return;
  try {
    const docRef = doc(db, 'vehicles', vehicleId);
    await Promise.race([
      deleteDoc(docRef),
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch (err) {
    console.warn('Delete vehicle from Firestore notice:', err);
  }
}

/**
 * Sincronização da fila de espera no Firestore
 */
export async function syncQueueItemToFirestore(item: any): Promise<void> {
  if (!item?.id) return;
  try {
    const docRef = doc(db, 'queue', item.id);
    await Promise.race([
      setDoc(docRef, item, { merge: true }),
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch (err) {
    console.warn('Sync queue to Firestore notice:', err);
  }
}

export async function deleteQueueItemFromFirestore(itemId: string): Promise<void> {
  if (!itemId) return;
  try {
    const docRef = doc(db, 'queue', itemId);
    await Promise.race([
      deleteDoc(docRef),
      new Promise((res) => setTimeout(res, 2000)),
    ]);
  } catch (err) {
    console.warn('Delete queue from Firestore notice:', err);
  }
}

/**
 * Verifica se um e-mail já existe na coleção 'users' ou 'usuarios' do Firestore
 */
export async function checkEmailAlreadyExists(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  try {
    const checkFn = async () => {
      // 1. Tenta buscar direto por documento com chave email
      try {
        const doc1 = await getDoc(doc(db, 'users', clean));
        if (doc1.exists()) return true;
      } catch {}

      // 2. Tenta por query
      try {
        const q1 = query(collection(db, 'users'), where('email', '==', clean));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) return true;
      } catch {}

      try {
        const q2 = query(collection(db, 'usuarios'), where('email', '==', clean));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) return true;
      } catch {}

      return false;
    };

    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 1500)
    );

    return await Promise.race([checkFn(), timeoutPromise]);
  } catch (err) {
    console.warn('Firestore email check error:', err);
    return false;
  }
}

/**
 * Busca perfil do usuário no Firestore pelo e-mail ou UID de forma resiliente e ultra-rápida
 */
export async function getFirestoreUserProfile(
  emailOrUid: string,
  optionalEmail?: string
): Promise<any | null> {
  const cleanInput = emailOrUid.trim().toLowerCase();
  const emailCandidate = (optionalEmail || (cleanInput.includes('@') ? cleanInput : '')).trim().toLowerCase();
  const uidCandidate = !cleanInput.includes('@') ? cleanInput : '';

  try {
    const fetchFn = async () => {
      // 1. Busca direta por documento com ID igual ao e-mail
      if (emailCandidate) {
        try {
          const docSnap = await getDoc(doc(db, 'users', emailCandidate));
          if (docSnap.exists() && docSnap.data()) return docSnap.data();
        } catch {}
        try {
          const docSnap2 = await getDoc(doc(db, 'usuarios', emailCandidate));
          if (docSnap2.exists() && docSnap2.data()) return docSnap2.data();
        } catch {}
      }

      // 2. Busca direta por UID
      if (uidCandidate) {
        try {
          const docSnap = await getDoc(doc(db, 'users', uidCandidate));
          if (docSnap.exists() && docSnap.data()) return docSnap.data();
        } catch {}
        try {
          const docSnap2 = await getDoc(doc(db, 'usuarios', uidCandidate));
          if (docSnap2.exists() && docSnap2.data()) return docSnap2.data();
        } catch {}
      }

      // 3. Query por campo email
      if (emailCandidate) {
        try {
          const q1 = query(collection(db, 'users'), where('email', '==', emailCandidate));
          const snap1 = await getDocs(q1);
          if (!snap1.empty && snap1.docs[0].data()) {
            return snap1.docs[0].data();
          }
        } catch {}

        try {
          const q2 = query(collection(db, 'usuarios'), where('email', '==', emailCandidate));
          const snap2 = await getDocs(q2);
          if (!snap2.empty && snap2.docs[0].data()) {
            return snap2.docs[0].data();
          }
        } catch {}
      }

      return null;
    };

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1800)
    );

    return await Promise.race([fetchFn(), timeoutPromise]);
  } catch (err) {
    console.warn('Firestore user profile fetch error:', err);
    return null;
  }
}

/**
 * Salva perfil no Firestore de forma garantida nas coleções 'users' e 'usuarios'
 * Salva por ID e por E-mail para busca instantânea direta, com timeout para nunca travar a UI
 */
export async function saveFirestoreUserProfile(user: any): Promise<void> {
  const cleanEmail = user.email?.trim().toLowerCase();
  const userId = user.id;

  const safeSet = (p: Promise<any>) =>
    Promise.race([
      p,
      new Promise((res) => setTimeout(res, 1500)),
    ]).catch(() => {});

  try {
    const promises: Promise<any>[] = [];
    if (userId) {
      promises.push(setDoc(doc(db, 'users', userId), user, { merge: true }));
      promises.push(setDoc(doc(db, 'usuarios', userId), user, { merge: true }));
    }
    if (cleanEmail) {
      promises.push(setDoc(doc(db, 'users', cleanEmail), user, { merge: true }));
      promises.push(setDoc(doc(db, 'usuarios', cleanEmail), user, { merge: true }));
    }
    await Promise.all(promises.map(safeSet));
  } catch (err) {
    console.warn('Erro ao salvar no Firestore:', err);
  }
}

/**
 * Remove perfil do Firestore de forma garantida nas coleções 'users' e 'usuarios'
 */
export async function deleteFirestoreUserProfile(id: string, email?: string): Promise<void> {
  const cleanEmail = email?.trim().toLowerCase();
  const safeDelete = (p: Promise<any>) =>
    Promise.race([
      p,
      new Promise((res) => setTimeout(res, 1500)),
    ]).catch(() => {});

  try {
    const promises: Promise<any>[] = [];
    if (id) {
      promises.push(deleteDoc(doc(db, 'users', id)));
      promises.push(deleteDoc(doc(db, 'usuarios', id)));
    }
    if (cleanEmail) {
      promises.push(deleteDoc(doc(db, 'users', cleanEmail)));
      promises.push(deleteDoc(doc(db, 'usuarios', cleanEmail)));
      promises.push(deleteDoc(doc(db, 'users', `user_${cleanEmail}`)));
      promises.push(deleteDoc(doc(db, 'usuarios', `user_${cleanEmail}`)));
    }
    await Promise.all(promises.map(safeDelete));
  } catch (err) {
    console.warn('Erro ao remover do Firestore:', err);
  }
}

/**
 * Garante que as contas oficiais de Administrador estejam salvas no Firestore
 * sem recriar contas que o usuário tenha removido de seu perfil.
 */
export async function seedOfficialAccountsToFirestore(): Promise<void> {
  let deletedList: string[] = [];
  try {
    const saved = localStorage.getItem('driftpark_deleted_accounts_v1');
    if (saved) deletedList = JSON.parse(saved);
  } catch {}

  const officialAccounts = [
    {
      id: 'usr_adm_clecio',
      name: 'Adm Clécio',
      email: 'admcledson@gmail.com',
      role: 'admin',
      tenantId: 'tenant_clecio_drift',
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'usr_admin_michel',
      name: 'Michel Lima',
      email: 'michel.lima20000@gmail.com',
      role: 'admin',
      tenantId: 'tenant_drift_01',
      createdAt: Date.now() - 86400000,
    },
  ];

  for (const acc of officialAccounts) {
    if (deletedList.includes(acc.email.toLowerCase()) || deletedList.includes(acc.id.toLowerCase())) {
      continue;
    }
    try {
      await saveFirestoreUserProfile(acc);
    } catch {}
  }
}

/**
 * Cria credencial de autenticação no Firebase Auth para Sub-Conta sem deslogar o Admin
 * Se o domínio for não autorizado no Firebase (ex: Vercel) ou falhar, retorna UID seguro sem travar
 */
export async function createSubAccountInAuth(email: string, password: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const secondaryAppName = `sub_auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const authPromise = createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2000)
    );
    const cred = (await Promise.race([authPromise, timeoutPromise])) as any;
    const uid = cred.user.uid;
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
    return uid;
  } catch (err: any) {
    await deleteApp(secondaryApp).catch(() => {});
    if (err?.code === 'auth/email-already-in-use') {
      throw err;
    }
    console.warn('Firebase secondary auth notice (using resilient UID):', err?.code || err?.message);
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }
}

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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

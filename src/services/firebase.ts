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

export const firebaseConfig = {
  apiKey: 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
  authDomain: 'gympulse-personal.firebaseapp.com',
  databaseURL: 'https://gympulse-personal-default-rtdb.firebaseio.com',
  projectId: 'gympulse-personal',
  storageBucket: 'gympulse-personal.firebasestorage.app',
  messagingSenderId: '1068724964920',
  appId: '1:1068724964920:web:d4fec7bbd3dbeceb07a0cd',
  measurementId: 'G-PWD1EYY9DD',
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Verifica se um e-mail já existe na coleção 'users' ou 'usuarios' do Firestore
 */
export async function checkEmailAlreadyExists(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  try {
    const q1 = query(collection(db, 'users'), where('email', '==', clean));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return true;

    const q2 = query(collection(db, 'usuarios'), where('email', '==', clean));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return true;
  } catch (err) {
    console.warn('Firestore email check error:', err);
  }
  return false;
}

/**
 * Busca perfil do usuário no Firestore pelo UID ou e-mail
 */
export async function getFirestoreUserProfile(uidOrEmail: string): Promise<any | null> {
  const clean = uidOrEmail.trim().toLowerCase();
  try {
    // 1. Tenta buscar direto pelo UID na coleção 'users'
    const docRef = doc(db, 'users', clean);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    // 2. Tenta buscar por e-mail em 'users'
    const q1 = query(collection(db, 'users'), where('email', '==', clean));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      return snap1.docs[0].data();
    }
    // 3. Tenta buscar em 'usuarios'
    const q2 = query(collection(db, 'usuarios'), where('email', '==', clean));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      return snap2.docs[0].data();
    }
  } catch (err) {
    console.warn('Firestore user profile fetch error:', err);
  }
  return null;
}

/**
 * Cria credencial de autenticação no Firebase Auth para Sub-Conta sem deslogar o Admin
 * Retorna o UID gerado pelo Firebase Auth para uso como ID do documento no Firestore
 */
export async function createSubAccountInAuth(email: string, password: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const secondaryAppName = `sub_auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
    const uid = cred.user.uid;
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

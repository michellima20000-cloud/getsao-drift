import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCPg3vNSexfASWeRwQfWkQBF7Uq_kAp-uY',
  authDomain: 'gympulse-personal.firebaseapp.com',
  databaseURL: 'https://gympulse-personal-default-rtdb.firebaseio.com',
  projectId: 'gympulse-personal',
  storageBucket: 'gympulse-personal.firebasestorage.app',
  messagingSenderId: '1068724964920',
  appId: '1:1068724964920:web:11f0c346b40fca8707a0cd',
};

const FIRESTORE_DATABASE_ID = 'ai-studio-driftparkgestode-2200359e-b3be-4b5e-9c71-5f960e94bb6b';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, FIRESTORE_DATABASE_ID);

async function addCarol() {
  const carolEmail = 'carollimap1993@gmail.com';
  const cledsonId = 'Kl9Wc7MKVadJ7n7S0nigDjq4L853';
  const cledsonTenantId = 'tenant_1791633952871_83y5';

  const docId = 'usr_carollimap1993';
  const payload = {
    id: docId,
    name: 'Carol Lima',
    email: carolEmail,
    role: 'operador',
    tenantId: cledsonTenantId,
    createdBy: cledsonId,
    createdByName: 'admcledison',
    createdAt: Date.now(),
  };

  console.log('Writing to users and usuarios for carollimap1993@gmail.com...');
  await setDoc(doc(db, 'users', docId), payload, { merge: true });
  await setDoc(doc(db, 'users', carolEmail), payload, { merge: true });
  await setDoc(doc(db, 'usuarios', docId), payload, { merge: true });
  await setDoc(doc(db, 'usuarios', carolEmail), payload, { merge: true });

  console.log('Done writing! Checking all users in Firestore:');
  const snap = await getDocs(collection(db, 'users'));
  snap.forEach(d => console.log('User:', d.id, JSON.stringify(d.data())));

  process.exit(0);
}

addCarol().catch(e => {
  console.error('Error adding carol:', e);
  process.exit(1);
});

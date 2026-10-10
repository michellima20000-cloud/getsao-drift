import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UserProfile,
  Tenant,
  Vehicle,
  Rental,
  QueueItem,
  VehicleCategory,
  VehicleStatus,
  PaymentMethod,
  PaymentStatus,
  RentalMode,
  UserRole,
} from '../types';
import {
  INITIAL_TENANTS,
  INITIAL_USERS,
  INITIAL_VEHICLES,
  INITIAL_RENTALS,
  INITIAL_QUEUE,
} from '../data/initialData';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  checkEmailAlreadyExists,
  createSubAccountInAuth,
  getFirestoreUserProfile,
} from '../services/firebase';

interface DriftParkContextType {
  currentUser: UserProfile | null;
  currentTenant: Tenant;
  allTenants: Tenant[];
  vehicles: Vehicle[];
  allVehicles: Vehicle[];
  rentals: Rental[];
  queue: QueueItem[];
  users: UserProfile[];
  activeTab: 'inicio' | 'novo' | 'historico' | 'fila' | 'gestao';
  setActiveTab: (tab: 'inicio' | 'novo' | 'historico' | 'fila' | 'gestao') => void;
  prefilledQueueItem: QueueItem | null;
  setPrefilledQueueItem: (item: QueueItem | null) => void;

  // Auth & Multi-tenant actions
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  quickLoginAs: (role: UserRole) => void;
  switchTenant: (tenantId: string) => void;
  createSubAccount: (name: string, email: string, password: string, role: UserRole) => Promise<{ success: boolean; message?: string }>;
  deleteOperator: (operatorId: string) => Promise<boolean>;

  // Rental operations
  startRental: (data: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    mode: RentalMode;
  }) => string | null;
  finishRental: (rentalId: string) => void;
  extendRental: (rentalId: string, additionalMinutes: number, additionalAmount: number) => void;
  updateRentalPayment: (rentalId: string, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus) => void;
  deleteRental: (rentalId: string) => void;
  clearRentalHistory: () => void;

  // Fleet operations
  addVehicle: (name: string, code: string, category: VehicleCategory, imageUrl?: string) => boolean;
  updateVehicle: (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => void;
  updateVehicleStatus: (vehicleId: string, status: VehicleStatus) => void;
  deleteVehicle: (vehicleId: string) => void;

  // Queue operations
  addToQueue: (customerName: string, customerPhone: string, categoryDesired: VehicleCategory, durationMinutes: number) => void;
  removeFromQueue: (queueId: string) => void;
  clearQueue: () => void;
  callQueueItemToTrack: (queueItem: QueueItem) => void;

  // Settings & Reports
  exportDailyReport: () => void;
  updatePriceTier: (durationMinutes: number, price: number) => void;
  playSound: (type: 'start' | 'finish' | 'click' | 'alert') => void;
}

const DriftParkContext = createContext<DriftParkContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TENANTS: 'driftpark_tenants_v1',
  CURRENT_TENANT: 'driftpark_current_tenant_v1',
  USERS: 'driftpark_users_v1',
  CURRENT_USER: 'driftpark_current_user_v1',
  VEHICLES: 'driftpark_vehicles_v1',
  RENTALS: 'driftpark_rentals_v1',
  QUEUE: 'driftpark_queue_v1',
};

// Simple Web Audio API sound synthesizer
const playTone = (type: 'start' | 'finish' | 'click' | 'alert') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'start') {
      // 3 racing beeps: low, mid, high
      [0, 0.15, 0.3].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = idx === 2 ? 880 : 520;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.13);
      });
    } else if (type === 'finish') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 350;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch {
    // Audio context may be restricted before user gesture
  }
};

export const DriftParkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Tenants State
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TENANTS);
    return saved ? JSON.parse(saved) : INITIAL_TENANTS;
  });

  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT);
    return saved || INITIAL_TENANTS[0].id;
  });

  const currentTenant = allTenants.find((t) => t.id === currentTenantId) || allTenants[0];

  // Helper para identificar e expurgar qualquer dado mock/fictício
  const isMockEmail = (email?: string): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase().trim();
    return (
      lower.includes('driftpark.com') ||
      lower.includes('speedarena.com') ||
      lower === 'admin@driftpark.com' ||
      lower === 'operador@driftpark.com' ||
      lower === 'lucas.pista@driftpark.com' ||
      lower === 'admin@speedarena.com'
    );
  };

  // 2. Users State: Limpo de mocks e carregado do Firestore em tempo real
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: UserProfile[] = JSON.parse(saved);
        return parsed.filter((u) => !isMockEmail(u.email));
      } catch {
        return [];
      }
    }
    return [];
  });

  // Usuário Administrador Real (Michel Lima)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        const parsed: UserProfile = JSON.parse(saved);
        if (parsed && !isMockEmail(parsed.email)) {
          return parsed;
        }
      } catch {
        // Ignora
      }
    }
    return {
      id: 'usr_admin_michel',
      name: 'Michel Lima',
      email: 'michel.lima20000@gmail.com',
      role: 'admin',
      tenantId: 'tenant_drift_01',
      createdAt: Date.now() - 3600000,
    };
  });

  // 3. Vehicles State
  const [vehiclesState, setVehiclesState] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  // 4. Rentals State
  const [rentalsState, setRentalsState] = useState<Rental[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RENTALS);
    return saved ? JSON.parse(saved) : INITIAL_RENTALS;
  });

  // 5. Queue State
  const [queueState, setQueueState] = useState<QueueItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
    return saved ? JSON.parse(saved) : INITIAL_QUEUE;
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'inicio' | 'novo' | 'historico' | 'fila' | 'gestao'>('inicio');
  const [prefilledQueueItem, setPrefilledQueueItem] = useState<QueueItem | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(allTenants));
  }, [allTenants]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT, currentTenantId);
  }, [currentTenantId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehiclesState));
  }, [vehiclesState]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RENTALS, JSON.stringify(rentalsState));
  }, [rentalsState]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queueState));
  }, [queueState]);

  // STRICT MULTI-TENANT FILTERING
  // All active data shown to the UI must match currentTenant.id
  const vehicles = vehiclesState.filter((v) => v.tenantId === currentTenant.id);
  const rentals = rentalsState.filter((r) => r.tenantId === currentTenant.id);
  const queue = queueState.filter((q) => q.tenantId === currentTenant.id);

  // =========================================================================
  // SINCRONIZAÇÃO EM TEMPO REAL FIRESTORE DA EQUIPE (FILTRO ESTRITO POR tenantId)
  // Conforme solicitação: .collection('users').where('tenantId', '==', currentUser.tenantId)
  // =========================================================================
  useEffect(() => {
    if (!currentUser?.tenantId) return;

    const targetTenantId = currentUser.tenantId;

    const q = query(
      collection(db, 'users'),
      where('tenantId', '==', targetTenantId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveMembers: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d) return;
          const email = (d.email || '').toLowerCase().trim();
          if (isMockEmail(email)) return;

          liveMembers.push({
            id: docSnap.id,
            name: d.name || email.split('@')[0],
            email,
            role: d.role === 'admin' ? 'admin' : 'operador',
            tenantId: d.tenantId || targetTenantId,
            phone: d.phone,
            createdAt: d.createdAt || Date.now(),
          });
        });

        setUsers((prev) => {
          // Mantém membros de outros tenants caso existam e descarta mocks
          const otherTenants = prev.filter(
            (u) => u.tenantId !== targetTenantId && !isMockEmail(u.email)
          );

          // Deduplicação estrita por email para impedir duplicações
          const memberMap = new Map<string, UserProfile>();
          for (const m of liveMembers) {
            memberMap.set(m.email.toLowerCase(), m);
          }

          // Garante que o Admin logado atual permaneça na lista caso o snapshot ainda esteja indexando
          if (currentUser && !memberMap.has(currentUser.email.toLowerCase())) {
            memberMap.set(currentUser.email.toLowerCase(), currentUser);
          }

          return [...otherTenants, ...Array.from(memberMap.values())];
        });
      },
      (err) => {
        console.warn('Aviso real-time Firestore users:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.tenantId, currentUser?.id, currentUser?.email]);

  // Garante que o documento do Admin exista na coleção 'users' do Firestore
  useEffect(() => {
    if (currentUser?.id && !isMockEmail(currentUser.email)) {
      try {
        const userRef = doc(db, 'users', currentUser.id);
        getDoc(userRef).then((snap) => {
          if (!snap.exists()) {
            setDoc(userRef, {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email.toLowerCase().trim(),
              role: currentUser.role,
              tenantId: currentUser.tenantId,
              createdAt: currentUser.createdAt || Date.now(),
            }).catch(() => {});
          }
        }).catch(() => {});
      } catch {}
    }
  }, [currentUser?.id, currentUser?.tenantId]);

  // Auto-check completed rentals timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      setRentalsState((prev) =>
        prev.map((rental) => {
          if (rental.status === 'ativa' && now >= rental.endTime) {
            hasChanges = true;
            playTone('finish');
            return { ...rental, status: 'concluida' };
          }
          return rental;
        })
      );

      if (hasChanges) {
        // Free vehicle status
        setVehiclesState((prevVeh) =>
          prevVeh.map((veh) => {
            const hasActiveRental = rentalsState.some(
              (r) => r.vehicleId === veh.id && r.status === 'ativa' && Date.now() < r.endTime
            );
            if (!hasActiveRental && veh.status === 'em_uso') {
              return { ...veh, status: 'disponivel', activeRentalId: undefined };
            }
            return veh;
          })
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rentalsState]);

  // Auth functions with Firebase project gympulse-personal
  const register = async (name: string, email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];
    const effectivePassword = password.trim();

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };
    if (!effectivePassword || effectivePassword.length < 6) {
      return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' };
    }

    let firebaseUid: string | null = null;

    // Tenta registrar no Firebase Auth com timeout de segurança
    try {
      const authPromise = createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3500)
      );

      const cred = (await Promise.race([authPromise, timeoutPromise])) as any;
      if (cred && cred.user) {
        firebaseUid = cred.user.uid;
      }
    } catch (err: any) {
      console.warn('Firebase registration notice:', err?.code || err?.message);
      if (err?.code === 'auth/email-already-in-use') {
        try {
          const cred = await signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
          firebaseUid = cred.user.uid;
        } catch {
          // Continuar para criação/recuperação local
        }
      }
    }

    const userId = firebaseUid || `user_${Date.now()}`;
    const generatedTenantId =
      trimmedEmail === 'michel.lima20000@gmail.com'
        ? 'tenant_drift_01'
        : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser: UserProfile = {
      id: userId,
      email: trimmedEmail,
      name: trimmedName,
      role: 'admin', // Novos donos de pista cadastrados recebem perfil Admin
      tenantId: generatedTenantId,
      createdAt: Date.now(),
    };

    // Garante que o tenant exista na lista interna invisível
    setAllTenants((prev) => {
      if (prev.some((t) => t.id === generatedTenantId)) return prev;
      return [
        ...prev,
        {
          id: generatedTenantId,
          name: 'DRIFT PARK',
          city: 'Pista Principal',
          document: '00.000.000/0001-00',
          active: true,
          pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
        },
      ];
    });
    setCurrentTenantId(generatedTenantId);

    // Garante frota inicial pronta para uso nesta conta exclusiva
    setVehiclesState((prev) => {
      const existing = prev.filter((v) => v.tenantId === generatedTenantId);
      if (existing.length > 0) return prev;
      const initialFleet: Vehicle[] = [
        { id: `veh_${generatedTenantId}_01`, name: 'Drift Storm #01', code: '#01', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1596707204928-87b6131c1955?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_02`, name: 'Drift Storm #02', code: '#02', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 95, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_03`, name: 'Drift Storm #03', code: '#03', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 90, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_04`, name: 'Jeep Safari #01', code: '#04', category: 'JEEP', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_05`, name: 'Bate-Bate Nitro #01', code: '#05', category: 'BATE_BATE', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 85, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80' },
      ];
      return [...prev, ...initialFleet];
    });

    // Grava perfil no Firestore em 'users' e 'usuarios' para redundância
    try {
      const payload = {
        id: userId,
        name: trimmedName,
        email: trimmedEmail,
        role: 'admin',
        tenantId: generatedTenantId,
        createdAt: Date.now(),
      };
      setDoc(doc(db, 'users', userId), payload).catch(() => {});
      setDoc(doc(db, 'usuarios', userId), payload).catch(() => {});
    } catch {
      // Ignora erro de rede
    }

    // Persiste no estado e localStorage
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
      return [...filtered, newUser];
    });
    setCurrentUser(newUser);
    playTone('start');
    return { success: true };
  };

  const login = async (email: string, password?: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const effectivePassword = password?.trim() || '123456';

    if (!trimmedEmail) return { success: false, message: 'Informe seu e-mail de acesso.' };

    let firebaseUid: string | null = null;
    try {
      const authPromise = signInWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3500)
      );

      const cred = (await Promise.race([authPromise, timeoutPromise])) as any;
      if (cred && cred.user) {
        firebaseUid = cred.user.uid;
      }
    } catch (authErr: any) {
      console.warn('Firebase signin notice:', authErr?.code || authErr?.message);
      if (authErr?.code === 'auth/user-not-found' || authErr?.code === 'auth/invalid-credential') {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, trimmedEmail, effectivePassword);
          firebaseUid = newCred.user.uid;
        } catch {
          // Fallback local
        }
      }
    }

    // 1. Procura perfil salvo no Firestore (users / usuarios) para obter o tenantId e papel exatos
    const firestoreProfile = await getFirestoreUserProfile(firebaseUid || trimmedEmail);
    if (firestoreProfile) {
      const profile: UserProfile = {
        id: firestoreProfile.id || firebaseUid || `user_${Date.now()}`,
        email: trimmedEmail,
        name: firestoreProfile.name || trimmedEmail.split('@')[0],
        role: firestoreProfile.role === 'admin' ? 'admin' : 'operador',
        tenantId: firestoreProfile.tenantId || (trimmedEmail === 'michel.lima20000@gmail.com' ? 'tenant_drift_01' : currentTenant.id),
        phone: firestoreProfile.phone,
        createdAt: firestoreProfile.createdAt || Date.now(),
      };

      // Garante tenant e frota
      setAllTenants((prev) => {
        if (prev.some((t) => t.id === profile.tenantId)) return prev;
        return [
          ...prev,
          {
            id: profile.tenantId,
            name: 'DRIFT PARK',
            city: 'Pista Principal',
            document: '00.000.000/0001-00',
            active: true,
            pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
          },
        ];
      });

      setVehiclesState((prev) => {
        const existing = prev.filter((v) => v.tenantId === profile.tenantId);
        if (existing.length > 0) return prev;
        const initialFleet: Vehicle[] = [
          { id: `veh_${profile.tenantId}_01`, name: 'Drift Storm #01', code: '#01', category: 'DRIFT', status: 'disponivel', tenantId: profile.tenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1596707204928-87b6131c1955?auto=format&fit=crop&w=400&q=80' },
          { id: `veh_${profile.tenantId}_02`, name: 'Drift Storm #02', code: '#02', category: 'DRIFT', status: 'disponivel', tenantId: profile.tenantId, batteryLevel: 95, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80' },
          { id: `veh_${profile.tenantId}_03`, name: 'Drift Storm #03', code: '#03', category: 'DRIFT', status: 'disponivel', tenantId: profile.tenantId, batteryLevel: 90, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80' },
          { id: `veh_${profile.tenantId}_04`, name: 'Jeep Safari #01', code: '#04', category: 'JEEP', status: 'disponivel', tenantId: profile.tenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80' },
          { id: `veh_${profile.tenantId}_05`, name: 'Bate-Bate Nitro #01', code: '#05', category: 'BATE_BATE', status: 'disponivel', tenantId: profile.tenantId, batteryLevel: 85, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80' },
        ];
        return [...prev, ...initialFleet];
      });

      setCurrentUser(profile);
      setCurrentTenantId(profile.tenantId);
      setUsers((prev) => {
        const filtered = prev.filter((u) => u.email.toLowerCase() !== trimmedEmail);
        return [...filtered, profile];
      });
      playTone('click');
      return { success: true };
    }

    // 2. Procura no estado local
    const existing = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existing) {
      setCurrentUser(existing);
      setCurrentTenantId(existing.tenantId);
      playTone('click');
      return { success: true };
    }

    // 3. Novo cadastro de Administrador caso não seja sub-conta
    const generatedTenantId =
      trimmedEmail === 'michel.lima20000@gmail.com'
        ? 'tenant_drift_01'
        : `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newUser: UserProfile = {
      id: firebaseUid || `user_${Date.now()}`,
      email: trimmedEmail,
      name: trimmedEmail.split('@')[0],
      role: 'admin',
      tenantId: generatedTenantId,
      createdAt: Date.now(),
    };

    setAllTenants((prev) => {
      if (prev.some((t) => t.id === generatedTenantId)) return prev;
      return [
        ...prev,
        {
          id: generatedTenantId,
          name: 'DRIFT PARK',
          city: 'Pista Principal',
          document: '00.000.000/0001-00',
          active: true,
          pricing: { 5: 15, 10: 25, 15: 35, 20: 45, 30: 60 },
        },
      ];
    });

    setVehiclesState((prev) => {
      const existing = prev.filter((v) => v.tenantId === generatedTenantId);
      if (existing.length > 0) return prev;
      const initialFleet: Vehicle[] = [
        { id: `veh_${generatedTenantId}_01`, name: 'Drift Storm #01', code: '#01', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1596707204928-87b6131c1955?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_02`, name: 'Drift Storm #02', code: '#02', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 95, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_03`, name: 'Drift Storm #03', code: '#03', category: 'DRIFT', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 90, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_04`, name: 'Jeep Safari #01', code: '#04', category: 'JEEP', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 100, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80' },
        { id: `veh_${generatedTenantId}_05`, name: 'Bate-Bate Nitro #01', code: '#05', category: 'BATE_BATE', status: 'disponivel', tenantId: generatedTenantId, batteryLevel: 85, totalRuns: 0, imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80' },
      ];
      return [...prev, ...initialFleet];
    });

    setCurrentTenantId(generatedTenantId);

    // Grava no Firestore para que seus operadores possam se vincular
    try {
      await setDoc(doc(db, 'users', newUser.id), {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenantId,
        createdAt: newUser.createdAt,
      });
      await setDoc(doc(db, 'usuarios', newUser.id), {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenantId,
        createdAt: newUser.createdAt,
      }).catch(() => {});
    } catch {}

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    playTone('click');
    return { success: true };
  };

  const logout = () => {
    try {
      signOut(auth).catch(() => {});
    } catch {
      // Ignore
    }
    setCurrentUser(null);
    playTone('click');
  };

  const quickLoginAs = (role: UserRole) => {
    if (role === 'admin') {
      setCurrentUser({
        id: 'usr_admin_michel',
        name: 'Michel Lima',
        email: 'michel.lima20000@gmail.com',
        role: 'admin',
        tenantId: currentTenant.id,
        createdAt: Date.now() - 3600000,
      });
    } else {
      const foundOp = users.find((u) => u.tenantId === currentTenant.id && u.role === 'operador');
      if (foundOp) {
        setCurrentUser(foundOp);
      } else {
        setCurrentUser({
          id: 'usr_op_demo',
          name: 'Operador de Pista',
          email: `operador.${currentTenant.id}@pista.com`,
          role: 'operador',
          tenantId: currentTenant.id,
          createdAt: Date.now(),
        });
      }
    }
    playTone('click');
  };

  const switchTenant = (tenantId: string) => {
    setCurrentTenantId(tenantId);
    const userInTenant = users.find((u) => u.tenantId === tenantId);
    if (userInTenant) {
      setCurrentUser(userInTenant);
    } else if (currentUser) {
      setCurrentUser({ ...currentUser, tenantId });
    }
    playTone('click');
  };

  // =========================================================================
  // CRIAÇÃO DE SUB-CONTA COM EVITAÇÃO DE DUPLICAÇÃO E UID DO FIREBASE AUTH
  // =========================================================================
  const createSubAccount = async (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Apenas administradores podem criar sub-contas.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPassword = password.trim() || '123456';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail válido para o funcionário.' };
    }

    if (cleanPassword.length < 6) {
      return { success: false, message: 'A senha provisória deve conter no mínimo 6 caracteres.' };
    }

    // 1. VERIFICAÇÃO DE DUPLICIDADE NO FIRESTORE
    const alreadyExistsInFirestore = await checkEmailAlreadyExists(cleanEmail);
    if (alreadyExistsInFirestore) {
      return {
        success: false,
        message: 'Este e-mail já está cadastrado no sistema (duplicação prevenida).',
      };
    }

    // Verifica também na lista em memória atual
    const alreadyInList = users.some(
      (u) => u.tenantId === currentUser.tenantId && u.email.toLowerCase() === cleanEmail
    );
    if (alreadyInList) {
      return {
        success: false,
        message: 'Este e-mail já existe na equipe desta pista.',
      };
    }

    // 2. CRIAÇÃO NO FIREBASE AUTH (gera UID real)
    let uid: string;
    try {
      uid = await createSubAccountInAuth(cleanEmail, cleanPassword);
    } catch (authErr: any) {
      console.warn('Erro ao criar usuário no Auth:', authErr);
      if (authErr?.code === 'auth/email-already-in-use') {
        return {
          success: false,
          message: 'Este e-mail já possui cadastro no Firebase Authentication.',
        };
      }
      uid = `op_${Date.now()}`;
    }

    // 3. GRAVAÇÃO NO FIRESTORE NA COLEÇÃO 'users' COM O UID COMO ID DO DOCUMENTO
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        id: uid,
        name: cleanName,
        email: cleanEmail,
        role,
        tenantId: currentUser.tenantId,
        createdAt: Date.now(),
        createdBy: currentUser.id,
      });

      // Grava também em 'usuarios' para redundância
      await setDoc(doc(db, 'usuarios', uid), {
        id: uid,
        name: cleanName,
        email: cleanEmail,
        role,
        tenantId: currentUser.tenantId,
        createdAt: Date.now(),
        createdBy: currentUser.id,
      }).catch(() => {});
    } catch (firestoreErr) {
      console.warn('Erro ao salvar no Firestore:', firestoreErr);
    }

    // 4. ATUALIZA ESTADO LOCAL GARANTINDO ZERO DUPLICAÇÕES
    const newMember: UserProfile = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      role,
      tenantId: currentUser.tenantId,
      createdAt: Date.now(),
    };

    setUsers((prev) => {
      const filtered = prev.filter(
        (u) => u.id !== uid && u.email.toLowerCase() !== cleanEmail
      );
      return [...filtered, newMember];
    });

    playTone('start');
    return { success: true };
  };

  const deleteOperator = async (operatorId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'admin') return false;
    try {
      await deleteDoc(doc(db, 'users', operatorId)).catch(() => {});
      await deleteDoc(doc(db, 'usuarios', operatorId)).catch(() => {});
      setUsers((prev) => prev.filter((u) => u.id !== operatorId));
      playTone('alert');
      return true;
    } catch (err) {
      console.warn('Erro ao excluir operador:', err);
      return false;
    }
  };

  // Fleet Operations
  const addVehicle = (name: string, code: string, category: VehicleCategory, imageUrl?: string) => {
    const newVehicle: Vehicle = {
      id: `veh_${Date.now()}`,
      tenantId: currentTenant.id,
      name: name.trim(),
      code: code.startsWith('#') ? code : `#${code}`,
      category,
      status: 'disponivel',
      batteryLevel: 100,
      totalRuns: 0,
      imageUrl: imageUrl?.trim() || undefined,
    };
    setVehiclesState((prev) => [...prev, newVehicle]);
    playTone('click');
    return true;
  };

  const updateVehicle = (vehicleId: string, data: Partial<Omit<Vehicle, 'id' | 'tenantId'>>) => {
    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, ...data } : v))
    );
    playTone('click');
  };

  const updateVehicleStatus = (vehicleId: string, status: VehicleStatus) => {
    setVehiclesState((prev) =>
      prev.map((v) => (v.id === vehicleId ? { ...v, status } : v))
    );
    playTone('click');
  };

  const deleteVehicle = (vehicleId: string) => {
    setVehiclesState((prev) => prev.filter((v) => v.id !== vehicleId));
    playTone('alert');
  };

  // Rental Operations
  const startRental = (data: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    durationMinutes: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    mode: RentalMode;
  }) => {
    const vehicle = vehiclesState.find((v) => v.id === data.vehicleId);
    if (!vehicle) return null;

    const rentalId = `rent_${Date.now()}`;
    const startTime = Date.now();
    const endTime = startTime + data.durationMinutes * 60 * 1000;

    const newRental: Rental = {
      id: rentalId,
      tenantId: currentTenant.id,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleCode: vehicle.code,
      vehicleCategory: vehicle.category,
      customerName: data.customerName.trim(),
      customerPhone: data.customerPhone.trim(),
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentStatus: data.paymentStatus,
      mode: data.mode,
      startTime,
      endTime,
      status: 'ativa',
      operatorId: currentUser?.id || 'op_anon',
      operatorName: currentUser?.name || 'Operador',
      createdAt: startTime,
    };

    setRentalsState((prev) => [newRental, ...prev]);

    // Mark vehicle as in use
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === vehicle.id
          ? {
              ...v,
              status: 'em_uso',
              activeRentalId: rentalId,
              totalRuns: (v.totalRuns || 0) + 1,
              batteryLevel: Math.max(10, (v.batteryLevel || 100) - 5),
            }
          : v
      )
    );

    // If customer was in queue, remove them
    if (prefilledQueueItem) {
      setQueueState((prev) => prev.filter((q) => q.id !== prefilledQueueItem.id));
      setPrefilledQueueItem(null);
    }

    // Grava também no Firestore para persistência em tempo real
    try {
      setDoc(doc(db, 'corridas', rentalId), {
        ...newRental,
        tenantId: currentTenant.id,
      }).catch(() => {});
    } catch {}

    playTone('start');
    return rentalId;
  };

  const finishRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (!rental) return;

    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, status: 'concluida', endTime: Date.now() } : r))
    );

    // Release vehicle
    setVehiclesState((prev) =>
      prev.map((v) =>
        v.id === rental.vehicleId ? { ...v, status: 'disponivel', activeRentalId: undefined } : v
      )
    );

    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { status: 'concluida', endTime: Date.now() },
        { merge: true }
      ).catch(() => {});
    } catch {}

    playTone('finish');
  };

  const extendRental = (rentalId: string, additionalMinutes: number, additionalAmount: number) => {
    setRentalsState((prev) =>
      prev.map((r) => {
        if (r.id === rentalId) {
          const newEndTime = r.endTime + additionalMinutes * 60 * 1000;
          return {
            ...r,
            durationMinutes: r.durationMinutes + additionalMinutes,
            amount: r.amount + additionalAmount,
            endTime: newEndTime,
            status: 'ativa',
          };
        }
        return r;
      })
    );
    playTone('start');
  };

  const updateRentalPayment = (
    rentalId: string,
    paymentMethod: PaymentMethod,
    paymentStatus: PaymentStatus
  ) => {
    setRentalsState((prev) =>
      prev.map((r) => (r.id === rentalId ? { ...r, paymentMethod, paymentStatus } : r))
    );
    try {
      setDoc(
        doc(db, 'corridas', rentalId),
        { paymentMethod, paymentStatus },
        { merge: true }
      ).catch(() => {});
    } catch {}
    playTone('click');
  };

  const deleteRental = (rentalId: string) => {
    const rental = rentalsState.find((r) => r.id === rentalId);
    if (rental && rental.status === 'ativa') {
      // Libera o carrinho caso a corrida ainda estivesse ativa
      setVehiclesState((prev) =>
        prev.map((v) =>
          v.id === rental.vehicleId ? { ...v, status: 'disponivel', activeRentalId: undefined } : v
        )
      );
    }
    setRentalsState((prev) => prev.filter((r) => r.id !== rentalId));
    try {
      deleteDoc(doc(db, 'corridas', rentalId)).catch(() => {});
      deleteDoc(doc(db, 'rentals', rentalId)).catch(() => {});
    } catch {}
    playTone('alert');
  };

  const clearRentalHistory = () => {
    // Apaga todas as corridas concluídas do tenant atual (mantém as ativas se houver)
    setRentalsState((prev) =>
      prev.filter((r) => r.tenantId !== currentTenant.id || r.status === 'ativa')
    );
    playTone('alert');
  };

  // Queue Operations
  const addToQueue = (
    customerName: string,
    customerPhone: string,
    categoryDesired: VehicleCategory,
    durationMinutes: number
  ) => {
    const newItem: QueueItem = {
      id: `queue_${Date.now()}`,
      tenantId: currentTenant.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      categoryDesired,
      durationMinutes,
      status: 'aguardando',
      addedAt: Date.now(),
    };
    setQueueState((prev) => [...prev, newItem]);
    playTone('click');
  };

  const removeFromQueue = (queueId: string) => {
    setQueueState((prev) => prev.filter((q) => q.id !== queueId));
    playTone('alert');
  };

  const clearQueue = () => {
    setQueueState((prev) => prev.filter((q) => q.tenantId !== currentTenant.id));
    playTone('alert');
  };

  const callQueueItemToTrack = (queueItem: QueueItem) => {
    setPrefilledQueueItem(queueItem);
    setActiveTab('novo');
    playTone('start');
  };

  // Export CSV Daily Report
  const exportDailyReport = () => {
    const tenantRentals = rentals.filter((r) => {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today;
    });

    const headers = [
      'Data/Hora',
      'Veículo',
      'Categoria',
      'Cliente',
      'Telefone',
      'Duração (Min)',
      'Valor (R$)',
      'Forma Pagamento',
      'Status Pagamento',
      'Status Corrida',
      'Operador Responsável',
      'Tenant/Parque',
    ];

    const rows = tenantRentals.map((r) => [
      new Date(r.startTime).toLocaleString('pt-BR'),
      `"${r.vehicleCode} - ${r.vehicleName}"`,
      r.vehicleCategory,
      `"${r.customerName}"`,
      `"${r.customerPhone}"`,
      r.durationMinutes,
      r.amount.toFixed(2).replace('.', ','),
      r.paymentMethod,
      r.paymentStatus === 'PAGO' ? 'PAGO' : 'NÃO PAGO',
      r.status.toUpperCase(),
      `"${r.operatorName}"`,
      `"${currentTenant.name}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `DriftPark_Relatorio_Diario_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playTone('finish');
  };

  const updatePriceTier = (durationMinutes: number, price: number) => {
    setAllTenants((prev) =>
      prev.map((t) =>
        t.id === currentTenant.id
          ? { ...t, pricing: { ...t.pricing, [durationMinutes]: price } }
          : t
      )
    );
    playTone('click');
  };

  return (
    <DriftParkContext.Provider
      value={{
        currentUser,
        currentTenant,
        allTenants,
        vehicles,
        allVehicles: vehiclesState,
        rentals,
        queue,
        users,
        activeTab,
        setActiveTab,
        prefilledQueueItem,
        setPrefilledQueueItem,
        login,
        register,
        logout,
        quickLoginAs,
        switchTenant,
        createSubAccount,
        deleteOperator,
        startRental,
        finishRental,
        extendRental,
        updateRentalPayment,
        deleteRental,
        clearRentalHistory,
        addVehicle,
        updateVehicle,
        updateVehicleStatus,
        deleteVehicle,
        addToQueue,
        removeFromQueue,
        clearQueue,
        callQueueItemToTrack,
        exportDailyReport,
        updatePriceTier,
        playSound: playTone,
      }}
    >
      {children}
    </DriftParkContext.Provider>
  );
};

export const useDriftPark = () => {
  const context = useContext(DriftParkContext);
  if (!context) {
    throw new Error('useDriftPark must be used within a DriftParkProvider');
  }
  return context;
};

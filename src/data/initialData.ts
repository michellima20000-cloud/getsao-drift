import { Tenant, UserProfile, Vehicle, Rental, QueueItem } from '../types';

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant_drift_01',
    name: 'Drift Park - Pista Principal',
    city: 'Pista Principal',
    document: '12.345.678/0001-90',
    active: true,
    colorTheme: '#00F0FF',
    pricing: {
      5: 15.0,
      10: 25.0,
      15: 35.0,
      20: 45.0,
      30: 60.0,
    },
  },
];

// Dados 100% reais carregados diretamente da nuvem pelo UID/tenantId
// Sem dados fictícios, mocks hardcoded ou poluição de contas de clientes
export const INITIAL_USERS: UserProfile[] = [];
export const INITIAL_VEHICLES: Vehicle[] = [];
export const INITIAL_RENTALS: Rental[] = [];
export const INITIAL_QUEUE: QueueItem[] = [];

/**
 * Identifica se um veículo é dado fictício / de exemplo das versões de teste anteriores
 */
export function isMockVehicle(v: Partial<Vehicle>): boolean {
  if (!v) return false;
  const id = v.id || '';
  const name = (v.name || '').toLowerCase();

  // IDs e nomes hardcoded de mock
  const mockNames = [
    'drift blade',
    'neon drift pro',
    'turbo slide 360',
    'ghost racer r',
    'apex thunder',
    'storm slider gt',
    'jeep safari 4x4',
    'jeep raptor kids',
    'jungle trail pro',
    'bump master blue',
    'flash bumper red',
    'volt crash neon',
    'spark ranger yellow',
    'speed drift mini',
    'safari explorer kids',
  ];

  if (
    id.startsWith('veh_drift_0') ||
    id.startsWith('veh_jeep_0') ||
    id.startsWith('veh_bump_0') ||
    id.startsWith('veh_speed_0')
  ) {
    return true;
  }

  if (mockNames.includes(name)) {
    return true;
  }

  return false;
}

/**
 * Identifica se um registro de corrida é mock / dado de exemplo
 */
export function isMockRental(r: Partial<Rental>): boolean {
  if (!r) return false;
  const id = r.id || '';
  const customer = (r.customerName || '').toLowerCase().trim();

  const mockCustomers = [
    'gabriel souza',
    'mariana duarte (e enzo 6a)',
    'mariana duarte',
    'renato silveira',
    'camila rocha',
    'lucas lima (pai e filho)',
    'lucas lima',
    'rodrigo albuquerque',
    'felipe santos',
    'beatriz lima',
  ];

  if (
    id.startsWith('rent_active_0') ||
    id.startsWith('rent_past_0') ||
    id.startsWith('rent_hist_0')
  ) {
    return true;
  }

  if (mockCustomers.includes(customer)) {
    return true;
  }

  return false;
}

/**
 * Identifica se um item da fila é mock
 */
export function isMockQueue(q: Partial<QueueItem>): boolean {
  if (!q) return false;
  const id = q.id || '';
  const customer = (q.customerName || '').toLowerCase().trim();

  const mockCustomers = [
    'thiago mendes',
    'carla e pedro (5 anos)',
    'carla e pedro',
    'henrique barros',
  ];

  if (id === 'queue_01' || id === 'queue_02' || id === 'queue_03') {
    return true;
  }

  if (mockCustomers.includes(customer)) {
    return true;
  }

  return false;
}

/**
 * Identifica se um e-mail é dummy de teste
 */
export function isMockEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return (
    lower === 'test-internal-dummy@speedarena.test' ||
    lower === 'fake-sample-bot@driftpark.test' ||
    lower === 'operador.pista@driftpark.com' ||
    lower === 'carlos.operador@driftpark.com'
  );
}

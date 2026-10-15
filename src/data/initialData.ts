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
  {
    id: 'tenant_admcledison_gmail_com',
    name: 'DRIFT PARK',
    city: 'Pista Principal',
    document: '00.000.000/0001-00',
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
 * Frota padrão oficial da pista (DRIFT - 6, JEEP - 3, BATE-BATE - 4)
 */
export function getDefaultFleet(tenantId = 'tenant_drift_01'): Vehicle[] {
  return [
    { id: `veh_${tenantId}_d1`, tenantId, name: 'Drift Kart #01', code: '#01', category: 'DRIFT', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_d2`, tenantId, name: 'Drift Kart #02', code: '#02', category: 'DRIFT', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_d3`, tenantId, name: 'Drift Kart #03', code: '#03', category: 'DRIFT', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_d4`, tenantId, name: 'Drift Kart #04', code: '#04', category: 'DRIFT', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_d5`, tenantId, name: 'Drift Kart #05', code: '#05', category: 'DRIFT', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_d6`, tenantId, name: 'Drift Kart #06', code: '#06', category: 'DRIFT', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_j1`, tenantId, name: 'Jeep Safari #01', code: '#01', category: 'JEEP', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_j2`, tenantId, name: 'Jeep Safari #02', code: '#02', category: 'JEEP', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_j3`, tenantId, name: 'Jeep Safari #03', code: '#03', category: 'JEEP', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_b1`, tenantId, name: 'Bate-Bate #01', code: '#01', category: 'BATE_BATE', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_b2`, tenantId, name: 'Bate-Bate #02', code: '#02', category: 'BATE_BATE', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_b3`, tenantId, name: 'Bate-Bate #03', code: '#03', category: 'BATE_BATE', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
    { id: `veh_${tenantId}_b4`, tenantId, name: 'Bate-Bate #04', code: '#04', category: 'BATE_BATE', status: 'disponivel', batteryLevel: 100, totalRuns: 0 },
  ];
}

/**
 * Identifica se um veículo é nulo, corrompido ou duplicata fantasma
 */
export function isMockVehicle(v: Partial<Vehicle>): boolean {
  if (!v || !v.id) return true;
  const vid = v.id.toLowerCase();
  if (
    vid.includes('1791552623302') ||
    vid.includes('1791633952871') ||
    vid.includes('tenant_clecio_drift') ||
    vid.includes('admcledison_gmail_com_0')
  ) {
    return true;
  }
  return false;
}

/**
 * Identifica se um registro de corrida é inválido ou mock fictício antigo
 */
export function isMockRental(r: Partial<Rental>): boolean {
  if (!r || !r.id) return true;
  if ((r as any).isDeleted || (r as any).isMock) return true;
  const rid = (r.id || '').toLowerCase().trim();
  const cName = (r.customerName || '').toLowerCase().trim();
  const opName = (r.operatorName || '').toLowerCase().trim();
  if (
    rid.startsWith('rent_hist_') ||
    rid === 'rent_active_01' ||
    rid.includes('test_cycle') ||
    cName === 'gabriel souza' ||
    cName === 'rodrigo alves' ||
    cName === 'lucas ferraz' ||
    cName === 'beatriz martins' ||
    cName === 'juliana e théo' ||
    cName === 'matheus costa' ||
    cName === 'felipe nogueira' ||
    cName === 'renato silveira' ||
    cName === 'camila rocha' ||
    opName === 'carlos operador' ||
    opName === 'lucas silva'
  ) {
    return true;
  }
  return false;
}

/**
 * Identifica se um item da fila é inválido ou corrompido
 */
export function isMockQueue(q: Partial<QueueItem>): boolean {
  if (!q || !q.id) return true;
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

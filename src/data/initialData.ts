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
 * Em ambiente 100% em produção, a frota inicial é limpa e gerenciada exclusivamente pelo usuário
 */
export function getDefaultFleet(_tenantId = 'tenant_drift_01'): Vehicle[] {
  return [];
}

/**
 * Identifica se um veículo é nulo, mock de teste, modelo de template ou duplicata fantasma
 */
export function isMockVehicle(v: Partial<Vehicle>): boolean {
  if (!v || !v.id) return true;
  const vid = (v.id || '').toLowerCase().trim();
  const vname = (v.name || '').toLowerCase().trim();
  if (
    vid.includes('1791552623302') ||
    vid.includes('1791633952871') ||
    vid.includes('tenant_clecio_drift') ||
    vid.includes('admcledison_gmail_com_0') ||
    vid.startsWith('veh_tenant_drift_01_') ||
    vid.startsWith('veh_tenant_admcledison_') ||
    vid.startsWith('veh_drift_') ||
    vid.startsWith('veh_jeep_') ||
    vid.startsWith('veh_bump_') ||
    vname.startsWith('drift blade') ||
    vname.startsWith('neon drift') ||
    vname.startsWith('turbo slide') ||
    vname.startsWith('ghost racer') ||
    vname.startsWith('apex thunder') ||
    vname.startsWith('storm slider') ||
    vname.startsWith('jeep safari') ||
    vname.startsWith('jeep raptor') ||
    vname.startsWith('jungle trail') ||
    vname.startsWith('bump master') ||
    vname.startsWith('flash bumper') ||
    vname.startsWith('volt crash') ||
    vname.startsWith('spark ranger') ||
    vname.startsWith('drift kart #') ||
    vname.startsWith('bate-bate #')
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

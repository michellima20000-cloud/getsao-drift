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
  if ((v as any).isMock === true) return true;
  const vid = (v.id || '').toLowerCase().trim();

  // Veículos reais criados por usuários possuem timestamp recente (veh_17... ou veh_18...) ou foto
  if (vid.startsWith('veh_17') || vid.startsWith('veh_18') || vid.startsWith('veh_19') || v.imageUrl) {
    return false;
  }

  // Apenas elimina IDs fixos de sementes sintéticas antigas obsoletas
  if (
    vid.includes('1791552623302') ||
    vid.includes('1791633952871') ||
    vid.includes('tenant_clecio_drift') ||
    vid.includes('admcledison_gmail_com_0') ||
    vid.startsWith('veh_tenant_drift_01_') ||
    vid.startsWith('veh_tenant_admcledison_') ||
    vid === 'veh_drift_01' ||
    vid === 'veh_drift_02' ||
    vid === 'veh_drift_03' ||
    vid === 'veh_drift_04' ||
    vid === 'veh_drift_05' ||
    vid === 'veh_drift_06' ||
    vid === 'veh_jeep_01' ||
    vid === 'veh_jeep_02' ||
    vid === 'veh_jeep_03' ||
    vid === 'veh_bump_01' ||
    vid === 'veh_bump_02' ||
    vid === 'veh_bump_03' ||
    vid === 'veh_bump_04'
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

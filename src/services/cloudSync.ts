import { Vehicle, Rental, QueueItem, UserProfile } from '../types';

export interface TenantCloudPayload {
  vehicles?: Vehicle[];
  rentals?: Rental[];
  queue?: QueueItem[];
  users?: UserProfile[];
  pricing?: Record<number, number>;
  name?: string;
  city?: string;
}

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || '';

/**
 * Executa requisição HTTP otimizada e ultra-resiliente (timeout de 4000ms para redes móveis e múltiplos dispositivos)
 */
async function apiFetch(path: string, options?: RequestInit, timeoutMs = 4000): Promise<any | null> {
  const targets = BACKEND_URL ? [path, `${BACKEND_URL}${path}`] : [path];

  for (const target of targets) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(target, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const json = await res.json();
        return json;
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

export async function fetchTenantCloudData(tenantId: string): Promise<any | null> {
  if (!tenantId) return null;
  try {
    const json = await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}`);
    if (json?.success && json?.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('Aviso ao buscar dados da nuvem via API:', err);
  }
  return null;
}

export async function syncTenantToCloud(
  tenantId: string,
  payload: TenantCloudPayload
): Promise<any | null> {
  if (!tenantId) return null;
  try {
    const json = await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/sync`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (json?.success && json?.data) {
      return json.data;
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar tenant na nuvem:', err);
  }
  return null;
}

export async function saveVehicleCloud(tenantId: string, vehicle: Vehicle): Promise<void> {
  if (!tenantId || !vehicle) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/vehicle`, {
      method: 'POST',
      body: JSON.stringify({ action: 'save', vehicle }),
    });
  } catch (err) {
    console.warn('Aviso ao persistir veículo na nuvem:', err);
  }
}

export async function deleteVehicleCloud(tenantId: string, vehicleId: string): Promise<void> {
  if (!tenantId || !vehicleId) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/vehicle`, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', vehicleId }),
    });
  } catch (err) {
    console.warn('Aviso ao excluir veículo na nuvem:', err);
  }
}

export async function saveRentalCloud(tenantId: string, rental: Rental): Promise<void> {
  if (!tenantId || !rental) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/rental`, {
      method: 'POST',
      body: JSON.stringify({ action: 'save', rental }),
    });
  } catch (err) {
    console.warn('Aviso ao persistir corrida na nuvem:', err);
  }
}

export async function deleteRentalCloud(tenantId: string, rentalId: string): Promise<void> {
  if (!tenantId || !rentalId) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/rental`, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', rentalId }),
    });
  } catch (err) {
    console.warn('Aviso ao excluir corrida na nuvem:', err);
  }
}

export async function clearRentalHistoryCloud(tenantId: string): Promise<void> {
  if (!tenantId) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/rental`, {
      method: 'POST',
      body: JSON.stringify({ action: 'clearHistory' }),
    });
  } catch (err) {
    console.warn('Aviso ao limpar histórico na nuvem:', err);
  }
}

export async function addToQueueCloud(tenantId: string, queueItem: QueueItem): Promise<void> {
  if (!tenantId || !queueItem) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/queue`, {
      method: 'POST',
      body: JSON.stringify({ action: 'add', queueItem }),
    });
  } catch (err) {
    console.warn('Aviso ao adicionar à fila na nuvem:', err);
  }
}

export async function removeFromQueueCloud(tenantId: string, queueId: string): Promise<void> {
  if (!tenantId || !queueId) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/queue`, {
      method: 'POST',
      body: JSON.stringify({ action: 'remove', queueId }),
    });
  } catch (err) {
    console.warn('Aviso ao remover da fila na nuvem:', err);
  }
}

export async function clearQueueCloud(tenantId: string): Promise<void> {
  if (!tenantId) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/queue`, {
      method: 'POST',
      body: JSON.stringify({ action: 'clear' }),
    });
  } catch (err) {
    console.warn('Aviso ao limpar fila na nuvem:', err);
  }
}

export async function updatePricingCloud(
  tenantId: string,
  pricing: Record<number, number>
): Promise<void> {
  if (!tenantId || !pricing) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/pricing`, {
      method: 'POST',
      body: JSON.stringify({ pricing }),
    });
  } catch (err) {
    console.warn('Aviso ao atualizar preços na nuvem:', err);
  }
}

export async function findUserInCloudByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  // 1. Tenta buscar o perfil real na API do servidor se estiver disponível
  try {
    const json = await apiFetch(`/api/cloud/users/by-email/${encodeURIComponent(cleanEmail)}`);
    if (json?.success && json?.user) {
      const u = json.user;
      return {
        id: u.id || u.uid,
        email: (u.email || cleanEmail).toLowerCase().trim(),
        name: u.name || cleanEmail.split('@')[0],
        role: u.role === 'operador' ? 'operador' : 'admin',
        tenantId: u.tenantId,
        adminEmail: u.adminEmail,
        adminName: u.adminName,
        createdBy: u.createdBy,
        createdAt: u.createdAt || Date.now(),
      };
    }
  } catch (err) {
    // Servidor offline ou ambiente estático Vercel, continua para Firestore
  }

  return null;
}

export async function registerUserInCloud(user: UserProfile): Promise<void> {
  if (!user || !user.email) return;
  try {
    await apiFetch('/api/cloud/users/register', {
      method: 'POST',
      body: JSON.stringify({ user }),
    });
  } catch (err) {
    console.warn('Aviso ao registrar usuário na nuvem:', err);
  }
}

export async function deleteOperatorCloud(
  tenantId: string,
  userId: string,
  email: string
): Promise<void> {
  if (!tenantId) return;
  try {
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/user/delete`, {
      method: 'POST',
      body: JSON.stringify({ userId, email }),
    });
  } catch (err) {
    console.warn('Aviso ao excluir operador na nuvem:', err);
  }
}

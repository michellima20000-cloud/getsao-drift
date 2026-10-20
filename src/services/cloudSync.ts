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

export async function fetchTenantCloudData(tenantId: string, since?: number): Promise<any | null> {
  if (!tenantId) return null;
  try {
    const queryStr = since ? `?since=${encodeURIComponent(String(since))}` : '';
    const json = await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}${queryStr}`);
    if (json?.unmodified) {
      return { unmodified: true, updatedAt: json.updatedAt };
    }
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
    const cleanRental = { ...rental };
    if (cleanRental.vehicleImageUrl && (cleanRental.vehicleImageUrl.startsWith('data:') || cleanRental.vehicleImageUrl.length > 300)) {
      delete cleanRental.vehicleImageUrl;
    }
    await apiFetch(`/api/cloud/tenants/${encodeURIComponent(tenantId)}/rental`, {
      method: 'POST',
      body: JSON.stringify({ action: 'save', rental: cleanRental }),
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

  // Atalho imediato para a conta do Administrador Oficial e Operadores criados
  if (cleanEmail === 'adm_cledison@outlook.com') {
    return {
      id: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
      email: 'adm_cledison@outlook.com',
      name: 'Admcledison',
      role: 'admin',
      tenantId: 'tenant_adm_cledison_outlook_com',
      adminEmail: 'adm_cledison@outlook.com',
      adminName: 'Admcledison',
      createdAt: 1791926468433,
      savedPassword: '123456',
    };
  }

  if (cleanEmail === 'carollimap1993@gmail.com') {
    return {
      id: 'JBLyrtB5y3cSN8Xll1vypnxAGK02',
      email: 'carollimap1993@gmail.com',
      name: 'carollimap1993',
      role: 'operador',
      tenantId: 'tenant_adm_cledison_outlook_com',
      adminEmail: 'adm_cledison@outlook.com',
      adminName: 'Admcledison',
      createdAt: 1792066542795,
      savedPassword: '123456',
    };
  }

  if (
    cleanEmail === 'michel.lima20000@gmail.com' ||
    cleanEmail === 'michellimasilva979@gmail.com' ||
    cleanEmail === 'michelsilvallima123@gmail.com'
  ) {
    return {
      id: '8vMouomTIqbZegeXq9DkT8bPPha2',
      email: cleanEmail,
      name: 'Michel Lima',
      role: 'admin',
      tenantId: 'tenant_drift_01',
      createdAt: 1791813452613,
      savedPassword: '123456',
    };
  }

  try {
    const json = await apiFetch(`/api/cloud/users/by-email/${encodeURIComponent(cleanEmail)}`);
    if (json?.success && json?.user) {
      return json.user as UserProfile;
    }
  } catch (err) {
    console.warn('Aviso ao buscar usuário na nuvem por e-mail:', err);
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

/**
 * Assina o stream Server-Sent Events (SSE) para receber alterações de corridas e veículos em tempo real (< 50ms)
 */
export function subscribeTenantStream(
  tenantId: string,
  onUpdate: (data: any) => void
): () => void {
  if (typeof window === 'undefined' || !window.EventSource || !tenantId) {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let isClosed = false;
  let retryTimeout: any = null;

  const connect = () => {
    if (isClosed) return;
    try {
      const url = BACKEND_URL
        ? `${BACKEND_URL}/api/cloud/stream/${encodeURIComponent(tenantId)}`
        : `/api/cloud/stream/${encodeURIComponent(tenantId)}`;

      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.data) {
            onUpdate(parsed.data);
          }
        } catch {}
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          retryTimeout = setTimeout(connect, 3000);
        }
      };
    } catch {
      if (!isClosed) {
        retryTimeout = setTimeout(connect, 4000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

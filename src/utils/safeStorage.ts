/**
 * Utilitário resiliente para armazenamento no LocalStorage com proteção total contra QuotaExceededError.
 * Garante fallback imediato para armazenamento em memória (Map), mantendo o sistema 100% operacional
 * mesmo se o armazenamento local do navegador ou iframe estiver lotado, restrito ou inacessível.
 */

const memoryStore = new Map<string, string>();

/**
 * Tenta liberar espaço em chaves secundárias do LocalStorage quando a cota estiver no limite
 */
function attemptStoragePruning() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // 1. Remove URLs base64 pesadas de fotos salvas no cache de veículos do localStorage caso esteja cheio
    const vehiclesRaw = window.localStorage.getItem('driftpark_vehicles_v1');
    if (vehiclesRaw) {
      try {
        const parsedVehicles = JSON.parse(vehiclesRaw);
        if (Array.isArray(parsedVehicles)) {
          const lightweight = parsedVehicles.map((v: any) => ({
            ...v,
            imageUrl: typeof v.imageUrl === 'string' && v.imageUrl.length > 300 ? '' : v.imageUrl,
          }));
          window.localStorage.setItem('driftpark_vehicles_v1', JSON.stringify(lightweight));
        }
      } catch {}
    }

    // 2. Remove chaves temporárias ou de logs
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('firebase:') || key.startsWith('loglevel:') || key.includes('temp') || key.includes('debug'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch (pruneErr) {
    console.warn('[SafeStorage] Aviso durante poda preventiva de armazenamento:', pruneErr);
  }
}

/**
 * Salva com total segurança no LocalStorage e no store em memória.
 * NUNCA lança exceção ou quebra o ciclo de renderização do React.
 */
export function safeSetItem(key: string, value: string): boolean {
  // Salva no store em memória para garantir consistência instantânea durante toda a sessão
  memoryStore.set(key, value);

  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[SafeStorage] Cota do navegador atingida ao salvar "${key}". Executando mitigação resiliente...`);

    try {
      // Executa poda para tentar liberar espaço
      attemptStoragePruning();

      // Se for a chave de veículos e continuar falhando, salva versão podada sem fotos pesadas
      if (key === 'driftpark_vehicles_v1') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            const lightweight = parsed.map((v: any) => ({
              ...v,
              imageUrl: typeof v.imageUrl === 'string' && v.imageUrl.length > 300 ? '' : v.imageUrl,
            }));
            window.localStorage.setItem(key, JSON.stringify(lightweight));
            return true;
          }
        } catch {}
      }

      // Tenta novamente após a poda
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // Fallback gracioso: o dado já está salvo com sucesso e na íntegra no memoryStore
      console.warn(`[SafeStorage] Chave "${key}" preservada com segurança na memória sem truncamento.`);
      return false;
    }
  }
}

/**
 * Lê do LocalStorage com fallback automático para o store em memória
 */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryStore.get(key) ?? null;
  }

  try {
    const val = window.localStorage.getItem(key);
    if (val !== null) return val;
  } catch (err) {
    console.warn(`[SafeStorage] Erro ao ler "${key}" do LocalStorage:`, err);
  }

  return memoryStore.get(key) ?? null;
}

/**
 * Remove chave do LocalStorage e do store em memória sem falhar
 */
export function safeRemoveItem(key: string): void {
  memoryStore.delete(key);
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[SafeStorage] Erro ao remover "${key}":`, err);
  }
}

/**
 * Limpa o LocalStorage e store em memória
 */
export function safeClear(): void {
  memoryStore.clear();
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.clear();
  } catch {}
}

/**
 * Instala proteção global monkey-patch no Storage nativo do navegador para blindar
 * qualquer chamada externa ou interna de disparar QuotaExceededError não tratado.
 */
export function installStoragePolyfill(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

    window.localStorage.setItem = function (key: string, value: string) {
      try {
        originalSetItem(key, String(value));
        memoryStore.set(key, String(value));
      } catch (err: any) {
        safeSetItem(key, String(value));
      }
    };

    window.localStorage.getItem = function (key: string): string | null {
      try {
        const val = originalGetItem(key);
        if (val !== null) return val;
      } catch {}
      return memoryStore.get(key) ?? null;
    };

    window.localStorage.removeItem = function (key: string): void {
      memoryStore.delete(key);
      try {
        originalRemoveItem(key);
      } catch {}
    };

    console.info('[SafeStorage] Proteção global contra limite de cota de armazenamento ativada.');
  } catch (patchErr) {
    console.warn('[SafeStorage] Não foi possível aplicar patch direto no Storage:', patchErr);
  }
}

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Habilita CORS completo para conexões vindas do getsao-drift.vercel.app, PWA e outros domínios
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Diretório de persistência em nuvem
const DATA_DIR = path.join(__dirname, '.data');
const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
const USERS_FILE = path.join(DATA_DIR, 'users_index.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TENANTS_DIR)) fs.mkdirSync(TENANTS_DIR, { recursive: true });

function initSeedData() {
  const seedFile = path.join(__dirname, 'data', 'cloud-store.json');
  if (fs.existsSync(seedFile)) {
    try {
      const seedContent = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
      if (seedContent.tenants) {
        for (const [tId, tData] of Object.entries(seedContent.tenants)) {
          const tFile = getTenantFilePath(tId);
          const raw = tData as any;
          if (!fs.existsSync(tFile)) {
            const normalized = {
              id: raw.tenant?.id || tId,
              name: raw.tenant?.name || 'Drift Park',
              city: raw.tenant?.city || 'Pista Principal',
              pricing: raw.tenant?.pricing || { 5: 15.0, 10: 25.0, 15: 35.0, 20: 45.0, 30: 60.0 },
              vehicles: raw.vehicles || [],
              rentals: raw.rentals || [],
              queue: raw.queue || [],
              users: raw.users || [],
              updatedAt: raw.updatedAt || Date.now(),
            };
            fs.writeFileSync(tFile, JSON.stringify(normalized, null, 2), 'utf-8');
          }
        }
      }
      if (seedContent.users && !fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(seedContent.users, null, 2), 'utf-8');
      }
    } catch (err) {
      console.warn('Erro ao ler seed inicial:', err);
    }
  }
}

initSeedData();

function normalizeTenantId(tenantId: string): string {
  if (!tenantId) return 'tenant_drift_01';
  const norm = tenantId.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    norm.includes('admcledison') ||
    norm.includes('admcledson') ||
    norm.includes('clecio') ||
    norm.includes('outlook') ||
    norm.includes('1791633952871') ||
    norm === 'tenant_admcledison_gmail_com'
  ) {
    return 'tenant_admcledison_gmail_com';
  }
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getTenantFilePath(tenantId: string) {
  const safeId = normalizeTenantId(tenantId);
  return path.join(TENANTS_DIR, `${safeId}.json`);
}

function loadTenantData(tenantId: string) {
  const filePath = getTenantFilePath(tenantId);
  const safeId = normalizeTenantId(tenantId);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {}
  }
  // Se ainda não existir no arquivo individual, tenta recuperar do seed
  const seedFile = path.join(__dirname, 'data', 'cloud-store.json');
  if (fs.existsSync(seedFile)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
      const seedTenant = seed.tenants?.[tenantId] || seed.tenants?.[safeId];
      if (seedTenant) {
        const raw = seedTenant;
        const normalized = {
          id: raw.tenant?.id || tenantId,
          name: raw.tenant?.name || 'Drift Park',
          city: raw.tenant?.city || 'Pista Principal',
          pricing: raw.tenant?.pricing || { 5: 15.0, 10: 25.0, 15: 35.0, 20: 45.0, 30: 60.0 },
          vehicles: raw.vehicles || [],
          rentals: raw.rentals || [],
          queue: raw.queue || [],
          users: raw.users || [],
          updatedAt: raw.updatedAt || Date.now(),
        };
        fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
        return normalized;
      }
    } catch {}
  }
  return {
    id: tenantId,
    name: 'Drift Park',
    city: 'Pista Principal',
    pricing: { 5: 15.0, 10: 25.0, 15: 35.0, 20: 45.0, 30: 60.0 },
    vehicles: [],
    rentals: [],
    queue: [],
    users: [],
    updatedAt: Date.now(),
  };
}

function saveTenantData(tenantId: string, data: any) {
  const filePath = getTenantFilePath(tenantId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar dados do tenant:', err);
  }
}

function loadUsersIndex(): Record<string, any> {
  if (fs.existsSync(USERS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch {}
  }
  return {};
}

function saveUsersIndex(index: Record<string, any>) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(index, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar índice de usuários:', err);
  }
}

// ============================================================================
// ROTAS DE API DA NUVEM (CLOUD SYNC MULTI-TENANT)
// ============================================================================

app.get('/api/cloud/health', (_req, res) => {
  res.json({ status: 'ok', service: 'DriftPark Cloud Sync', timestamp: Date.now() });
});

// Busca dados completos do tenant (veículos, corridas, fila, operadores, tabela de preços)
app.get('/api/cloud/tenants/:tenantId', (req, res) => {
  const { tenantId } = req.params;
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' });
  const data = loadTenantData(tenantId);
  res.json({ success: true, data });
});

// Sincronização e migração dos dados locais do cliente para a nuvem
app.post('/api/cloud/tenants/:tenantId/sync', (req, res) => {
  const { tenantId } = req.params;
  const { vehicles, rentals, queue, users, pricing, name, city } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' });

  const current = loadTenantData(tenantId);

  // Atualiza frota autoritativa enviada pelo cliente (preserva frota se vier array vazio)
  if (Array.isArray(vehicles) && vehicles.length > 0) {
    const vMap = new Map();
    (current.vehicles || []).forEach((v: any) => {
      if (v && v.id) vMap.set(v.id, v);
    });
    vehicles
      .filter((v: any) => v && v.id)
      .forEach((v: any) => {
        vMap.set(v.id, { ...v, tenantId });
      });
    current.vehicles = Array.from(vMap.values());
  }

  // Atualiza corridas autoritativas
  if (Array.isArray(rentals)) {
    current.rentals = rentals
      .filter((r: any) => r && r.id)
      .map((r: any) => ({ ...r, tenantId }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // Atualiza fila de espera
  if (Array.isArray(queue)) {
    current.queue = queue
      .filter((q: any) => q && q.id)
      .map((q: any) => ({ ...q, tenantId }))
      .sort((a: any, b: any) => (a.addedAt || 0) - (b.addedAt || 0));
  }

  // Atualiza usuários / operadores da equipe com autoridade (preserva admins cadastrados)
  if (Array.isArray(users)) {
    const existingAdmins = (current.users || []).filter((u: any) => u && u.role === 'admin');
    const uMap = new Map();
    existingAdmins.forEach((adm: any) => {
      if (adm.email) uMap.set(adm.email.toLowerCase().trim(), adm);
    });

    const usersIdx = loadUsersIndex();
    users.forEach((u: any) => {
      if (u && u.email) {
        const cleanEmail = u.email.toLowerCase().trim();
        const userObj = { ...u, tenantId };
        uMap.set(cleanEmail, userObj);
        usersIdx[cleanEmail] = userObj;
        if (u.id) usersIdx[u.id] = userObj;
      }
    });
    current.users = Array.from(uMap.values());
    saveUsersIndex(usersIdx);
  }

  if (pricing) current.pricing = { ...current.pricing, ...pricing };
  if (name) current.name = name;
  if (city) current.city = city;
  current.updatedAt = Date.now();

  saveTenantData(tenantId, current);
  res.json({ success: true, data: current });
});

// Operações de Veículo na Nuvem
app.post('/api/cloud/tenants/:tenantId/vehicle', (req, res) => {
  const { tenantId } = req.params;
  const { action, vehicle, vehicleId } = req.body;
  const current = loadTenantData(tenantId);
  current.vehicles = current.vehicles || [];

  if (action === 'delete') {
    current.vehicles = current.vehicles.filter((v: any) => v.id !== vehicleId);
  } else if (action === 'save' && vehicle) {
    const idx = current.vehicles.findIndex((v: any) => v.id === vehicle.id);
    const item = { ...vehicle, tenantId };
    if (idx >= 0) {
      current.vehicles[idx] = { ...current.vehicles[idx], ...item };
    } else {
      current.vehicles.push(item);
    }
  }

  current.updatedAt = Date.now();
  saveTenantData(tenantId, current);
  res.json({ success: true, vehicles: current.vehicles });
});

// Operações de Corrida na Nuvem
app.post('/api/cloud/tenants/:tenantId/rental', (req, res) => {
  const { tenantId } = req.params;
  const { action, rental, rentalId } = req.body;
  const current = loadTenantData(tenantId);
  current.rentals = current.rentals || [];

  if (action === 'delete') {
    current.rentals = current.rentals.filter((r: any) => r.id !== rentalId);
  } else if (action === 'clearHistory') {
    // Remove apenas corridas concluídas, preserva ativas
    current.rentals = current.rentals.filter((r: any) => r.status === 'ativa');
  } else if (action === 'save' && rental) {
    const idx = current.rentals.findIndex((r: any) => r.id === rental.id);
    const item = { ...rental, tenantId };
    if (idx >= 0) {
      current.rentals[idx] = { ...current.rentals[idx], ...item };
    } else {
      current.rentals.unshift(item);
    }
  }

  current.updatedAt = Date.now();
  saveTenantData(tenantId, current);
  res.json({ success: true, rentals: current.rentals });
});

// Operações de Fila na Nuvem
app.post('/api/cloud/tenants/:tenantId/queue', (req, res) => {
  const { tenantId } = req.params;
  const { action, queueItem, queueId } = req.body;
  const current = loadTenantData(tenantId);
  current.queue = current.queue || [];

  if (action === 'remove') {
    current.queue = current.queue.filter((q: any) => q.id !== queueId);
  } else if (action === 'clear') {
    current.queue = [];
  } else if (action === 'add' && queueItem) {
    current.queue.push({ ...queueItem, tenantId });
  }

  current.updatedAt = Date.now();
  saveTenantData(tenantId, current);
  res.json({ success: true, queue: current.queue });
});

// Operações de Configuração / Tabela de Preços na Nuvem
app.post('/api/cloud/tenants/:tenantId/pricing', (req, res) => {
  const { tenantId } = req.params;
  const { pricing } = req.body;
  const current = loadTenantData(tenantId);
  current.pricing = { ...current.pricing, ...pricing };
  current.updatedAt = Date.now();
  saveTenantData(tenantId, current);
  res.json({ success: true, pricing: current.pricing });
});

// Operações de Usuários / Operadores no Tenant (Exclusão e Atualização)
app.post('/api/cloud/tenants/:tenantId/user', (req, res) => {
  const { tenantId } = req.params;
  const { action, user, userId, email } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' });

  const current = loadTenantData(tenantId);
  current.users = current.users || [];
  const cleanEmail = (email || user?.email || '').toLowerCase().trim();
  const cleanId = userId || user?.id;

  if (action === 'delete') {
    current.users = current.users.filter((u: any) => {
      const uEmail = (u.email || '').toLowerCase().trim();
      const uId = u.id || '';
      if (cleanId && uId === cleanId) return false;
      if (cleanEmail && uEmail === cleanEmail) return false;
      return true;
    });

    const usersIdx = loadUsersIndex();
    if (cleanEmail && usersIdx[cleanEmail]) delete usersIdx[cleanEmail];
    if (cleanId && usersIdx[cleanId]) delete usersIdx[cleanId];
    saveUsersIndex(usersIdx);
  } else if (action === 'save' && user) {
    const idx = current.users.findIndex((u: any) => {
      const uEmail = (u.email || '').toLowerCase().trim();
      const uId = u.id || '';
      return (cleanId && uId === cleanId) || (cleanEmail && uEmail === cleanEmail);
    });
    const item = { ...user, tenantId };
    if (idx >= 0) {
      current.users[idx] = { ...current.users[idx], ...item };
    } else {
      current.users.push(item);
    }

    const usersIdx = loadUsersIndex();
    if (cleanEmail) usersIdx[cleanEmail] = item;
    if (cleanId) usersIdx[cleanId] = item;
    saveUsersIndex(usersIdx);
  }

  current.updatedAt = Date.now();
  saveTenantData(tenantId, current);
  res.json({ success: true, users: current.users });
});

app.post('/api/cloud/tenants/:tenantId/user/delete', (req, res) => {
  const { tenantId } = req.params;
  const { userId, email } = req.body;
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' });

  const current = loadTenantData(tenantId);
  current.users = current.users || [];
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanId = userId || '';

  current.users = current.users.filter((u: any) => {
    const uEmail = (u.email || '').toLowerCase().trim();
    const uId = u.id || '';
    if (cleanId && uId === cleanId) return false;
    if (cleanEmail && uEmail === cleanEmail) return false;
    return true;
  });

  const usersIdx = loadUsersIndex();
  if (cleanEmail && usersIdx[cleanEmail]) delete usersIdx[cleanEmail];
  if (cleanId && usersIdx[cleanId]) delete usersIdx[cleanId];
  saveUsersIndex(usersIdx);

  current.updatedAt = Date.now();
  saveTenantData(tenantId, current);
  res.json({ success: true, users: current.users });
});

// Cadastro e Resolução de Usuários / Operadores na Nuvem
app.get('/api/cloud/users/by-email/:email', (req, res) => {
  const rawEmail = (req.params.email || '').toLowerCase().trim();

  // Bloqueio explícito da conta desativada
  if (rawEmail === 'adm.cledson@gmail.com') {
    return res.status(403).json({
      success: false,
      message: 'A conta adm.cledson@gmail.com foi desativada e não está mais em uso. Utilize a conta oficial adm_cledison@outlook.com.',
    });
  }

  const cleanEmail = rawEmail;

  if (
    cleanEmail === 'adm_cledison@outlook.com' ||
    cleanEmail === 'admcledison@gmail.com' ||
    cleanEmail === 'adm_cledison@gmail.com'
  ) {
    const adminUser = {
      id: 'x9LtAZ0RAMTyOPmZelhVoyTDAVx2',
      name: 'Admcledison',
      email: 'adm_cledison@outlook.com',
      role: 'admin',
      tenantId: 'tenant_admcledison_gmail_com',
      adminEmail: 'adm_cledison@outlook.com',
      adminName: 'Admcledison',
      createdAt: 1791926468433,
      savedPassword: '123456',
    };
    return res.json({ success: true, user: adminUser });
  }

  if (
    cleanEmail === 'michel.lima20000@gmail.com' ||
    cleanEmail === 'michellimasilva979@gmail.com'
  ) {
    const michelUser = {
      id: '8vMouomTIqbZegeXq9DkT8bPPha2',
      name: 'Michel Lima',
      email: cleanEmail,
      role: 'admin',
      tenantId: 'tenant_drift_01',
      adminEmail: cleanEmail,
      adminName: 'Michel Lima',
      createdAt: 1791813452613,
      savedPassword: '123456',
    };
    return res.json({ success: true, user: michelUser });
  }

  const usersIdx = loadUsersIndex();
  const user = usersIdx[cleanEmail] || usersIdx[rawEmail];
  if (user) {
    return res.json({ success: true, user });
  }

  // Busca em todos os tenants
  const files = fs.readdirSync(TENANTS_DIR);
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const tenantData = JSON.parse(fs.readFileSync(path.join(TENANTS_DIR, file), 'utf-8'));
        const found = (tenantData.users || []).find(
          (u: any) => (u.email || '').toLowerCase().trim() === cleanEmail
        );
        if (found) {
          usersIdx[cleanEmail] = found;
          saveUsersIndex(usersIdx);
          return res.json({ success: true, user: found });
        }
      } catch {}
    }
  }

  if (cleanEmail === 'admcledison@gmail.com') {
    const adm = {
      id: 'usr_admcledison',
      name: 'Admcledison',
      email: 'admcledison@gmail.com',
      role: 'admin',
      tenantId: 'tenant_admcledison_gmail_com',
      createdAt: 1791725656602,
      savedPassword: '123456'
    };
    usersIdx[cleanEmail] = adm;
    saveUsersIndex(usersIdx);
    return res.json({ success: true, user: adm });
  }

  res.json({ success: false, message: 'Usuário não localizado' });
});

app.post('/api/cloud/users/register', (req, res) => {
  const { user } = req.body;
  if (!user || !user.email) return res.status(400).json({ error: 'Usuário inválido' });

  const cleanEmail = user.email.toLowerCase().trim();
  const tenantId = user.tenantId || user.id;

  // Atualiza no índice global
  const usersIdx = loadUsersIndex();
  usersIdx[cleanEmail] = { ...user, tenantId };
  if (user.id) usersIdx[user.id] = { ...user, tenantId };
  saveUsersIndex(usersIdx);

  // Atualiza no tenant correspondente
  const tenantData = loadTenantData(tenantId);
  tenantData.users = tenantData.users || [];
  const idx = tenantData.users.findIndex((u: any) => (u.email || '').toLowerCase() === cleanEmail);
  if (idx >= 0) {
    tenantData.users[idx] = { ...tenantData.users[idx], ...user, tenantId };
  } else {
    tenantData.users.push({ ...user, tenantId });
  }
  saveTenantData(tenantId, tenantData);

  res.json({ success: true, user: usersIdx[cleanEmail] });
});

// Alias para compatibilidade
app.post('/api/cloud-sync/user', (req, res) => {
  const user = req.body.user || req.body;
  if (!user || !user.email) return res.status(400).json({ error: 'Usuário inválido' });

  const cleanEmail = user.email.toLowerCase().trim();
  const tenantId = user.tenantId || user.id;

  const usersIdx = loadUsersIndex();
  usersIdx[cleanEmail] = { ...user, tenantId };
  if (user.id) usersIdx[user.id] = { ...user, tenantId };
  saveUsersIndex(usersIdx);

  const tenantData = loadTenantData(tenantId);
  tenantData.users = tenantData.users || [];
  const idx = tenantData.users.findIndex((u: any) => (u.email || '').toLowerCase() === cleanEmail);
  if (idx >= 0) {
    tenantData.users[idx] = { ...tenantData.users[idx], ...user, tenantId };
  } else {
    tenantData.users.push({ ...user, tenantId });
  }
  saveTenantData(tenantId, tenantData);

  res.json({ success: true, user: usersIdx[cleanEmail] });
});

// ============================================================================
// SERVIDOR WEB / VITE DEV MIDDLEWARE
// ============================================================================

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Drift Park Server rodando na porta ${PORT} (dev: ${isDev})`);
  });
}

startServer();

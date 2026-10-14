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
          } else {
            try {
              const currentT = JSON.parse(fs.readFileSync(tFile, 'utf-8'));
              if ((!currentT.vehicles || currentT.vehicles.length === 0) && raw.vehicles && raw.vehicles.length > 0) {
                currentT.vehicles = raw.vehicles;
                fs.writeFileSync(tFile, JSON.stringify(currentT, null, 2), 'utf-8');
              }
            } catch {}
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
      const parsed = JSON.parse(content);
      if ((!parsed.vehicles || parsed.vehicles.length === 0)) {
        const seedFile = path.join(__dirname, 'data', 'cloud-store.json');
        if (fs.existsSync(seedFile)) {
          const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
          const seedTenant = seed.tenants?.[tenantId] || seed.tenants?.[safeId];
          if (seedTenant?.vehicles && seedTenant.vehicles.length > 0) {
            parsed.vehicles = seedTenant.vehicles;
            fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
          }
        }
      }
      return parsed;
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

  // Mescla veículos existentes com novos
  if (Array.isArray(vehicles)) {
    const vMap = new Map();
    (current.vehicles || []).forEach((v: any) => vMap.set(v.id, v));
    vehicles.forEach((v: any) => {
      if (v && v.id) vMap.set(v.id, { ...v, tenantId });
    });
    current.vehicles = Array.from(vMap.values());
  }

  // Mescla corridas
  if (Array.isArray(rentals)) {
    const rMap = new Map();
    (current.rentals || []).forEach((r: any) => rMap.set(r.id, r));
    rentals.forEach((r: any) => {
      if (r && r.id) rMap.set(r.id, { ...r, tenantId });
    });
    current.rentals = Array.from(rMap.values()).sort(
      (a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  }

  // Mescla fila
  if (Array.isArray(queue)) {
    const qMap = new Map();
    (current.queue || []).forEach((q: any) => qMap.set(q.id, q));
    queue.forEach((q: any) => {
      if (q && q.id) qMap.set(q.id, { ...q, tenantId });
    });
    current.queue = Array.from(qMap.values()).sort(
      (a: any, b: any) => (a.addedAt || 0) - (b.addedAt || 0)
    );
  }

  // Mescla usuários / operadores da equipe
  if (Array.isArray(users)) {
    const uMap = new Map();
    (current.users || []).forEach((u: any) => {
      if (u && u.email) uMap.set(u.email.toLowerCase(), u);
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

// Cadastro e Resolução de Usuários / Operadores na Nuvem
app.get('/api/cloud/users/by-email/:email', (req, res) => {
  const rawEmail = (req.params.email || '').toLowerCase().trim();

  // Bloqueio explícito da conta desativada
  if (rawEmail === 'adm.cledson@gmail.com' || rawEmail === 'adm_cledson@gmail.com') {
    return res.status(403).json({
      success: false,
      message: 'A conta adm.cledson@gmail.com foi desativada e não está mais em uso. Utilize a conta oficial admcledison@gmail.com.',
    });
  }

  const cleanEmail = rawEmail === 'admcledison@gmail.com' ? 'admcledison@gmail.com' : rawEmail;

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

  if (cleanEmail === 'carollimap1993@gmail.com') {
    const op = {
      id: 'usr_op_carollimap1993',
      name: 'carollimap1993',
      email: 'carollimap1993@gmail.com',
      role: 'operador',
      tenantId: 'tenant_admcledison_gmail_com',
      adminEmail: 'admcledison@gmail.com',
      adminName: 'admcledison',
      createdAt: 1791804703979
    };
    usersIdx[cleanEmail] = op;
    saveUsersIndex(usersIdx);
    return res.json({ success: true, user: op });
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

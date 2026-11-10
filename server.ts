import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'db.json');

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  users: Record<string, UserRecord>; // keyed by email (lowercase) and userId
  userData: Record<string, Record<string, any>>; // keyed by userId -> { transactions, creditCards, ... }
  supabaseConfig?: {
    url: string;
    anonKey: string;
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || {},
        userData: parsed.userData || {},
        supabaseConfig: parsed.supabaseConfig,
      };
    }
  } catch (err) {
    console.error('Error loading database file, initializing empty db:', err);
  }
  return { users: {}, userData: {} };
}

function saveDatabase(db: DatabaseSchema) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// Global in-memory DB reference
let db = loadDatabase();

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    usersCount: Object.keys(db.users).length,
    hasSupabaseConfig: Boolean(db.supabaseConfig?.url && db.supabaseConfig?.anonKey),
  });
});

// Supabase Configuration Endpoints (Multi-device shared config)
app.get('/api/supabase-config', (_req: Request, res: Response) => {
  res.json({
    url: db.supabaseConfig?.url || process.env.VITE_SUPABASE_URL || '',
    anonKey: db.supabaseConfig?.anonKey || process.env.VITE_SUPABASE_ANON_KEY || '',
  });
});

app.post('/api/supabase-config', (req: Request, res: Response) => {
  const { url, anonKey } = req.body;
  db.supabaseConfig = {
    url: String(url || '').trim(),
    anonKey: String(anonKey || '').trim(),
  };
  saveDatabase(db);
  res.json({
    success: true,
    message: 'Configuração do Supabase salva no servidor e compartilhada entre dispositivos.',
  });
});

function toCanonicalUserId(identifier: string, emailHint?: string): string {
  const email = String(emailHint || identifier || '').trim().toLowerCase();
  if (email === 'demo@finanflow.app' || identifier === 'demo_user') {
    return 'demo_user';
  }
  if (email.includes('@')) {
    return `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  // Check if identifier matches a user record
  if (db.users[identifier]?.email) {
    return `usr_${db.users[identifier].email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  // Check values in db.users
  for (const u of Object.values(db.users)) {
    if (u && (u.id === identifier || u.email === identifier)) {
      return `usr_${u.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
  }
  if (identifier && identifier.startsWith('usr_')) {
    return identifier;
  }
  return identifier || 'guest';
}

function getUserDataBucket(canonicalId: string): Record<string, any> {
  if (!db.userData[canonicalId]) {
    db.userData[canonicalId] = {};
  }
  return db.userData[canonicalId];
}

// Helper to merge array entities by 'id'
const mergeArray = <T extends { id: string; updated_at?: string }>(
  clientArr: T[] = [],
  serverArr: T[] = []
): T[] => {
  const map = new Map<string, T>();
  // First put server items
  if (Array.isArray(serverArr)) {
    for (const item of serverArr) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }
  }
  // Then merge client items
  if (Array.isArray(clientArr)) {
    for (const item of clientArr) {
      if (item && item.id) {
        const existing = map.get(item.id);
        if (!existing) {
          map.set(item.id, item);
        } else {
          map.set(item.id, { ...existing, ...item });
        }
      }
    }
  }
  return Array.from(map.values());
};

// Bootstrap Endpoint: Client uploads its local accounts and data caches on startup
app.post('/api/sync/bootstrap', (req: Request, res: Response) => {
  const { accounts = [], currentUser, localStores = {} } = req.body;

  // 1. Register any accounts discovered in client storage
  if (Array.isArray(accounts)) {
    for (const acc of accounts) {
      if (acc && acc.email) {
        const email = String(acc.email).trim().toLowerCase();
        const cId = toCanonicalUserId(acc.id, email);
        if (!db.users[email]) {
          const u: UserRecord = {
            id: cId,
            email,
            displayName: acc.displayName || email.split('@')[0],
            password: acc.password,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          db.users[email] = u;
          db.users[cId] = u;
        }
      }
    }
  }

  if (currentUser && currentUser.email) {
    const email = String(currentUser.email).trim().toLowerCase();
    const cId = toCanonicalUserId(currentUser.id, email);
    if (!db.users[email]) {
      const u: UserRecord = {
        id: cId,
        email,
        displayName: currentUser.displayName || email.split('@')[0],
        password: currentUser.password,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users[email] = u;
      db.users[cId] = u;
    }
  }

  const idToEmailMap = new Map<string, string>();
  if (currentUser?.email) {
    if (currentUser.id) idToEmailMap.set(currentUser.id, currentUser.email);
    idToEmailMap.set(currentUser.email, currentUser.email);
  }
  if (Array.isArray(accounts)) {
    for (const acc of accounts) {
      if (acc && acc.email) {
        if (acc.id) idToEmailMap.set(acc.id, acc.email);
        idToEmailMap.set(acc.email, acc.email);
      }
    }
  }

  // 2. Merge all local stores into their canonical buckets
  for (const [storeKey, storeData] of Object.entries(localStores as Record<string, any>)) {
    if (!storeData || typeof storeData !== 'object') continue;
    const emailHint = idToEmailMap.get(storeKey) || (storeData as any).profile?.email || (storeData as any).profile?.user_id;
    const cId = toCanonicalUserId(storeKey, emailHint);
    const bucket = getUserDataBucket(cId);

    const sd = storeData as any;
    if (Array.isArray(sd.transactions) && sd.transactions.length > 0) {
      bucket.transactions = mergeArray(sd.transactions, bucket.transactions);
    }
    if (Array.isArray(sd.creditCards) && sd.creditCards.length > 0) {
      bucket.creditCards = mergeArray(sd.creditCards, bucket.creditCards);
    }
    if (Array.isArray(sd.purchases) && sd.purchases.length > 0) {
      bucket.purchases = mergeArray(sd.purchases, bucket.purchases);
    }
    if (Array.isArray(sd.installments) && sd.installments.length > 0) {
      bucket.installments = mergeArray(sd.installments, bucket.installments);
    }
    if (Array.isArray(sd.invoices) && sd.invoices.length > 0) {
      bucket.invoices = mergeArray(sd.invoices, bucket.invoices);
    }
    if (Array.isArray(sd.invoicePayments) && sd.invoicePayments.length > 0) {
      bucket.invoicePayments = mergeArray(sd.invoicePayments, bucket.invoicePayments);
    }
    if (Array.isArray(sd.recurringRules) && sd.recurringRules.length > 0) {
      bucket.recurringRules = mergeArray(sd.recurringRules, bucket.recurringRules);
    }
    if (Array.isArray(sd.recurringOccurrences) && sd.recurringOccurrences.length > 0) {
      bucket.recurringOccurrences = mergeArray(sd.recurringOccurrences, bucket.recurringOccurrences);
    }
    if (Array.isArray(sd.budgets) && sd.budgets.length > 0) {
      bucket.budgets = mergeArray(sd.budgets, bucket.budgets);
    }
    if (Array.isArray(sd.categories) && sd.categories.length > 0) {
      bucket.categories = mergeArray(sd.categories, bucket.categories);
    }
    if (sd.profile) {
      bucket.profile = { ...(bucket.profile || {}), ...sd.profile };
    }
    db.userData[cId] = bucket;
    if (storeKey !== cId) {
      db.userData[storeKey] = bucket;
    }
  }

  saveDatabase(db);
  return res.json({ success: true, message: 'Dados e contas locais integrados com a nuvem.' });
});

// Authentication: Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(name || '').trim() || trimmedEmail.split('@')[0];
  const canonicalId = toCanonicalUserId(trimmedEmail);

  let existing = db.users[trimmedEmail] || db.users[canonicalId];
  if (existing) {
    existing.displayName = trimmedName;
    existing.password = String(password);
    existing.updatedAt = new Date().toISOString();
    saveDatabase(db);
    return res.json({
      success: true,
      user: {
        id: canonicalId,
        email: existing.email,
        displayName: existing.displayName,
      },
      message: 'Conta atualizada com sucesso.',
    });
  }

  const newUser: UserRecord = {
    id: canonicalId,
    email: trimmedEmail,
    displayName: trimmedName,
    password: String(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.users[trimmedEmail] = newUser;
  db.users[canonicalId] = newUser;
  getUserDataBucket(canonicalId);
  saveDatabase(db);

  return res.json({
    success: true,
    user: {
      id: canonicalId,
      email: newUser.email,
      displayName: newUser.displayName,
    },
  });
});

// Authentication: Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const canonicalId = toCanonicalUserId(trimmedEmail);

  let user = db.users[trimmedEmail] || db.users[canonicalId];

  if (!user) {
    // Check if any user in db.users has this email
    for (const u of Object.values(db.users)) {
      if (u.email && u.email.toLowerCase() === trimmedEmail) {
        user = u;
        break;
      }
    }
  }

  if (!user) {
    // Auto-register user seamlessly on first login from any new device
    const displayName = trimmedEmail.split('@')[0];
    user = {
      id: canonicalId,
      email: trimmedEmail,
      displayName,
      password: String(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.users[trimmedEmail] = user;
    db.users[canonicalId] = user;
    getUserDataBucket(canonicalId);
    saveDatabase(db);
  }

  // Password verification: only reject if password was explicitly set and does not match
  if (user.password && String(user.password).trim() !== String(password).trim()) {
    return res.status(401).json({
      success: false,
      error: 'Senha incorreta. Verifique suas credenciais de acesso.',
    });
  }

  return res.json({
    success: true,
    user: {
      id: canonicalId,
      email: user.email,
      displayName: user.displayName,
    },
  });
});

// Update Profile & Credentials
app.post('/api/auth/update', (req: Request, res: Response) => {
  const { userId, email, displayName, newPassword } = req.body;
  const canonicalId = toCanonicalUserId(userId, email);

  let user = db.users[canonicalId] || (email ? db.users[String(email).toLowerCase()] : null);
  if (!user && userId) {
    user = db.users[userId];
  }

  if (!user) {
    return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
  }

  if (displayName && String(displayName).trim()) {
    user.displayName = String(displayName).trim();
  }
  if (newPassword && String(newPassword).trim()) {
    user.password = String(newPassword).trim();
  }
  user.updatedAt = new Date().toISOString();

  db.users[canonicalId] = user;
  if (user.email) {
    db.users[user.email.toLowerCase()] = user;
  }

  saveDatabase(db);

  return res.json({
    success: true,
    user: {
      id: canonicalId,
      email: user.email,
      displayName: user.displayName,
    },
    message: 'Credenciais atualizadas com sucesso no banco de dados.',
  });
});

// Get User Data
app.get('/api/user-data/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const emailHint = req.query.email as string | undefined;
  const canonicalId = toCanonicalUserId(userId, emailHint);
  const userData = getUserDataBucket(canonicalId);
  return res.json({ success: true, data: userData, canonicalId });
});

// Update specific entity (e.g. transactions, creditCards, etc.)
app.post('/api/user-data/:userId/entity/:entityName', (req: Request, res: Response) => {
  const { userId, entityName } = req.params;
  const { data, email } = req.body;
  const canonicalId = toCanonicalUserId(userId, email);

  const bucket = getUserDataBucket(canonicalId);
  bucket[entityName] = data;
  db.userData[canonicalId] = bucket;
  if (userId !== canonicalId) {
    db.userData[userId] = bucket;
  }

  saveDatabase(db);
  return res.json({ success: true, canonicalId });
});

// Sync full user data (merge client local state with server state)
app.post('/api/user-data/:userId/sync', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { data: clientData = {}, email } = req.body;
  const canonicalId = toCanonicalUserId(userId, email);

  const serverData = getUserDataBucket(canonicalId);

  // If server data was empty and client has data, take client data directly
  const isServerFresh = !serverData.transactions || serverData.transactions.length === 0;

  if (isServerFresh && clientData.transactions && clientData.transactions.length > 0) {
    serverData.transactions = clientData.transactions;
  } else {
    serverData.transactions = mergeArray(clientData.transactions, serverData.transactions);
  }

  serverData.creditCards = mergeArray(clientData.creditCards, serverData.creditCards);
  serverData.purchases = mergeArray(clientData.purchases, serverData.purchases);
  serverData.installments = mergeArray(clientData.installments, serverData.installments);
  serverData.invoices = mergeArray(clientData.invoices, serverData.invoices);
  serverData.invoicePayments = mergeArray(clientData.invoicePayments, serverData.invoicePayments);
  serverData.recurringRules = mergeArray(clientData.recurringRules, serverData.recurringRules);
  serverData.recurringOccurrences = mergeArray(clientData.recurringOccurrences, serverData.recurringOccurrences);
  serverData.budgets = mergeArray(clientData.budgets, serverData.budgets);

  // Merge profile & categories
  if (clientData.profile) {
    serverData.profile = { ...(serverData.profile || {}), ...clientData.profile };
  }
  if (Array.isArray(clientData.categories) && clientData.categories.length > 0) {
    serverData.categories = mergeArray(clientData.categories, serverData.categories);
  }

  db.userData[canonicalId] = serverData;
  if (userId !== canonicalId) {
    db.userData[userId] = serverData;
  }

  saveDatabase(db);

  return res.json({
    success: true,
    data: serverData,
    canonicalId,
    message: 'Dados sincronizados com o servidor com sucesso.',
  });
});

// Setup Vite or Static File Serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinanFlow Full-Stack Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FinanFlow server:', err);
  process.exit(1);
});

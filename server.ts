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

// Authentication: Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const trimmedName = String(name || '').trim() || trimmedEmail.split('@')[0];
  const localUserId = `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const existing = db.users[trimmedEmail] || db.users[localUserId];
  if (existing) {
    // If already registered with same email, update name if changed and return user
    existing.displayName = trimmedName;
    existing.password = String(password);
    existing.updatedAt = new Date().toISOString();
    saveDatabase(db);
    return res.json({
      success: true,
      user: {
        id: existing.id,
        email: existing.email,
        displayName: existing.displayName,
      },
      message: 'Conta atualizada com sucesso.',
    });
  }

  const newUser: UserRecord = {
    id: localUserId,
    email: trimmedEmail,
    displayName: trimmedName,
    password: String(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.users[trimmedEmail] = newUser;
  db.users[localUserId] = newUser;
  if (!db.userData[localUserId]) {
    db.userData[localUserId] = {};
  }

  saveDatabase(db);

  return res.json({
    success: true,
    user: {
      id: newUser.id,
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
  const localUserId = `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  let user = db.users[trimmedEmail] || db.users[localUserId];

  if (!user) {
    // Auto-register user seamlessly on first login if not found
    const displayName = trimmedEmail.split('@')[0];
    user = {
      id: localUserId,
      email: trimmedEmail,
      displayName,
      password: String(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.users[trimmedEmail] = user;
    db.users[localUserId] = user;
    if (!db.userData[localUserId]) {
      db.userData[localUserId] = {};
    }
    saveDatabase(db);
  }

  // Password verification
  if (user.password && user.password !== String(password)) {
    return res.status(401).json({
      success: false,
      error: 'Senha incorreta. Verifique suas credenciais de acesso.',
    });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  });
});

// Update Profile & Credentials
app.post('/api/auth/update', (req: Request, res: Response) => {
  const { userId, displayName, newPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'ID do usuário não fornecido.' });
  }

  const user = db.users[userId];
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

  // Keep email-keyed user in sync
  if (user.email && db.users[user.email]) {
    db.users[user.email] = { ...user };
  }

  saveDatabase(db);

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    message: 'Credenciais atualizadas com sucesso no banco de dados.',
  });
});

// Get User Data
app.get('/api/user-data/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const userData = db.userData[userId] || {};
  return res.json({ success: true, data: userData });
});

// Update specific entity (e.g. transactions, creditCards, etc.)
app.post('/api/user-data/:userId/entity/:entityName', (req: Request, res: Response) => {
  const { userId, entityName } = req.params;
  const { data } = req.body;

  if (!db.userData[userId]) {
    db.userData[userId] = {};
  }

  db.userData[userId][entityName] = data;
  saveDatabase(db);

  return res.json({ success: true });
});

// Sync full user data (merge client local state with server state)
app.post('/api/user-data/:userId/sync', (req: Request, res: Response) => {
  const { userId } = req.params;
  const clientData = req.body.data || {};

  if (!db.userData[userId]) {
    db.userData[userId] = {};
  }

  const serverData = db.userData[userId];

  // Helper to merge array entities by 'id'
  const mergeArray = <T extends { id: string; updated_at?: string }>(
    clientArr: T[] = [],
    serverArr: T[] = []
  ): T[] => {
    const map = new Map<string, T>();
    // First put server items
    for (const item of serverArr) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }
    // Then merge client items
    for (const item of clientArr) {
      if (item && item.id) {
        const existing = map.get(item.id);
        if (!existing) {
          map.set(item.id, item);
        } else {
          // If both exist, client or newer item wins
          map.set(item.id, { ...existing, ...item });
        }
      }
    }
    return Array.from(map.values());
  };

  // Merge each financial entity
  serverData.transactions = mergeArray(clientData.transactions, serverData.transactions);
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

  saveDatabase(db);

  return res.json({
    success: true,
    data: serverData,
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

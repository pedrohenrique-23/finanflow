import {
  Category,
  CreditCard,
  CreditCardPurchase,
  Installment,
  Invoice,
  InvoicePayment,
  MonthlyBudget,
  Profile,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
} from '../domain/types';
import { generateInstallments, toCents } from '../domain/finance';
import { getSupabaseClient } from './supabase';

const STORAGE_PREFIX = 'finanflow_data_';

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id' | 'user_id'>[] = [
  { name: 'Salário', type: 'income', icon: 'Briefcase', color: '#10b981', is_default: true, is_archived: false },
  { name: 'Freelance', type: 'income', icon: 'Laptop', color: '#06b6d4', is_default: true, is_archived: false },
  { name: 'Vendas', type: 'income', icon: 'ShoppingBag', color: '#8b5cf6', is_default: true, is_archived: false },
  { name: 'Rendimentos', type: 'income', icon: 'TrendingUp', color: '#3b82f6', is_default: true, is_archived: false },
  { name: 'Outros recebimentos', type: 'income', icon: 'PlusCircle', color: '#64748b', is_default: true, is_archived: false },
];

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id' | 'user_id'>[] = [
  { name: 'Moradia', type: 'expense', icon: 'Home', color: '#ef4444', is_default: true, is_archived: false },
  { name: 'Alimentação', type: 'expense', icon: 'Utensils', color: '#f97316', is_default: true, is_archived: false },
  { name: 'Transporte', type: 'expense', icon: 'Car', color: '#eab308', is_default: true, is_archived: false },
  { name: 'Saúde', type: 'expense', icon: 'HeartPulse', color: '#ec4899', is_default: true, is_archived: false },
  { name: 'Educação', type: 'expense', icon: 'GraduationCap', color: '#6366f1', is_default: true, is_archived: false },
  { name: 'Lazer', type: 'expense', icon: 'Film', color: '#a855f7', is_default: true, is_archived: false },
  { name: 'Assinaturas', type: 'expense', icon: 'Repeat', color: '#06b6d4', is_default: true, is_archived: false },
  { name: 'Compras', type: 'expense', icon: 'ShoppingCart', color: '#14b8a6', is_default: true, is_archived: false },
  { name: 'Contas e serviços', type: 'expense', icon: 'FileText', color: '#f43f5e', is_default: true, is_archived: false },
  { name: 'Outros gastos', type: 'expense', icon: 'MoreHorizontal', color: '#64748b', is_default: true, is_archived: false },
];

export interface AppDataState {
  profile: Profile;
  categories: Category[];
  creditCards: CreditCard[];
  purchases: CreditCardPurchase[];
  installments: Installment[];
  invoices: Invoice[];
  invoicePayments: InvoicePayment[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  recurringOccurrences: RecurringOccurrence[];
  budgets: MonthlyBudget[];
}

function getLocalKey(userId: string, entity: string): string {
  return `${STORAGE_PREFIX}${userId}_${entity}`;
}

export function loadLocalState(userId: string): AppDataState {
  const load = <T>(key: string, fallback: T): T => {
    try {
      const data = localStorage.getItem(getLocalKey(userId, key));
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  };

  const savedCustomName = (() => {
    try {
      const byId = localStorage.getItem(`finanflow_display_name_${userId}`);
      if (byId && byId.trim()) return byId.trim();
      const rawAccounts = localStorage.getItem('finanflow_registered_accounts');
      if (rawAccounts) {
        const map = JSON.parse(rawAccounts);
        if (map[userId]?.displayName?.trim()) return map[userId].displayName.trim();
      }
    } catch {}
    return null;
  })();

  const defaultProfile: Profile = {
    id: `prof_${userId}`,
    user_id: userId,
    display_name: savedCustomName || (userId === 'demo_user' ? 'Pedro Silva' : 'Usuário'),
    initial_balance_cents: 0,
    start_date: new Date().toISOString().split('T')[0],
    theme: 'dark',
    timezone: 'America/Fortaleza',
    currency: 'BRL',
    onboarding_completed: false,
  };

  const profile = load<Profile>('profile', defaultProfile);
  if (savedCustomName && profile.display_name !== savedCustomName) {
    profile.display_name = savedCustomName;
  }

  // Initialize categories if empty
  let categories = load<Category[]>('categories', []);
  if (categories.length === 0) {
    const initIncomes: Category[] = DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
      ...c,
      id: `cat_inc_${i + 1}`,
      user_id: userId,
    }));
    const initExpenses: Category[] = DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
      ...c,
      id: `cat_exp_${i + 1}`,
      user_id: userId,
    }));
    categories = [...initIncomes, ...initExpenses];
    localStorage.setItem(getLocalKey(userId, 'categories'), JSON.stringify(categories));
  }

  return {
    profile,
    categories,
    creditCards: load<CreditCard[]>('creditCards', []),
    purchases: load<CreditCardPurchase[]>('purchases', []),
    installments: load<Installment[]>('installments', []),
    invoices: load<Invoice[]>('invoices', []),
    invoicePayments: load<InvoicePayment[]>('invoicePayments', []),
    transactions: load<Transaction[]>('transactions', []),
    recurringRules: load<RecurringRule[]>('recurringRules', []),
    recurringOccurrences: load<RecurringOccurrence[]>('recurringOccurrences', []),
    budgets: load<MonthlyBudget[]>('budgets', []),
  };
}

// ====================================================================
// Sincronização com Supabase
//
// O localStorage é um cache local (abre rápido e funciona offline).
// Toda gravação registra as linhas alteradas/removidas numa fila
// persistente, que é enviada ao Supabase assim que houver sessão.
// Ao carregar, o Supabase é a fonte da verdade.
// ====================================================================

type EntityName =
  | 'categories'
  | 'creditCards'
  | 'purchases'
  | 'installments'
  | 'invoices'
  | 'invoicePayments'
  | 'transactions'
  | 'recurringRules'
  | 'recurringOccurrences'
  | 'budgets';

const ENTITY_TABLES: Record<EntityName, { table: string; columns: string[] }> = {
  categories: {
    table: 'categories',
    columns: ['id', 'name', 'type', 'icon', 'color', 'is_default', 'is_archived', 'created_at'],
  },
  creditCards: {
    table: 'credit_cards',
    columns: ['id', 'name', 'issuer', 'limit_cents', 'closing_day', 'due_day', 'color', 'is_archived', 'created_at'],
  },
  purchases: {
    table: 'credit_card_purchases',
    columns: [
      'id', 'card_id', 'description', 'total_amount_cents', 'purchase_date', 'category_id',
      'installments_count', 'notes', 'created_at',
    ],
  },
  installments: {
    table: 'installments',
    columns: [
      'id', 'purchase_id', 'card_id', 'installment_number', 'total_installments', 'amount_cents',
      'cycle_year_month', 'due_date', 'is_liquidated', 'invoice_id',
    ],
  },
  invoices: {
    table: 'invoices',
    columns: [
      'id', 'card_id', 'year_month', 'closing_date', 'due_date', 'total_amount_cents',
      'paid_amount_cents', 'status', 'created_at',
    ],
  },
  invoicePayments: {
    table: 'invoice_payments',
    columns: ['id', 'invoice_id', 'card_id', 'amount_cents', 'payment_date', 'notes', 'created_at'],
  },
  transactions: {
    table: 'transactions',
    columns: [
      'id', 'description', 'amount_cents', 'type', 'category_id', 'date', 'due_date', 'payment_date',
      'status', 'notes', 'payment_method', 'is_recurring', 'recurring_rule_id', 'origin_id',
      'is_invoice_payment', 'created_at',
    ],
  },
  recurringRules: {
    table: 'recurring_rules',
    columns: [
      'id', 'description', 'amount_cents', 'type', 'category_id', 'frequency', 'day_of_month',
      'start_date', 'end_date', 'is_active', 'created_at',
    ],
  },
  recurringOccurrences: {
    table: 'recurring_occurrences',
    columns: [
      'id', 'rule_id', 'year_month', 'expected_date', 'amount_cents', 'status', 'transaction_id', 'created_at',
    ],
  },
  budgets: {
    table: 'monthly_budgets',
    columns: ['id', 'year_month', 'category_id', 'limit_cents', 'created_at'],
  },
};

const ENTITY_NAMES = Object.keys(ENTITY_TABLES) as EntityName[];

const PROFILE_COLUMNS = [
  'display_name', 'initial_balance_cents', 'start_date', 'theme', 'timezone', 'currency', 'onboarding_completed',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only Supabase Auth users (UUID ids) are synced; the demo account stays local. */
export function isCloudUserId(userId: string): boolean {
  return UUID_RE.test(userId);
}

interface PendingOps {
  upsert: string[];
  delete: string[];
}

interface PendingQueue {
  entities: Partial<Record<EntityName, PendingOps>>;
  profile?: boolean;
}

function pendingKey(userId: string) {
  return `finanflow_pending_sync_${userId}`;
}

function readQueue(userId: string): PendingQueue {
  try {
    const raw = localStorage.getItem(pendingKey(userId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { entities: {} };
}

function writeQueue(userId: string, queue: PendingQueue) {
  try {
    const empty = !queue.profile && Object.keys(queue.entities).length === 0;
    if (empty) localStorage.removeItem(pendingKey(userId));
    else localStorage.setItem(pendingKey(userId), JSON.stringify(queue));
  } catch {}
}

function enqueue(userId: string, entity: EntityName | 'profile', upsertIds: string[] = [], deleteIds: string[] = []) {
  const queue = readQueue(userId);
  if (entity === 'profile') {
    queue.profile = true;
  } else {
    const ops = queue.entities[entity] || { upsert: [], delete: [] };
    const up = new Set(ops.upsert);
    const del = new Set(ops.delete);
    for (const id of upsertIds) {
      up.add(id);
      del.delete(id);
    }
    for (const id of deleteIds) {
      del.add(id);
      up.delete(id);
    }
    if (up.size > 0 || del.size > 0) {
      queue.entities[entity] = { upsert: [...up], delete: [...del] };
    }
  }
  writeQueue(userId, queue);
}

export function hasPendingSync(userId: string): boolean {
  const q = readQueue(userId);
  return Boolean(q.profile) || Object.keys(q.entities).length > 0;
}

function readLocalArray<T>(userId: string, entity: string): T[] {
  try {
    const raw = localStorage.getItem(getLocalKey(userId, entity));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toRow(userId: string, item: Record<string, any>, columns: string[]): Record<string, any> {
  const row: Record<string, any> = { user_id: userId, updated_at: new Date().toISOString() };
  for (const col of columns) {
    if (!(col in item) || item[col] === undefined) continue;
    const v = item[col];
    row[col] = v === '' ? null : v;
  }
  return row;
}

/** Postgres returns NULL for optional fields; the app expects them to be absent. */
function fromRow<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null) out[k] = v;
  }
  return out as T;
}

let flushChain: Promise<boolean> = Promise.resolve(true);

/** Sends queued changes to Supabase. Resolves true when the queue is empty afterwards. */
export function flushPendingSync(userId: string): Promise<boolean> {
  flushChain = flushChain.then(() => doFlush(userId)).catch(() => false);
  return flushChain;
}

async function doFlush(userId: string): Promise<boolean> {
  if (!isCloudUserId(userId)) return true;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id !== userId) return false;

  const queue = readQueue(userId);

  if (queue.profile) {
    try {
      const raw = localStorage.getItem(getLocalKey(userId, 'profile'));
      if (raw) {
        const profile = JSON.parse(raw);
        const { error } = await supabase
          .from('profiles')
          .upsert(toRow(userId, profile, PROFILE_COLUMNS), { onConflict: 'user_id', defaultToNull: false });
        if (error) throw error;
      }
      const q = readQueue(userId);
      delete q.profile;
      writeQueue(userId, q);
    } catch (err) {
      console.warn('[Sync] Falha ao enviar perfil:', err);
    }
  }

  for (const entity of Object.keys(queue.entities) as EntityName[]) {
    const ops = queue.entities[entity];
    if (!ops) continue;
    const { table, columns } = ENTITY_TABLES[entity];
    try {
      if (ops.delete.length > 0) {
        const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', ops.delete);
        if (error) throw error;
      }
      if (ops.upsert.length > 0) {
        const wanted = new Set(ops.upsert);
        const rows = readLocalArray<Record<string, any>>(userId, entity)
          .filter((item) => item && wanted.has(item.id))
          .map((item) => toRow(userId, item, columns));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase
            .from(table)
            .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,id', defaultToNull: false });
          if (error) throw error;
        }
      }
      // Remove only what was sent; newer changes queued meanwhile are kept.
      const q = readQueue(userId);
      const current = q.entities[entity];
      if (current) {
        const sentUp = new Set(ops.upsert);
        const sentDel = new Set(ops.delete);
        const rest: PendingOps = {
          upsert: current.upsert.filter((id) => !sentUp.has(id)),
          delete: current.delete.filter((id) => !sentDel.has(id)),
        };
        if (rest.upsert.length === 0 && rest.delete.length === 0) delete q.entities[entity];
        else q.entities[entity] = rest;
        writeQueue(userId, q);
      }
    } catch (err) {
      console.warn(`[Sync] Falha ao enviar ${entity}:`, err);
    }
  }

  return !hasPendingSync(userId);
}

export function saveLocalEntity<T>(userId: string, entityName: string, data: T): void {
  const previous = Array.isArray(data) ? readLocalArray<any>(userId, entityName) : null;

  try {
    localStorage.setItem(getLocalKey(userId, entityName), JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save ${entityName} locally:`, err);
  }

  if (!isCloudUserId(userId)) return;

  if (entityName === 'profile') {
    enqueue(userId, 'profile');
  } else if (entityName in ENTITY_TABLES && Array.isArray(data) && previous) {
    const prevById = new Map<string, string>();
    for (const item of previous) if (item?.id) prevById.set(item.id, JSON.stringify(item));
    const nextIds = new Set<string>();
    const changed: string[] = [];
    for (const item of data as any[]) {
      if (!item?.id) continue;
      nextIds.add(item.id);
      if (prevById.get(item.id) !== JSON.stringify(item)) changed.push(item.id);
    }
    const removed = [...prevById.keys()].filter((id) => !nextIds.has(id));
    enqueue(userId, entityName as EntityName, changed, removed);
  } else {
    return;
  }

  flushPendingSync(userId);
}

/**
 * Data created before Supabase Auth was used is stored under a legacy id
 * ("usr_<email>"). Copy it to the Supabase user id so it can be uploaded.
 */
export function adoptLegacyLocalData(newUserId: string, email: string): void {
  const normalized = email.trim().toLowerCase();
  const legacyIds = [`usr_${normalized.replace(/[^a-zA-Z0-9]/g, '_')}`, normalized];
  const entities = ['profile', ...ENTITY_NAMES];

  const hasData = (id: string) =>
    ENTITY_NAMES.some((e) => e !== 'categories' && readLocalArray(id, e).length > 0);

  if (hasData(newUserId)) return;

  for (const legacyId of legacyIds) {
    if (!hasData(legacyId)) continue;
    for (const entity of entities) {
      const raw = localStorage.getItem(getLocalKey(legacyId, entity));
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const rewritten = Array.isArray(parsed)
          ? parsed.map((item) => ({ ...item, user_id: newUserId }))
          : { ...parsed, user_id: newUserId, id: `prof_${newUserId}` };
        localStorage.setItem(getLocalKey(newUserId, entity), JSON.stringify(rewritten));
      } catch {}
    }
    if (localStorage.getItem(`finanflow_onboarding_completed_${legacyId}`) === 'true') {
      localStorage.setItem(`finanflow_onboarding_completed_${newUserId}`, 'true');
    }
    return;
  }
}

function writeCache(userId: string, state: AppDataState) {
  const entries: [string, unknown][] = [['profile', state.profile], ...ENTITY_NAMES.map((e) => [e, state[e]] as [string, unknown])];
  for (const [entity, value] of entries) {
    try {
      localStorage.setItem(getLocalKey(userId, entity), JSON.stringify(value));
    } catch {}
  }
}

function migratedKey(userId: string) {
  return `finanflow_cloud_merged_${userId}`;
}


function pickEntities(remote: Record<string, any[]>): Partial<AppDataState> {
  const out: Record<string, any[]> = {};
  for (const e of ENTITY_NAMES) out[e] = remote[e];
  return out as Partial<AppDataState>;
}

/**
 * Service to manage all persistent CRUD operations seamlessly
 */
export const DataRepository = {
  async loadAll(userId: string): Promise<AppDataState> {
    const local = loadLocalState(userId);
    if (!isCloudUserId(userId)) return local;

    const supabase = getSupabaseClient();
    if (!supabase) return local;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user.id !== userId) return local;

      // Primeiro acesso deste aparelho: envia tudo que existe só aqui
      // (dados criados antes da sincronização) sem sobrescrever a nuvem.
      const firstMerge = localStorage.getItem(migratedKey(userId)) !== 'true';

      await flushPendingSync(userId);

      const tables = ENTITY_NAMES.map((e) => ENTITY_TABLES[e].table);
      const results = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        ...tables.map((t) => supabase.from(t).select('*').eq('user_id', userId)),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      const [profRes, ...entityRes] = results;
      const remote: Record<string, any[]> = {};
      ENTITY_NAMES.forEach((e, i) => {
        remote[e] = ((entityRes[i].data as any[]) || []).map((r) => fromRow(r));
      });
      const remoteProfile = profRes.data ? fromRow<Partial<Profile>>(profRes.data as any) : null;

      if (firstMerge) {
        let queued = false;
        for (const e of ENTITY_NAMES) {
          const remoteIds = new Set(remote[e].map((r) => r.id));
          const missing = (local[e] as any[]).filter((item) => item?.id && !remoteIds.has(item.id));
          if (missing.length > 0) {
            enqueue(userId, e, missing.map((m) => m.id));
            remote[e] = [...remote[e], ...missing];
            queued = true;
          }
        }
        const localIsRicher =
          !remoteProfile ||
          (!remoteProfile.onboarding_completed && !remoteProfile.initial_balance_cents &&
            (local.profile.onboarding_completed || local.profile.initial_balance_cents > 0));
        if (localIsRicher) {
          enqueue(userId, 'profile');
          queued = true;
        }
        if (queued) await flushPendingSync(userId);
        if (!hasPendingSync(userId)) localStorage.setItem(migratedKey(userId), 'true');
        if (localIsRicher) {
          return this._finish(userId, { ...local, ...pickEntities(remote) });
        }
      }

      const merged: AppDataState = {
        ...local,
        ...pickEntities(remote),
        profile: remoteProfile
          ? { ...local.profile, ...remoteProfile, id: local.profile.id, user_id: userId }
          : local.profile,
      };
      if (merged.categories.length === 0) merged.categories = local.categories;

      return this._finish(userId, merged);
    } catch (err) {
      console.warn('[Sync] Supabase indisponível, usando cache local:', err);
      return local;
    }
  },

  /** Keeps local edits that are still waiting to be uploaded, then caches the result. */
  _finish(userId: string, state: AppDataState): AppDataState {
    const queue = readQueue(userId);
    const fresh = loadLocalState(userId);
    const result: AppDataState = { ...state };
    for (const e of Object.keys(queue.entities) as EntityName[]) {
      (result as any)[e] = fresh[e];
    }
    if (queue.profile) result.profile = fresh.profile;
    writeCache(userId, result);
    return result;
  },

  async saveProfile(profile: Profile): Promise<void> {
    saveLocalEntity(profile.user_id, 'profile', profile);
    try {
      if (profile.display_name && profile.display_name.trim()) {
        localStorage.setItem(`finanflow_display_name_${profile.user_id}`, profile.display_name.trim());
      }
    } catch {}
  },

  async saveTransaction(userId: string, tx: Transaction, allTx: Transaction[]): Promise<Transaction[]> {
    const existingIndex = allTx.findIndex((t) => t.id === tx.id);
    let updated: Transaction[];
    if (existingIndex >= 0) {
      updated = [...allTx];
      updated[existingIndex] = tx;
    } else {
      updated = [tx, ...allTx];
    }

    saveLocalEntity(userId, 'transactions', updated);

    return updated;
  },

  async deleteTransaction(userId: string, txId: string, allTx: Transaction[]): Promise<Transaction[]> {
    const updated = allTx.filter((t) => t.id !== txId);
    saveLocalEntity(userId, 'transactions', updated);

    return updated;
  },

  async saveCard(userId: string, card: CreditCard, allCards: CreditCard[]): Promise<CreditCard[]> {
    const index = allCards.findIndex((c) => c.id === card.id);
    let updated: CreditCard[];
    if (index >= 0) {
      updated = [...allCards];
      updated[index] = card;
    } else {
      updated = [...allCards, card];
    }

    saveLocalEntity(userId, 'creditCards', updated);
    return updated;
  },

  async addCreditCardPurchase(params: {
    userId: string;
    card: CreditCard;
    description: string;
    totalAmountCents: number;
    purchaseDate: string;
    categoryId: string;
    installmentsCount: number;
    notes?: string;
    existingPurchases: CreditCardPurchase[];
    existingInstallments: Installment[];
  }) {
    const {
      userId,
      card,
      description,
      totalAmountCents,
      purchaseDate,
      categoryId,
      installmentsCount,
      notes,
      existingPurchases,
      existingInstallments,
    } = params;

    const purchaseId = `purch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const purchase: CreditCardPurchase = {
      id: purchaseId,
      user_id: userId,
      card_id: card.id,
      description,
      total_amount_cents: totalAmountCents,
      purchase_date: purchaseDate,
      category_id: categoryId,
      installments_count: installmentsCount,
      notes,
    };

    const newInstallments = generateInstallments({
      purchaseId,
      userId,
      cardId: card.id,
      totalAmountCents,
      installmentsCount,
      purchaseDate,
      closingDay: card.closing_day,
      dueDay: card.due_day,
    });

    const updatedPurchases = [purchase, ...existingPurchases];
    const updatedInstallments = [...existingInstallments, ...newInstallments];

    saveLocalEntity(userId, 'purchases', updatedPurchases);
    saveLocalEntity(userId, 'installments', updatedInstallments);


    return {
      purchases: updatedPurchases,
      installments: updatedInstallments,
    };
  },

  async updateCreditCardPurchase(params: {
    userId: string;
    card: CreditCard;
    purchaseId: string;
    description: string;
    totalAmountCents: number;
    purchaseDate: string;
    categoryId: string;
    installmentsCount: number;
    notes?: string;
    existingPurchases: CreditCardPurchase[];
    existingInstallments: Installment[];
  }) {
    const {
      userId,
      card,
      purchaseId,
      description,
      totalAmountCents,
      purchaseDate,
      categoryId,
      installmentsCount,
      notes,
      existingPurchases,
      existingInstallments,
    } = params;

    const existingPurchase = existingPurchases.find((p) => p.id === purchaseId);
    const updatedPurchase: CreditCardPurchase = {
      id: purchaseId,
      user_id: userId,
      card_id: card.id,
      description,
      total_amount_cents: totalAmountCents,
      purchase_date: purchaseDate,
      category_id: categoryId,
      installments_count: installmentsCount,
      notes,
      created_at: existingPurchase?.created_at,
    };

    const newInstallments = generateInstallments({
      purchaseId,
      userId,
      cardId: card.id,
      totalAmountCents,
      installmentsCount,
      purchaseDate,
      closingDay: card.closing_day,
      dueDay: card.due_day,
    });

    const updatedPurchases = existingPurchases.map((p) => (p.id === purchaseId ? updatedPurchase : p));
    const otherInstallments = existingInstallments.filter((i) => i.purchase_id !== purchaseId);
    const updatedInstallments = [...otherInstallments, ...newInstallments];

    saveLocalEntity(userId, 'purchases', updatedPurchases);
    saveLocalEntity(userId, 'installments', updatedInstallments);


    return {
      purchases: updatedPurchases,
      installments: updatedInstallments,
    };
  },

  async deleteCreditCardPurchase(params: {
    userId: string;
    purchaseId: string;
    existingPurchases: CreditCardPurchase[];
    existingInstallments: Installment[];
  }) {
    const { userId, purchaseId, existingPurchases, existingInstallments } = params;

    const updatedPurchases = existingPurchases.filter((p) => p.id !== purchaseId);
    const updatedInstallments = existingInstallments.filter((i) => i.purchase_id !== purchaseId);

    saveLocalEntity(userId, 'purchases', updatedPurchases);
    saveLocalEntity(userId, 'installments', updatedInstallments);


    return {
      purchases: updatedPurchases,
      installments: updatedInstallments,
    };
  },

  async saveRecurringRule(userId: string, rule: RecurringRule, allRules: RecurringRule[]): Promise<RecurringRule[]> {
    const index = allRules.findIndex((r) => r.id === rule.id);
    let updated: RecurringRule[];
    if (index >= 0) {
      updated = [...allRules];
      updated[index] = rule;
    } else {
      updated = [rule, ...allRules];
    }

    saveLocalEntity(userId, 'recurringRules', updated);
    return updated;
  },

  async deleteRecurringRule(
    userId: string,
    ruleId: string,
    allRules: RecurringRule[],
    allOccurrences: RecurringOccurrence[]
  ): Promise<{ rules: RecurringRule[]; occurrences: RecurringOccurrence[] }> {
    const updatedRules = allRules.filter((r) => r.id !== ruleId);
    // Keep confirmed occurrences (which already resulted in transactions) and remove pending/dismissed
    const updatedOccs = allOccurrences.filter((o) => o.rule_id !== ruleId || o.status === 'confirmed');

    saveLocalEntity(userId, 'recurringRules', updatedRules);
    saveLocalEntity(userId, 'recurringOccurrences', updatedOccs);

    return { rules: updatedRules, occurrences: updatedOccs };
  },

  async recordInvoicePayment(params: {
    userId: string;
    invoice: Invoice;
    amountCents: number;
    paymentDate: string;
    notes?: string;
    existingPayments: InvoicePayment[];
    existingInvoices: Invoice[];
    existingInstallments: Installment[];
    existingTransactions: Transaction[];
  }) {
    const {
      userId,
      invoice,
      amountCents,
      paymentDate,
      notes,
      existingPayments,
      existingInvoices,
      existingInstallments,
      existingTransactions,
    } = params;

    const paymentId = `inv_pay_${Date.now()}`;
    const payment: InvoicePayment = {
      id: paymentId,
      user_id: userId,
      invoice_id: invoice.id,
      card_id: invoice.card_id,
      amount_cents: amountCents,
      payment_date: paymentDate,
      notes,
    };

    const newPaidAmount = invoice.paid_amount_cents + amountCents;
    const isFullyPaid = newPaidAmount >= invoice.total_amount_cents;

    const updatedInvoice: Invoice = {
      ...invoice,
      paid_amount_cents: newPaidAmount,
      status: isFullyPaid ? 'paid' : 'partially_paid',
    };

    // Update invoices list
    const updatedInvoices = existingInvoices.map((inv) =>
      inv.id === invoice.id ? updatedInvoice : inv
    );

    // Liquidate installments if fully paid
    let updatedInstallments = existingInstallments;
    if (isFullyPaid) {
      updatedInstallments = existingInstallments.map((inst) => {
        if (inst.card_id === invoice.card_id && inst.cycle_year_month === invoice.year_month) {
          return { ...inst, is_liquidated: true };
        }
        return inst;
      });
      saveLocalEntity(userId, 'installments', updatedInstallments);
    }

    // Record cash-flow reduction transaction for the bank account
    // CRITICAL: is_invoice_payment = true ensures this does NOT count as a consumption expense!
    const txPayment: Transaction = {
      id: `tx_${paymentId}`,
      user_id: userId,
      description: `Pagamento de Fatura (${invoice.year_month})`,
      amount_cents: amountCents,
      type: 'expense',
      category_id: 'cat_invoice_payment',
      date: paymentDate,
      status: 'completed',
      payment_method: 'account',
      is_invoice_payment: true,
      origin_id: invoice.id,
    };

    const updatedPayments = [payment, ...existingPayments];
    const updatedTransactions = [txPayment, ...existingTransactions];

    saveLocalEntity(userId, 'invoicePayments', updatedPayments);
    saveLocalEntity(userId, 'invoices', updatedInvoices);
    saveLocalEntity(userId, 'transactions', updatedTransactions);


    return {
      payments: updatedPayments,
      invoices: updatedInvoices,
      installments: updatedInstallments,
      transactions: updatedTransactions,
    };
  },
};

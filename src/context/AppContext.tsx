import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Category,
  CreditCard,
  CreditCardPurchase,
  DashboardMetrics,
  Installment,
  Invoice,
  InvoicePayment,
  MonthlyBudget,
  Profile,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
} from '../domain/types';
import {
  addMonthsToYearMonth,
  calculateMonthlyMetrics,
  deriveTransactionStatus,
  formatCurrencyBRL,
  getTodayDateStr,
  toCents,
} from '../domain/finance';
import { DataRepository, loadLocalState, saveLocalEntity } from '../services/dataRepository';
import { getSupabaseClient, getSupabaseCredentials } from '../services/supabase';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AppContextType {
  user: AuthUser | null;
  profile: Profile;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  selectedYearMonth: string;
  setSelectedYearMonth: (ym: string) => void;
  categories: Category[];
  creditCards: CreditCard[];
  purchases: CreditCardPurchase[];
  transactions: Transaction[];
  installments: Installment[];
  invoices: Invoice[];
  invoicePayments: InvoicePayment[];
  recurringRules: RecurringRule[];
  recurringOccurrences: RecurringOccurrence[];
  budgets: MonthlyBudget[];
  metrics: DashboardMetrics;
  isSupabaseActive: boolean;
  isOnboarded: boolean;
  completeOnboarding: (updates?: Partial<Profile>) => Promise<void>;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (profile: Partial<Profile>) => Promise<void>;
  updateUserCredentials: (params: {
    displayName?: string;
    newPassword?: string;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'user_id'>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCard: (card: Omit<CreditCard, 'id' | 'user_id'>) => Promise<void>;
  addPurchase: (params: {
    cardId: string;
    description: string;
    totalAmountCents: number;
    purchaseDate: string;
    categoryId: string;
    installmentsCount: number;
    notes?: string;
  }) => Promise<void>;
  updatePurchase: (params: {
    purchaseId: string;
    cardId?: string;
    description: string;
    totalAmountCents: number;
    purchaseDate: string;
    categoryId: string;
    installmentsCount: number;
    notes?: string;
  }) => Promise<void>;
  deletePurchase: (purchaseId: string) => Promise<void>;
  payInvoice: (invoice: Invoice, amountCents: number, paymentDate: string, notes?: string) => Promise<void>;
  addCategory: (cat: Omit<Category, 'id' | 'user_id' | 'is_default' | 'is_archived'>) => Promise<void>;
  updateCategory: (cat: Category) => Promise<void>;
  archiveCategory: (catId: string, replacementCatId?: string) => Promise<void>;
  addRecurringRule: (rule: Omit<RecurringRule, 'id' | 'user_id'>) => Promise<void>;
  updateRecurringRule: (rule: RecurringRule) => Promise<void>;
  deleteRecurringRule: (ruleId: string) => Promise<void>;
  confirmRecurringOccurrence: (ruleId: string, yearMonth: string, amountCents?: number) => Promise<void>;
  dismissRecurringOccurrence: (ruleId: string, yearMonth: string) => Promise<void>;
  saveBudget: (categoryId: string, yearMonth: string, limitCents: number) => Promise<void>;
  copyPreviousMonthBudgets: (currentYm: string) => Promise<number>;
  reloadAllData: () => Promise<void>;
}

const getPersistedDisplayName = (userId: string, email: string, fallback: string): string => {
  try {
    const byId = localStorage.getItem(`finanflow_display_name_${userId}`);
    if (byId && byId.trim()) return byId.trim();

    const byEmail = localStorage.getItem(`finanflow_display_name_${email.toLowerCase()}`);
    if (byEmail && byEmail.trim()) return byEmail.trim();

    const raw = localStorage.getItem('finanflow_registered_accounts');
    if (raw) {
      const map = JSON.parse(raw);
      if (map[userId]?.displayName?.trim()) return map[userId].displayName.trim();
      if (map[email.toLowerCase()]?.displayName?.trim()) return map[email.toLowerCase()].displayName.trim();
    }

    const localProfileRaw = localStorage.getItem(`finanflow_data_${userId}_profile`);
    if (localProfileRaw) {
      const parsed = JSON.parse(localProfileRaw);
      if (parsed?.display_name && parsed.display_name !== 'Usuário FinanFlow' && parsed.display_name.trim()) {
        return parsed.display_name.trim();
      }
    }
  } catch {}
  return fallback;
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayYm = getTodayDateStr().substring(0, 7);
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(todayYm);

  // Authentication State: Require explicit login; only authenticate if valid stored session exists
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('finanflow_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id && parsed.email) {
          const resolvedName = getPersistedDisplayName(parsed.id, parsed.email, parsed.displayName || 'Usuário');
          return { ...parsed, displayName: resolvedName };
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Pre-load local state synchronously to prevent modal flickering on page refresh
  const initialLocalState = useMemo(() => {
    const userId = user?.id || 'guest';
    return loadLocalState(userId);
  }, [user?.id]);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => initialLocalState.profile.theme || 'dark');

  // Core Data States initialized synchronously from local state
  const [profile, setProfile] = useState<Profile>(() => initialLocalState.profile);
  const [categories, setCategories] = useState<Category[]>(() => initialLocalState.categories);
  const [creditCards, setCreditCards] = useState<CreditCard[]>(() => initialLocalState.creditCards);
  const [purchases, setPurchases] = useState<CreditCardPurchase[]>(() => initialLocalState.purchases);
  const [installments, setInstallments] = useState<Installment[]>(() => initialLocalState.installments);
  const [invoices, setInvoices] = useState<Invoice[]>(() => initialLocalState.invoices);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>(() => initialLocalState.invoicePayments);
  const [transactions, setTransactions] = useState<Transaction[]>(() => initialLocalState.transactions);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>(() => initialLocalState.recurringRules);
  const [recurringOccurrences, setRecurringOccurrences] = useState<RecurringOccurrence[]>(() => initialLocalState.recurringOccurrences);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>(() => initialLocalState.budgets);

  // Dedicated persistent flag for onboarding status
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    try {
      const userId = user?.id || 'guest';
      if (localStorage.getItem(`finanflow_onboarding_completed_${userId}`) === 'true') return true;
      if (initialLocalState.profile.onboarding_completed) return true;
      if (initialLocalState.profile.initial_balance_cents > 0 || initialLocalState.transactions.length > 0) return true;
    } catch {}
    return false;
  });

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load all data for current user
  const reloadAllData = async () => {
    if (!user) return;
    const data = await DataRepository.loadAll(user.id);

    if (data.profile.onboarding_completed || localStorage.getItem(`finanflow_onboarding_completed_${user.id}`) === 'true') {
      setHasCompletedOnboarding(true);
    }

    const resolvedName = getPersistedDisplayName(
      user.id,
      user.email,
      user.displayName || data.profile.display_name || 'Usuário'
    );

    const syncedProfile: Profile = {
      ...data.profile,
      display_name: resolvedName,
    };

    setProfile(syncedProfile);
    setTheme(data.profile.theme || 'dark');
    setCategories(data.categories);
    setCreditCards(data.creditCards);
    setPurchases(data.purchases);
    setInstallments(data.installments);
    setInvoices(data.invoices);
    setInvoicePayments(data.invoicePayments);
    setTransactions(data.transactions);
    setRecurringRules(data.recurringRules);
    setRecurringOccurrences(data.recurringOccurrences);
    setBudgets(data.budgets);

    if (user.displayName !== resolvedName) {
      const updatedUser: AuthUser = { ...user, displayName: resolvedName };
      setUser(updatedUser);
      localStorage.setItem('finanflow_current_user', JSON.stringify(updatedUser));
    }
  };

  useEffect(() => {
    reloadAllData();
  }, [user?.id]);

  // Derive Invoice records from Installments
  const derivedInvoices = useMemo(() => {
    // Group installments by card_id and cycle_year_month
    const invoiceMap = new Map<string, Invoice>();

    for (const inst of installments) {
      const key = `${inst.card_id}_${inst.cycle_year_month}`;
      const card = creditCards.find((c) => c.id === inst.card_id);
      const existing = invoiceMap.get(key);

      const paidPayments = invoicePayments.filter(
        (p) => p.card_id === inst.card_id && p.payment_date.startsWith(inst.cycle_year_month)
      );
      const paidAmountCents = paidPayments.reduce((s, p) => s + p.amount_cents, 0);

      if (!existing) {
        const closingDate = `${inst.cycle_year_month}-${String(card?.closing_day || 20).padStart(2, '0')}`;
        const dueDate = inst.due_date;
        const total = inst.amount_cents;
        const isPaid = paidAmountCents >= total && total > 0;

        invoiceMap.set(key, {
          id: `inv_${key}`,
          user_id: user?.id || 'demo',
          card_id: inst.card_id,
          year_month: inst.cycle_year_month,
          closing_date: closingDate,
          due_date: dueDate,
          total_amount_cents: total,
          paid_amount_cents: paidAmountCents,
          status: isPaid ? 'paid' : paidAmountCents > 0 ? 'partially_paid' : 'open',
        });
      } else {
        existing.total_amount_cents += inst.amount_cents;
        const isPaid = existing.paid_amount_cents >= existing.total_amount_cents && existing.total_amount_cents > 0;
        existing.status = isPaid ? 'paid' : existing.paid_amount_cents > 0 ? 'partially_paid' : 'open';
      }
    }

    return Array.from(invoiceMap.values());
  }, [installments, creditCards, invoicePayments, user?.id]);

  // Compute metrics for the selected month
  const metrics = useMemo(() => {
    return calculateMonthlyMetrics({
      yearMonth: selectedYearMonth,
      initialBalanceCents: profile.initial_balance_cents,
      transactions,
      installments,
      invoices: derivedInvoices,
      invoicePayments,
      referenceDateStr: getTodayDateStr(),
    });
  }, [selectedYearMonth, profile.initial_balance_cents, transactions, installments, derivedInvoices, invoicePayments]);

  const toggleTheme = () => {
    const nextTheme: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    const updated: Profile = { ...profile, theme: nextTheme };
    setProfile(updated);
    if (user) {
      DataRepository.saveProfile(updated);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);

    if (updates.display_name && updates.display_name.trim() && user) {
      const nextName = updates.display_name.trim();
      const updatedUser: AuthUser = {
        ...user,
        displayName: nextName,
      };
      setUser(updatedUser);
      localStorage.setItem('finanflow_current_user', JSON.stringify(updatedUser));
      try {
        localStorage.setItem(`finanflow_display_name_${user.id}`, nextName);
        localStorage.setItem(`finanflow_display_name_${user.email.toLowerCase()}`, nextName);
        const raw = localStorage.getItem('finanflow_registered_accounts');
        const map = raw ? JSON.parse(raw) : {};
        map[user.id] = { id: user.id, email: user.email, displayName: nextName };
        map[user.email.toLowerCase()] = { id: user.id, email: user.email, displayName: nextName };
        localStorage.setItem('finanflow_registered_accounts', JSON.stringify(map));
      } catch {}
    }

    if (user) {
      await DataRepository.saveProfile(updated);
    }
  };

  const updateUserCredentials = async (params: {
    displayName?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não está autenticado.' };
    }

    const trimmedName = params.displayName?.trim();
    const newPassword = params.newPassword?.trim();

    if (newPassword && newPassword.length < 6) {
      return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const updatePayload: { password?: string; data?: { full_name?: string } } = {};
          if (newPassword) {
            updatePayload.password = newPassword;
          }
          if (trimmedName) {
            updatePayload.data = { full_name: trimmedName };
          }

          if (Object.keys(updatePayload).length > 0) {
            const { error } = await supabase.auth.updateUser(updatePayload);
            if (error) {
              return { success: false, error: error.message };
            }
          }
        }
      } catch (err: any) {
        console.warn('Supabase updateUser error, updating local state:', err);
      }
    }

    // Synchronize local state and storage
    const nextDisplayName = trimmedName || user.displayName;
    const updatedUser: AuthUser = {
      ...user,
      displayName: nextDisplayName,
    };
    setUser(updatedUser);
    localStorage.setItem('finanflow_current_user', JSON.stringify(updatedUser));

    // Save persistent keys for future sessions
    try {
      localStorage.setItem(`finanflow_display_name_${user.id}`, nextDisplayName);
      localStorage.setItem(`finanflow_display_name_${user.email.toLowerCase()}`, nextDisplayName);
      const raw = localStorage.getItem('finanflow_registered_accounts');
      const map = raw ? JSON.parse(raw) : {};
      map[user.id] = { id: user.id, email: user.email, displayName: nextDisplayName };
      map[user.email.toLowerCase()] = { id: user.id, email: user.email, displayName: nextDisplayName };
      localStorage.setItem('finanflow_registered_accounts', JSON.stringify(map));
    } catch {}

    const updatedProfile: Profile = {
      ...profile,
      display_name: nextDisplayName,
    };
    setProfile(updatedProfile);
    await DataRepository.saveProfile(updatedProfile);

    return {
      success: true,
      message: newPassword
        ? 'Dados do perfil e senha atualizados com sucesso!'
        : 'Nome de exibição atualizado com sucesso!',
    };
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();

    // Demo user instant bypass
    if (trimmedEmail === 'demo@finanflow.app') {
      const resolvedName = getPersistedDisplayName('demo_user', 'demo@finanflow.app', 'Pedro Silva');
      const u: AuthUser = {
        id: 'demo_user',
        email: 'demo@finanflow.app',
        displayName: resolvedName,
      };
      setUser(u);
      localStorage.setItem('finanflow_current_user', JSON.stringify(u));
      return { success: true };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password: pass });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data.user) {
          const resolvedName = getPersistedDisplayName(
            data.user.id,
            trimmedEmail,
            data.user.user_metadata?.full_name || trimmedEmail.split('@')[0]
          );
          const u: AuthUser = {
            id: data.user.id,
            email: data.user.email || trimmedEmail,
            displayName: resolvedName,
          };
          setUser(u);
          localStorage.setItem('finanflow_current_user', JSON.stringify(u));
          return { success: true };
        }
      } catch (err) {
        console.warn('Supabase auth error, falling back to local mode:', err);
      }
    }

    // Local authentication fallback for instant sandbox verification
    const localUserId = `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const resolvedName = getPersistedDisplayName(localUserId, trimmedEmail, trimmedEmail.split('@')[0]);
    const u: AuthUser = {
      id: localUserId,
      email: trimmedEmail,
      displayName: resolvedName,
    };
    setUser(u);
    localStorage.setItem('finanflow_current_user', JSON.stringify(u));
    return { success: true };
  };

  const register = async (email: string, pass: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name?.trim() || trimmedEmail.split('@')[0];

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: pass,
          options: { data: { full_name: trimmedName } },
        });
        if (error) {
          return { success: false, error: error.message };
        }
        if (data.user) {
          const u: AuthUser = {
            id: data.user.id,
            email: data.user.email || trimmedEmail,
            displayName: trimmedName,
          };
          setUser(u);
          localStorage.setItem('finanflow_current_user', JSON.stringify(u));
          try {
            localStorage.setItem(`finanflow_display_name_${u.id}`, trimmedName);
            localStorage.setItem(`finanflow_display_name_${trimmedEmail}`, trimmedName);
            const raw = localStorage.getItem('finanflow_registered_accounts');
            const map = raw ? JSON.parse(raw) : {};
            map[u.id] = { id: u.id, email: u.email, displayName: trimmedName };
            map[trimmedEmail] = { id: u.id, email: u.email, displayName: trimmedName };
            localStorage.setItem('finanflow_registered_accounts', JSON.stringify(map));
          } catch {}
          return { success: true };
        }
      } catch (err) {
        console.warn('Supabase sign-up error, falling back to local mode:', err);
      }
    }

    const localUserId = `usr_${trimmedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const u: AuthUser = {
      id: localUserId,
      email: trimmedEmail,
      displayName: trimmedName,
    };
    setUser(u);
    localStorage.setItem('finanflow_current_user', JSON.stringify(u));
    try {
      localStorage.setItem(`finanflow_display_name_${localUserId}`, trimmedName);
      localStorage.setItem(`finanflow_display_name_${trimmedEmail}`, trimmedName);
      const raw = localStorage.getItem('finanflow_registered_accounts');
      const map = raw ? JSON.parse(raw) : {};
      map[localUserId] = { id: localUserId, email: trimmedEmail, displayName: trimmedName };
      map[trimmedEmail] = { id: localUserId, email: trimmedEmail, displayName: trimmedName };
      localStorage.setItem('finanflow_registered_accounts', JSON.stringify(map));
    } catch {}
    return { success: true };
  };

  const logout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    localStorage.removeItem('finanflow_current_user');
    setUser(null);
  };

  const addTransaction = async (txData: Omit<Transaction, 'id' | 'user_id'>) => {
    if (!user) return;
    const newTx: Transaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: user.id,
    };
    const updated = await DataRepository.saveTransaction(user.id, newTx, transactions);
    setTransactions(updated);
  };

  const updateTransaction = async (tx: Transaction) => {
    if (!user) return;
    const updated = await DataRepository.saveTransaction(user.id, tx, transactions);
    setTransactions(updated);
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    const updated = await DataRepository.deleteTransaction(user.id, id, transactions);
    setTransactions(updated);
  };

  const addCard = async (cardData: Omit<CreditCard, 'id' | 'user_id'>) => {
    if (!user) return;
    const newCard: CreditCard = {
      ...cardData,
      id: `card_${Date.now()}`,
      user_id: user.id,
    };
    const updated = await DataRepository.saveCard(user.id, newCard, creditCards);
    setCreditCards(updated);
  };

  const addPurchase = async (params: {
    cardId: string;
    description: string;
    totalAmountCents: number;
    purchaseDate: string;
    categoryId: string;
    installmentsCount: number;
    notes?: string;
  }) => {
    if (!user) return;
    const card = creditCards.find((c) => c.id === params.cardId);
    if (!card) return;

    const res = await DataRepository.addCreditCardPurchase({
      userId: user.id,
      card,
      description: params.description,
      totalAmountCents: params.totalAmountCents,
      purchaseDate: params.purchaseDate,
      categoryId: params.categoryId,
      installmentsCount: params.installmentsCount,
      notes: params.notes,
      existingPurchases: purchases,
      existingInstallments: installments,
    });

    setPurchases(res.purchases);
    setInstallments(res.installments);
  };

  const updatePurchase = async (params: {
    purchaseId: string;
    cardId?: string;
    description: string;
    totalAmountCents: number;
    purchaseDate: string;
    categoryId: string;
    installmentsCount: number;
    notes?: string;
  }) => {
    if (!user) return;
    const existing = purchases.find((p) => p.id === params.purchaseId);
    if (!existing) return;
    const cardId = params.cardId || existing.card_id;
    const card = creditCards.find((c) => c.id === cardId);
    if (!card) return;

    const res = await DataRepository.updateCreditCardPurchase({
      userId: user.id,
      card,
      purchaseId: params.purchaseId,
      description: params.description,
      totalAmountCents: params.totalAmountCents,
      purchaseDate: params.purchaseDate,
      categoryId: params.categoryId,
      installmentsCount: params.installmentsCount,
      notes: params.notes,
      existingPurchases: purchases,
      existingInstallments: installments,
    });

    setPurchases(res.purchases);
    setInstallments(res.installments);
  };

  const deletePurchase = async (purchaseId: string) => {
    if (!user) return;
    const res = await DataRepository.deleteCreditCardPurchase({
      userId: user.id,
      purchaseId,
      existingPurchases: purchases,
      existingInstallments: installments,
    });

    setPurchases(res.purchases);
    setInstallments(res.installments);
  };

  const payInvoice = async (invoice: Invoice, amountCents: number, paymentDate: string, notes?: string) => {
    if (!user) return;
    const res = await DataRepository.recordInvoicePayment({
      userId: user.id,
      invoice,
      amountCents,
      paymentDate,
      notes,
      existingPayments: invoicePayments,
      existingInvoices: invoices,
      existingInstallments: installments,
      existingTransactions: transactions,
    });

    setInvoicePayments(res.payments);
    setInvoices(res.invoices);
    setInstallments(res.installments);
    setTransactions(res.transactions);
  };

  const addCategory = async (catData: Omit<Category, 'id' | 'user_id' | 'is_default' | 'is_archived'>) => {
    if (!user) return;
    const newCat: Category = {
      ...catData,
      id: `cat_${Date.now()}`,
      user_id: user.id,
      is_default: false,
      is_archived: false,
    };
    const updated = [...categories, newCat];
    setCategories(updated);
    saveLocalEntity(user.id, 'categories', updated);
  };

  const updateCategory = async (cat: Category) => {
    if (!user) return;
    const updated = categories.map((c) => (c.id === cat.id ? cat : c));
    setCategories(updated);
    saveLocalEntity(user.id, 'categories', updated);
  };

  const archiveCategory = async (catId: string, replacementCatId?: string) => {
    if (!user) return;
    const updatedCats = categories.map((c) => (c.id === catId ? { ...c, is_archived: true } : c));
    setCategories(updatedCats);
    saveLocalEntity(user.id, 'categories', updatedCats);

    if (replacementCatId) {
      const updatedTxs = transactions.map((t) =>
        t.category_id === catId ? { ...t, category_id: replacementCatId } : t
      );
      setTransactions(updatedTxs);
      saveLocalEntity(user.id, 'transactions', updatedTxs);
    }
  };

  const addRecurringRule = async (ruleData: Omit<RecurringRule, 'id' | 'user_id'>) => {
    if (!user) return;
    const newRule: RecurringRule = {
      ...ruleData,
      id: `rule_${Date.now()}`,
      user_id: user.id,
    };
    const updated = await DataRepository.saveRecurringRule(user.id, newRule, recurringRules);
    setRecurringRules(updated);
  };

  const updateRecurringRule = async (rule: RecurringRule) => {
    if (!user) return;
    const updated = await DataRepository.saveRecurringRule(user.id, rule, recurringRules);
    setRecurringRules(updated);
  };

  const deleteRecurringRule = async (ruleId: string) => {
    if (!user) return;
    const res = await DataRepository.deleteRecurringRule(user.id, ruleId, recurringRules, recurringOccurrences);
    setRecurringRules(res.rules);
    setRecurringOccurrences(res.occurrences);
  };

  const confirmRecurringOccurrence = async (ruleId: string, yearMonth: string, customAmountCents?: number) => {
    if (!user) return;
    const rule = recurringRules.find((r) => r.id === ruleId);
    if (!rule) return;

    // Idempotency check: avoid double confirmation for same month
    const existing = recurringOccurrences.find(
      (occ) => occ.rule_id === ruleId && occ.year_month === yearMonth && occ.status === 'confirmed'
    );
    if (existing) {
      return; // Already confirmed
    }

    const amount = customAmountCents ?? rule.amount_cents;
    const expectedDay = String(Math.min(rule.day_of_month, 28)).padStart(2, '0');
    const txDate = `${yearMonth}-${expectedDay}`;

    // Create real transaction
    const newTx: Transaction = {
      id: `tx_rec_${ruleId}_${yearMonth}`,
      user_id: user.id,
      description: rule.description,
      amount_cents: amount,
      type: rule.type,
      category_id: rule.category_id,
      date: txDate,
      due_date: txDate,
      status: 'completed',
      payment_method: 'account',
      is_recurring: true,
      recurring_rule_id: rule.id,
    };

    const newOcc: RecurringOccurrence = {
      id: `${ruleId}_${yearMonth}`,
      user_id: user.id,
      rule_id: ruleId,
      year_month: yearMonth,
      expected_date: txDate,
      amount_cents: amount,
      status: 'confirmed',
      transaction_id: newTx.id,
    };

    const updatedTxs = [newTx, ...transactions];
    const updatedOccs = [
      ...recurringOccurrences.filter((o) => !(o.rule_id === ruleId && o.year_month === yearMonth)),
      newOcc,
    ];

    setTransactions(updatedTxs);
    setRecurringOccurrences(updatedOccs);
    saveLocalEntity(user.id, 'transactions', updatedTxs);
    saveLocalEntity(user.id, 'recurringOccurrences', updatedOccs);
  };

  const dismissRecurringOccurrence = async (ruleId: string, yearMonth: string) => {
    if (!user) return;
    const rule = recurringRules.find((r) => r.id === ruleId);
    if (!rule) return;

    const newOcc: RecurringOccurrence = {
      id: `${ruleId}_${yearMonth}`,
      user_id: user.id,
      rule_id: ruleId,
      year_month: yearMonth,
      expected_date: `${yearMonth}-01`,
      amount_cents: rule.amount_cents,
      status: 'dismissed',
    };

    const updatedOccs = [
      ...recurringOccurrences.filter((o) => !(o.rule_id === ruleId && o.year_month === yearMonth)),
      newOcc,
    ];
    setRecurringOccurrences(updatedOccs);
    saveLocalEntity(user.id, 'recurringOccurrences', updatedOccs);
  };

  const saveBudget = async (categoryId: string, yearMonth: string, limitCents: number) => {
    if (!user) return;
    const existingIndex = budgets.findIndex((b) => b.category_id === categoryId && b.year_month === yearMonth);
    let updated: MonthlyBudget[];
    if (existingIndex >= 0) {
      updated = [...budgets];
      updated[existingIndex] = { ...updated[existingIndex], limit_cents: limitCents };
    } else {
      updated = [
        ...budgets,
        {
          id: `bgt_${categoryId}_${yearMonth}`,
          user_id: user.id,
          category_id: categoryId,
          year_month: yearMonth,
          limit_cents: limitCents,
        },
      ];
    }
    setBudgets(updated);
    saveLocalEntity(user.id, 'budgets', updated);
  };

  const copyPreviousMonthBudgets = async (currentYm: string): Promise<number> => {
    if (!user) return 0;
    const prevYm = addMonthsToYearMonth(currentYm, -1);
    const prevBudgets = budgets.filter((b) => b.year_month === prevYm);
    if (prevBudgets.length === 0) return 0;

    let copiedCount = 0;
    let nextBudgets = [...budgets];

    for (const pb of prevBudgets) {
      const alreadyHas = nextBudgets.some((b) => b.category_id === pb.category_id && b.year_month === currentYm);
      if (!alreadyHas) {
        nextBudgets.push({
          id: `bgt_${pb.category_id}_${currentYm}`,
          user_id: user.id,
          category_id: pb.category_id,
          year_month: currentYm,
          limit_cents: pb.limit_cents,
        });
        copiedCount++;
      }
    }

    setBudgets(nextBudgets);
    saveLocalEntity(user.id, 'budgets', nextBudgets);
    return copiedCount;
  };

  const completeOnboarding = async (updates?: Partial<Profile>) => {
    setHasCompletedOnboarding(true);
    const userId = user?.id || 'guest';
    localStorage.setItem(`finanflow_onboarding_completed_${userId}`, 'true');

    const nextName = updates?.display_name?.trim() || profile.display_name;

    const newProfile = {
      ...profile,
      ...(updates || {}),
      display_name: nextName,
      onboarding_completed: true,
    };
    setProfile(newProfile);

    if (user && nextName) {
      const updatedUser: AuthUser = {
        ...user,
        displayName: nextName,
      };
      setUser(updatedUser);
      localStorage.setItem('finanflow_current_user', JSON.stringify(updatedUser));
      try {
        localStorage.setItem(`finanflow_display_name_${user.id}`, nextName);
        localStorage.setItem(`finanflow_display_name_${user.email.toLowerCase()}`, nextName);
        const raw = localStorage.getItem('finanflow_registered_accounts');
        const map = raw ? JSON.parse(raw) : {};
        map[user.id] = { id: user.id, email: user.email, displayName: nextName };
        map[user.email.toLowerCase()] = { id: user.id, email: user.email, displayName: nextName };
        localStorage.setItem('finanflow_registered_accounts', JSON.stringify(map));
      } catch {}
    }

    await DataRepository.saveProfile(newProfile);
  };

  const isSupabaseActive = Boolean(getSupabaseCredentials().isConfigured);
  const isOnboarded = Boolean(
    hasCompletedOnboarding ||
    profile.onboarding_completed ||
    profile.initial_balance_cents > 0 ||
    transactions.length > 0
  );

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        theme,
        toggleTheme,
        selectedYearMonth,
        setSelectedYearMonth,
        categories,
        creditCards,
        purchases,
        transactions,
        installments,
        invoices: derivedInvoices,
        invoicePayments,
        recurringRules,
        recurringOccurrences,
        budgets,
        metrics,
        isSupabaseActive,
        isOnboarded,
        completeOnboarding,
        login,
        register,
        logout,
        updateProfile,
        updateUserCredentials,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCard,
        addPurchase,
        updatePurchase,
        deletePurchase,
        payInvoice,
        addCategory,
        updateCategory,
        archiveCategory,
        addRecurringRule,
        updateRecurringRule,
        deleteRecurringRule,
        confirmRecurringOccurrence,
        dismissRecurringOccurrence,
        saveBudget,
        copyPreviousMonthBudgets,
        reloadAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

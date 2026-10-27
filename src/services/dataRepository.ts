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

  const defaultProfile: Profile = {
    id: `prof_${userId}`,
    user_id: userId,
    display_name: 'Usuário FinanFlow',
    initial_balance_cents: 0,
    start_date: new Date().toISOString().split('T')[0],
    theme: 'dark',
    timezone: 'America/Fortaleza',
    currency: 'BRL',
  };

  const profile = load<Profile>('profile', defaultProfile);

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

export function saveLocalEntity<T>(userId: string, entityName: string, data: T): void {
  try {
    localStorage.setItem(getLocalKey(userId, entityName), JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to save ${entityName} locally:`, err);
  }
}

/**
 * Service to manage all persistent CRUD operations seamlessly
 */
export const DataRepository = {
  async loadAll(userId: string): Promise<AppDataState> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const [
          { data: profData },
          { data: catData },
          { data: cardData },
          { data: txData },
          { data: purchData },
          { data: instData },
          { data: invData },
          { data: invPayData },
          { data: ruleData },
          { data: occData },
          { data: bgtData },
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', userId).single(),
          supabase.from('categories').select('*').eq('user_id', userId),
          supabase.from('credit_cards').select('*').eq('user_id', userId),
          supabase.from('transactions').select('*').eq('user_id', userId),
          supabase.from('credit_card_purchases').select('*').eq('user_id', userId),
          supabase.from('installments').select('*').eq('user_id', userId),
          supabase.from('invoices').select('*').eq('user_id', userId),
          supabase.from('invoice_payments').select('*').eq('user_id', userId),
          supabase.from('recurring_rules').select('*').eq('user_id', userId),
          supabase.from('recurring_occurrences').select('*').eq('user_id', userId),
          supabase.from('monthly_budgets').select('*').eq('user_id', userId),
        ]);

        if (profData) {
          return {
            profile: profData,
            categories: catData || [],
            creditCards: cardData || [],
            transactions: txData || [],
            purchases: purchData || [],
            installments: instData || [],
            invoices: invData || [],
            invoicePayments: invPayData || [],
            recurringRules: ruleData || [],
            recurringOccurrences: occData || [],
            budgets: bgtData || [],
          };
        }
      } catch (err) {
        console.warn('Supabase fetch failed, falling back to secure local state:', err);
      }
    }

    return loadLocalState(userId);
  },

  async saveProfile(profile: Profile): Promise<void> {
    saveLocalEntity(profile.user_id, 'profile', profile);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(profile);
      } catch (e) {
        console.warn('Supabase profile sync error:', e);
      }
    }
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

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('transactions').upsert(tx);
      } catch (e) {
        console.warn('Supabase transaction sync error:', e);
      }
    }
    return updated;
  },

  async deleteTransaction(userId: string, txId: string, allTx: Transaction[]): Promise<Transaction[]> {
    const updated = allTx.filter((t) => t.id !== txId);
    saveLocalEntity(userId, 'transactions', updated);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', txId);
      } catch (e) {
        console.warn('Supabase transaction delete error:', e);
      }
    }
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
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('credit_cards').upsert(card);
      } catch (e) {
        console.warn('Supabase card sync error:', e);
      }
    }
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

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('credit_card_purchases').insert(purchase);
        await supabase.from('installments').insert(newInstallments);
      } catch (e) {
        console.warn('Supabase purchase insert error:', e);
      }
    }

    return {
      purchases: updatedPurchases,
      installments: updatedInstallments,
    };
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

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('invoice_payments').insert(payment);
        await supabase.from('invoices').upsert(updatedInvoice);
        await supabase.from('transactions').insert(txPayment);
        if (isFullyPaid) {
          await supabase
            .from('installments')
            .update({ is_liquidated: true })
            .eq('card_id', invoice.card_id)
            .eq('cycle_year_month', invoice.year_month);
        }
      } catch (e) {
        console.warn('Supabase invoice payment sync error:', e);
      }
    }

    return {
      payments: updatedPayments,
      invoices: updatedInvoices,
      installments: updatedInstallments,
      transactions: updatedTransactions,
    };
  },
};

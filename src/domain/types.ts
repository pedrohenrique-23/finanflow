/**
 * FinanFlow - Domain Types
 * All monetary amounts are represented as integers in CENTS (centavos)
 * to avoid IEEE 754 floating point arithmetic issues.
 */

export type TransactionType = 'income' | 'expense' | 'initial_balance';
export type TransactionStatus = 'pending' | 'completed' | 'overdue';
export type PaymentMethod = 'cash' | 'account' | 'credit_card';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  initial_balance_cents: number;
  start_date: string; // YYYY-MM-DD
  theme: 'dark' | 'light';
  timezone: string; // Default: 'America/Fortaleza'
  currency: 'BRL';
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
  is_default: boolean;
  is_archived: boolean;
  created_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  type: TransactionType;
  category_id: string;
  date: string; // YYYY-MM-DD
  due_date?: string; // YYYY-MM-DD
  payment_date?: string; // YYYY-MM-DD
  status: 'pending' | 'completed'; // raw status stored
  notes?: string;
  payment_method: PaymentMethod;
  is_recurring?: boolean;
  recurring_rule_id?: string;
  origin_id?: string;
  is_invoice_payment?: boolean; // When true, represents cash liquidation of a credit card invoice, not a duplicate consumption expense
  created_at?: string;
  updated_at?: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  issuer?: string;
  limit_cents: number;
  closing_day: number; // 1 to 31
  due_day: number; // 1 to 31
  color: string;
  is_archived: boolean;
  created_at?: string;
}

export interface CreditCardPurchase {
  id: string;
  user_id: string;
  card_id: string;
  description: string;
  total_amount_cents: number;
  purchase_date: string; // YYYY-MM-DD
  category_id: string;
  installments_count: number;
  notes?: string;
  created_at?: string;
}

export interface Installment {
  id: string;
  user_id: string;
  purchase_id: string;
  card_id: string;
  installment_number: number; // 1, 2, ...
  total_installments: number;
  amount_cents: number;
  cycle_year_month: string; // YYYY-MM (the invoice billing month)
  due_date: string; // YYYY-MM-DD
  is_liquidated: boolean; // Set to true when the invoice is paid
  invoice_id?: string;
}

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'partially_paid' | 'overdue';

export interface Invoice {
  id: string;
  user_id: string;
  card_id: string;
  year_month: string; // YYYY-MM
  closing_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  total_amount_cents: number;
  paid_amount_cents: number;
  status: InvoiceStatus;
  created_at?: string;
}

export interface InvoicePayment {
  id: string;
  user_id: string;
  invoice_id: string;
  card_id: string;
  amount_cents: number;
  payment_date: string; // YYYY-MM-DD
  notes?: string;
  created_at?: string;
}

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  type: 'income' | 'expense';
  category_id: string;
  frequency: RecurrenceFrequency;
  day_of_month: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  created_at?: string;
}

export interface RecurringOccurrence {
  id: string; // composite key: `${rule_id}_${year_month}`
  user_id: string;
  rule_id: string;
  year_month: string; // YYYY-MM
  expected_date: string; // YYYY-MM-DD
  amount_cents: number;
  status: 'pending_confirmation' | 'confirmed' | 'dismissed';
  transaction_id?: string;
  created_at?: string;
}

export interface MonthlyBudget {
  id: string;
  user_id: string;
  year_month: string; // YYYY-MM
  category_id: string;
  limit_cents: number;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardMetrics {
  currentBalanceCents: number;
  projectedBalanceCents: number;
  receivedIncomeCents: number;
  paidExpenseCents: number;
  pendingExpenseCents: number;
  overdueExpenseCents: number;
  creditCardConsumptionCents: number;
  invoicePaymentsCents: number;
  previousMonthExpenseCents: number;
}

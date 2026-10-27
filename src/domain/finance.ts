/**
 * FinanFlow - Financial Domain Engine
 * Pure, deterministic functions using integer cents.
 */

import {
  CreditCard,
  CreditCardPurchase,
  DashboardMetrics,
  Installment,
  Invoice,
  InvoicePayment,
  InvoiceStatus,
  MonthlyBudget,
  Profile,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
  TransactionStatus,
} from './types';

/**
 * Converts a floating point currency value into integer cents safely.
 * e.g. 10.50 -> 1050, 100.99 -> 10099
 */
export function toCents(amount: number): number {
  if (!amount || isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Converts integer cents back to float amount for display or chart axes.
 */
export function fromCents(cents: number): number {
  if (!cents || isNaN(cents)) return 0;
  return cents / 100;
}

/**
 * Formats a monetary amount into Brazilian Real (BRL) currency.
 * Accepts either integer cents or float number.
 */
export function formatCurrencyBRL(value: number, isCents = true): string {
  const amount = isCents ? fromCents(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats YYYY-MM-DD or ISO string into Brazilian date format (DD/MM/YYYY).
 */
export function formatDateBRL(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

/**
 * Get current date string in YYYY-MM-DD format (defaults to America/Fortaleza standard)
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to add N months to a YYYY-MM string, handling year crossovers cleanly.
 */
export function addMonthsToYearMonth(yearMonth: string, monthsToAdd: number): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10); // 1-12

  month += monthsToAdd;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Derives the active status of a transaction.
 * If raw status is 'pending' and due_date < referenceDate, returns 'overdue' (vencido).
 */
export function deriveTransactionStatus(
  tx: Pick<Transaction, 'status' | 'due_date' | 'date'>,
  referenceDateStr = getTodayDateStr()
): TransactionStatus {
  if (tx.status === 'completed') {
    return 'completed';
  }

  const effectiveDueDate = tx.due_date || tx.date;
  if (effectiveDueDate && effectiveDueDate < referenceDateStr) {
    return 'overdue';
  }

  return 'pending';
}

/**
 * Rule for determining the credit card invoice cycle:
 * Given a purchase date (YYYY-MM-DD) and the card's closing_day:
 * - If purchase day >= closing_day: purchase closes in the subsequent month's invoice.
 * - If purchase day < closing_day: purchase closes in the current month's invoice.
 * Example: closing_day = 20
 * Purchase on 15/04 -> Cycle 2026-04 (due in 2026-04 or 2026-05 according to due_day)
 * Purchase on 20/04 -> Closes on next cycle -> Cycle 2026-05
 * Purchase on 25/04 -> Closes on next cycle -> Cycle 2026-05
 */
export function determineFirstInvoiceCycle(purchaseDateStr: string, closingDay: number): string {
  const [yearStr, monthStr, dayStr] = purchaseDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const baseYearMonth = `${year}-${String(month).padStart(2, '0')}`;
  if (day >= closingDay) {
    return addMonthsToYearMonth(baseYearMonth, 1);
  }
  return baseYearMonth;
}

/**
 * Calculates due date for an invoice or installment in a given yearMonth, respecting card due_day.
 * Properly caps day at max days in month (e.g. Feb 28, Apr 30).
 */
export function calculateDueDateForCycle(yearMonth: string, dueDay: number): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Determine last day of this month
  const lastDay = new Date(year, month, 0).getDate();
  const effectiveDay = Math.min(dueDay, lastDay);

  return `${year}-${String(month).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;
}

/**
 * Splits a total purchase amount into N installments deterministically.
 * The sum of installments will match total_amount_cents with 0 rounding errors.
 * Any remainder cents are allocated 1 cent to the first installments.
 */
export function generateInstallments(params: {
  purchaseId: string;
  userId: string;
  cardId: string;
  totalAmountCents: number;
  installmentsCount: number;
  purchaseDate: string;
  closingDay: number;
  dueDay: number;
}): Installment[] {
  const {
    purchaseId,
    userId,
    cardId,
    totalAmountCents,
    installmentsCount,
    purchaseDate,
    closingDay,
    dueDay,
  } = params;

  if (installmentsCount <= 0 || totalAmountCents <= 0) {
    return [];
  }

  const baseAmount = Math.floor(totalAmountCents / installmentsCount);
  const remainder = totalAmountCents % installmentsCount;

  const firstCycle = determineFirstInvoiceCycle(purchaseDate, closingDay);
  const installments: Installment[] = [];

  for (let i = 0; i < installmentsCount; i++) {
    const installmentNumber = i + 1;
    // Remainder cents allocated to earliest installments
    const amountCents = baseAmount + (i < remainder ? 1 : 0);
    const cycleYearMonth = addMonthsToYearMonth(firstCycle, i);
    const dueDate = calculateDueDateForCycle(cycleYearMonth, dueDay);

    installments.push({
      id: `${purchaseId}_inst_${installmentNumber}`,
      user_id: userId,
      purchase_id: purchaseId,
      card_id: cardId,
      installment_number: installmentNumber,
      total_installments: installmentsCount,
      amount_cents: amountCents,
      cycle_year_month: cycleYearMonth,
      due_date: dueDate,
      is_liquidated: false,
    });
  }

  return installments;
}

/**
 * Calculates credit card limit usage:
 * - Committed limit = sum of non-liquidated installments.
 * - Available limit = total limit - committed limit.
 * - When an invoice is paid, its installments become liquidated, freeing up limit once.
 */
export function calculateCardLimits(
  totalLimitCents: number,
  installments: Installment[]
): {
  committedLimitCents: number;
  availableLimitCents: number;
  isExceeded: boolean;
} {
  const committedLimitCents = installments
    .filter((inst) => !inst.is_liquidated)
    .reduce((sum, inst) => sum + inst.amount_cents, 0);

  const availableLimitCents = totalLimitCents - committedLimitCents;
  const isExceeded = availableLimitCents < 0;

  return {
    committedLimitCents,
    availableLimitCents,
    isExceeded,
  };
}

/**
 * Calculates current balance:
 * Saldo inicial + Receitas efetivamente recebidas (pago/completed)
 * - Despesas pagas em dinheiro/conta (pago/completed)
 * - Pagamentos de fatura efetivamente realizados (invoice_payment completed)
 *
 * CRITICAL RULE: Card purchases DO NOT reduce the current balance immediately.
 * Only the actual payment of the invoice reduces current cash balance.
 */
export function calculateCurrentBalance(params: {
  initialBalanceCents: number;
  transactions: Transaction[];
  invoicePayments?: InvoicePayment[];
}): number {
  const { initialBalanceCents, transactions, invoicePayments = [] } = params;

  let balance = initialBalanceCents;

  for (const tx of transactions) {
    if (tx.status !== 'completed') continue;

    if (tx.type === 'income') {
      balance += tx.amount_cents;
    } else if (tx.type === 'expense') {
      // If purchase was done directly on credit card, it does NOT impact cash balance here
      // It will impact cash balance when the invoice payment is executed.
      if (tx.payment_method !== 'credit_card') {
        balance -= tx.amount_cents;
      }
    }
  }

  // Also include invoice payments if passed separately and not already in transactions
  for (const payment of invoicePayments) {
    // If this payment was already recorded in transactions as an invoice_payment, avoid double counting
    const alreadyInTx = transactions.some(
      (tx) => tx.is_invoice_payment && tx.origin_id === payment.invoice_id
    );
    if (!alreadyInTx) {
      balance -= payment.amount_cents;
    }
  }

  return balance;
}

/**
 * Calculates projected balance at the end of a given month:
 * Current balance + Expected pending revenues in the month
 * - Expected pending cash/account expenses in the month
 * - Unpaid invoice amounts due in the month
 */
export function calculateProjectedBalance(params: {
  currentBalanceCents: number;
  pendingTransactions: Transaction[];
  pendingInvoices: Invoice[];
  yearMonth: string;
}): number {
  const { currentBalanceCents, pendingTransactions, pendingInvoices, yearMonth } = params;

  let projected = currentBalanceCents;

  // Add pending revenues for this month
  for (const tx of pendingTransactions) {
    const txYearMonth = (tx.due_date || tx.date).substring(0, 7);
    if (txYearMonth !== yearMonth) continue;

    if (tx.type === 'income') {
      projected += tx.amount_cents;
    } else if (tx.type === 'expense' && tx.payment_method !== 'credit_card' && !tx.is_invoice_payment) {
      projected -= tx.amount_cents;
    }
  }

  // Deduct pending invoice payments due in this month
  for (const inv of pendingInvoices) {
    if (inv.year_month !== yearMonth) continue;
    const unpaidCents = Math.max(0, inv.total_amount_cents - inv.paid_amount_cents);
    projected -= unpaidCents;
  }

  return projected;
}

/**
 * Calculates budget usage status.
 */
export function calculateBudgetStatus(spentCents: number, limitCents: number) {
  const percentage = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;
  const remainingCents = limitCents - spentCents;

  let status: 'normal' | 'warning' | 'exceeded' = 'normal';
  if (percentage >= 100) {
    status = 'exceeded';
  } else if (percentage >= 80) {
    status = 'warning';
  }

  return {
    percentage: Math.round(percentage * 10) / 10,
    remainingCents,
    status,
  };
}

/**
 * Calculates monthly metrics cleanly distinguishing consumption from cash flow:
 * - Consumption expenses: Cash/account expenses of the month + card installments for this month
 * - Invoice payments: Cash flow liquidation of liabilities (not counted as double consumption)
 */
export function calculateMonthlyMetrics(params: {
  yearMonth: string;
  initialBalanceCents: number;
  transactions: Transaction[];
  installments: Installment[];
  invoices: Invoice[];
  invoicePayments: InvoicePayment[];
  referenceDateStr?: string;
}): DashboardMetrics {
  const {
    yearMonth,
    initialBalanceCents,
    transactions,
    installments,
    invoices,
    invoicePayments,
    referenceDateStr = getTodayDateStr(),
  } = params;

  // 1. Current balance (overall lifetime up to now)
  const currentBalanceCents = calculateCurrentBalance({
    initialBalanceCents,
    transactions,
    invoicePayments,
  });

  // 2. Month transactions filter
  const monthTransactions = transactions.filter((tx) => {
    const d = tx.date || tx.due_date;
    return d && d.startsWith(yearMonth);
  });

  // 3. Revenues received in this month
  const receivedIncomeCents = monthTransactions
    .filter((tx) => tx.type === 'income' && tx.status === 'completed')
    .reduce((sum, tx) => sum + tx.amount_cents, 0);

  // 4. Direct expenses paid in this month (cash/account)
  const paidExpenseCents = monthTransactions
    .filter((tx) => tx.type === 'expense' && tx.status === 'completed' && tx.payment_method !== 'credit_card' && !tx.is_invoice_payment)
    .reduce((sum, tx) => sum + tx.amount_cents, 0);

  // 5. Pending and overdue cash expenses
  let pendingExpenseCents = 0;
  let overdueExpenseCents = 0;

  for (const tx of monthTransactions) {
    if (tx.type === 'expense' && tx.payment_method !== 'credit_card' && !tx.is_invoice_payment) {
      if (tx.status === 'pending') {
        const derived = deriveTransactionStatus(tx, referenceDateStr);
        if (derived === 'overdue') {
          overdueExpenseCents += tx.amount_cents;
        } else {
          pendingExpenseCents += tx.amount_cents;
        }
      }
    }
  }

  // 6. Credit card consumption for this month (installments belonging to this billing cycle)
  const monthInstallments = installments.filter((inst) => inst.cycle_year_month === yearMonth);
  const creditCardConsumptionCents = monthInstallments.reduce((sum, inst) => sum + inst.amount_cents, 0);

  // 7. Invoice payments made in this month
  const monthInvoicePayments = invoicePayments.filter((p) => p.payment_date.startsWith(yearMonth));
  const invoicePaymentsCents = monthInvoicePayments.reduce((sum, p) => sum + p.amount_cents, 0);

  // 8. Pending invoices for projected balance
  const monthInvoices = invoices.filter((inv) => inv.year_month === yearMonth);
  const pendingTransactions = transactions.filter((tx) => tx.status === 'pending');

  const projectedBalanceCents = calculateProjectedBalance({
    currentBalanceCents,
    pendingTransactions,
    pendingInvoices: monthInvoices,
    yearMonth,
  });

  // 9. Previous month total expenses (for comparison)
  const prevYearMonth = addMonthsToYearMonth(yearMonth, -1);
  const prevTransactions = transactions.filter((tx) => {
    const d = tx.date || tx.due_date;
    return d && d.startsWith(prevYearMonth);
  });
  const prevPaidExpenses = prevTransactions
    .filter((tx) => tx.type === 'expense' && tx.status === 'completed' && tx.payment_method !== 'credit_card' && !tx.is_invoice_payment)
    .reduce((sum, tx) => sum + tx.amount_cents, 0);
  const prevInstallments = installments
    .filter((inst) => inst.cycle_year_month === prevYearMonth)
    .reduce((sum, inst) => sum + inst.amount_cents, 0);
  const previousMonthExpenseCents = prevPaidExpenses + prevInstallments;

  return {
    currentBalanceCents,
    projectedBalanceCents,
    receivedIncomeCents,
    paidExpenseCents,
    pendingExpenseCents,
    overdueExpenseCents,
    creditCardConsumptionCents,
    invoicePaymentsCents,
    previousMonthExpenseCents,
  };
}

/**
 * Checks recurrence idempotency to prevent creating duplicates for the same month.
 */
export function isRecurrenceAlreadyConfirmed(
  ruleId: string,
  yearMonth: string,
  existingOccurrences: RecurringOccurrence[]
): boolean {
  return existingOccurrences.some(
    (occ) => occ.rule_id === ruleId && occ.yearMonth === yearMonth && occ.status === 'confirmed'
  );
}

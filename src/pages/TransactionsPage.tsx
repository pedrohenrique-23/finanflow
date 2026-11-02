import React, { useState, useMemo } from 'react';
import {
  PlusCircle,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  DollarSign,
  X,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Transaction, Invoice, CreditCard as CreditCardType, TransactionType } from '../domain/types';
import {
  formatCurrencyBRL,
  formatDateBRL,
  deriveTransactionStatus,
  getTodayDateStr,
  fromCents,
  toCents,
} from '../domain/finance';

export type SortOption =
  | 'due_date_asc'
  | 'due_date_desc'
  | 'date_desc'
  | 'date_asc'
  | 'amount_desc'
  | 'amount_asc'
  | 'description_asc'
  | 'description_desc';

interface TransactionsPageProps {
  onOpenNewTx: () => void;
  onEditTx: (tx: Transaction) => void;
  onNavigateTab?: (tab: string) => void;
}

// Unified item representation for both standard transactions and credit card invoices
interface DisplayItem {
  id: string;
  isInvoice: boolean;
  type: TransactionType;
  description: string;
  categoryName: string;
  categoryColor?: string;
  date: string;
  due_date: string;
  status: 'completed' | 'pending' | 'overdue';
  payment_method: string;
  amount_cents: number;
  rawTransaction?: Transaction;
  rawInvoice?: Invoice;
  card?: CreditCardType;
  is_recurring?: boolean;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  onOpenNewTx,
  onEditTx,
  onNavigateTab,
}) => {
  const {
    transactions,
    categories,
    selectedYearMonth,
    deleteTransaction,
    updateTransaction,
    creditCards,
    invoices,
    payInvoice,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('due_date_asc');

  // Deletion modal state for transactions
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Pay invoice modal state
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payDate, setPayDate] = useState(getTodayDateStr());
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');

  // 1. Regular transactions for the selected month (excluding invoice payment mirror transactions)
  const regularItems = useMemo<DisplayItem[]>(() => {
    return transactions
      .filter((tx) => {
        // Exclude internal invoice payment mirror transactions to prevent duplicate entry
        if (tx.is_invoice_payment) return false;
        const d = tx.date || tx.due_date;
        return d && d.startsWith(selectedYearMonth);
      })
      .map((tx) => {
        const category = categories.find((c) => c.id === tx.category_id);
        const derived = deriveTransactionStatus(tx);
        return {
          id: tx.id,
          isInvoice: false,
          type: tx.type,
          description: tx.description,
          categoryName: category?.name || 'Sem categoria',
          categoryColor: category?.color,
          date: tx.date,
          due_date: tx.due_date || tx.date,
          status: derived,
          payment_method: tx.payment_method,
          amount_cents: tx.amount_cents,
          rawTransaction: tx,
          is_recurring: tx.is_recurring,
        };
      });
  }, [transactions, selectedYearMonth, categories]);

  // 2. Card Invoices for the selected month that have purchases/commitments
  const invoiceItems = useMemo<DisplayItem[]>(() => {
    const today = getTodayDateStr();
    return invoices
      .filter((inv) => inv.year_month === selectedYearMonth && inv.total_amount_cents > 0)
      .map((inv) => {
        const card = creditCards.find((c) => c.id === inv.card_id);
        const cardName = card?.name || 'Cartão';
        const isPaid =
          inv.status === 'paid' ||
          (inv.total_amount_cents > 0 && inv.paid_amount_cents >= inv.total_amount_cents);
        const isOverdue = !isPaid && (inv.due_date || '') < today;
        const derivedStatus: 'completed' | 'pending' | 'overdue' = isPaid
          ? 'completed'
          : isOverdue
          ? 'overdue'
          : 'pending';

        return {
          id: `inv_display_${inv.id}`,
          isInvoice: true,
          type: 'expense' as const,
          description: `Fatura de ${cardName}`,
          categoryName: card?.issuer ? `Cartão • ${card.issuer}` : 'Fatura de Cartão',
          categoryColor: card?.color || '#8b5cf6',
          date: inv.closing_date || inv.due_date,
          due_date: inv.due_date,
          status: derivedStatus,
          payment_method: 'credit_card',
          amount_cents: inv.total_amount_cents,
          rawInvoice: inv,
          card,
        };
      });
  }, [invoices, selectedYearMonth, creditCards]);

  // Combine regular transactions and invoices
  const combinedItems = useMemo<DisplayItem[]>(() => {
    return [...regularItems, ...invoiceItems];
  }, [regularItems, invoiceItems]);

  // Apply filters (search, type, status, category)
  const filteredItems = useMemo<DisplayItem[]>(() => {
    return combinedItems.filter((item) => {
      // Filter by type
      if (filterType !== 'all' && item.type !== filterType) return false;

      // Filter by category (for regular transactions)
      if (filterCategory !== 'all') {
        if (item.isInvoice) {
          // If filtering by specific category, invoices only match if category filter is all
          return false;
        }
        if (item.rawTransaction?.category_id !== filterCategory) return false;
      }

      // Filter by status
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.categoryName.toLowerCase().includes(q);
        const matchCard = item.card?.name.toLowerCase().includes(q);
        return matchDesc || matchCat || matchCard;
      }

      return true;
    });
  }, [combinedItems, filterType, filterCategory, filterStatus, searchQuery]);

  // Apply sorting / reorganization
  const sortedItems = useMemo<DisplayItem[]>(() => {
    return [...filteredItems].sort((a, b) => {
      switch (sortBy) {
        case 'due_date_asc': {
          const da = a.due_date || a.date || '';
          const db = b.due_date || b.date || '';
          const cmp = da.localeCompare(db);
          if (cmp !== 0) return cmp;
          return a.description.localeCompare(b.description, 'pt-BR');
        }
        case 'due_date_desc': {
          const da = a.due_date || a.date || '';
          const db = b.due_date || b.date || '';
          const cmp = db.localeCompare(da);
          if (cmp !== 0) return cmp;
          return a.description.localeCompare(b.description, 'pt-BR');
        }
        case 'date_desc': {
          const da = a.date || a.due_date || '';
          const db = b.date || b.due_date || '';
          const cmp = db.localeCompare(da);
          if (cmp !== 0) return cmp;
          return (b.due_date || '').localeCompare(a.due_date || '');
        }
        case 'date_asc': {
          const da = a.date || a.due_date || '';
          const db = b.date || b.due_date || '';
          const cmp = da.localeCompare(db);
          if (cmp !== 0) return cmp;
          return (a.due_date || '').localeCompare(b.due_date || '');
        }
        case 'amount_desc':
          return b.amount_cents - a.amount_cents;
        case 'amount_asc':
          return a.amount_cents - b.amount_cents;
        case 'description_asc':
          return a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' });
        case 'description_desc':
          return b.description.localeCompare(a.description, 'pt-BR', { sensitivity: 'base' });
        default:
          return 0;
      }
    });
  }, [filteredItems, sortBy]);

  // Toggle status for regular transactions
  const handleToggleStatus = async (tx: Transaction) => {
    const isNowCompleted = tx.status === 'pending';
    const today = getTodayDateStr();
    await updateTransaction({
      ...tx,
      status: isNowCompleted ? 'completed' : 'pending',
      payment_date: isNowCompleted ? today : undefined,
    });
  };

  // Open pay invoice modal
  const handleOpenPayInvoice = (inv: Invoice) => {
    setPayingInvoice(inv);
    const remaining = Math.max(0, inv.total_amount_cents - inv.paid_amount_cents);
    setPayAmountStr(fromCents(remaining > 0 ? remaining : inv.total_amount_cents).toFixed(2).replace('.', ','));
    setPayDate(getTodayDateStr());
    setPayNotes('');
    setPayError('');
  };

  // Submit invoice payment
  const handlePayInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    const val = parseFloat(payAmountStr.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setPayError('Informe um valor de pagamento válido maior que zero.');
      return;
    }

    const cents = toCents(val);
    await payInvoice(payingInvoice, cents, payDate, payNotes.trim() || undefined);
    setPayingInvoice(null);
    setPayError('');
  };

  // Delete transaction handler
  const handleConfirmDelete = async () => {
    if (txToDelete) {
      await deleteTransaction(txToDelete.id);
      setTxToDelete(null);
    }
  };

  // Clickable header sort toggling
  const handleToggleHeaderSort = (column: 'description' | 'date' | 'due_date' | 'amount') => {
    if (column === 'due_date') {
      setSortBy(sortBy === 'due_date_asc' ? 'due_date_desc' : 'due_date_asc');
    } else if (column === 'date') {
      setSortBy(sortBy === 'date_desc' ? 'date_asc' : 'date_desc');
    } else if (column === 'amount') {
      setSortBy(sortBy === 'amount_desc' ? 'amount_asc' : 'amount_desc');
    } else if (column === 'description') {
      setSortBy(sortBy === 'description_asc' ? 'description_desc' : 'description_asc');
    }
  };

  const getSortIcon = (column: 'description' | 'date' | 'due_date' | 'amount') => {
    if (column === 'due_date') {
      if (sortBy === 'due_date_asc') return <ArrowUp size={13} className="sort-icon-active" />;
      if (sortBy === 'due_date_desc') return <ArrowDown size={13} className="sort-icon-active" />;
    } else if (column === 'date') {
      if (sortBy === 'date_asc') return <ArrowUp size={13} className="sort-icon-active" />;
      if (sortBy === 'date_desc') return <ArrowDown size={13} className="sort-icon-active" />;
    } else if (column === 'amount') {
      if (sortBy === 'amount_asc') return <ArrowUp size={13} className="sort-icon-active" />;
      if (sortBy === 'amount_desc') return <ArrowDown size={13} className="sort-icon-active" />;
    } else if (column === 'description') {
      if (sortBy === 'description_asc') return <ArrowUp size={13} className="sort-icon-active" />;
      if (sortBy === 'description_desc') return <ArrowDown size={13} className="sort-icon-active" />;
    }
    return <ArrowUpDown size={12} className="sort-icon-inactive" />;
  };

  return (
    <div className="transactions-container">
      {/* Filters & Sorting Toolbar */}
      <div className="transactions-filter-bar">
        <div className="filters-group">
          {/* Search Input */}
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon-pos" />
            <input
              type="text"
              placeholder="Buscar por descrição ou fatura..."
              className="form-input search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Selects Container for responsive mobile and desktop layout */}
          <div className="filters-selects-container">
            {/* Type Filter */}
            <select
              className="form-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              title="Filtrar por Tipo"
            >
              <option value="all">Todos os Tipos</option>
              <option value="income">Apenas Receitas</option>
              <option value="expense">Apenas Despesas e Faturas</option>
            </select>

            {/* Status Filter */}
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              title="Filtrar por Status"
            >
              <option value="all">Todos os Status</option>
              <option value="completed">Pagos / Recebidos</option>
              <option value="pending">Pendentes / Abertos</option>
              <option value="overdue">Vencidos</option>
            </select>

            {/* Category Filter */}
            <select
              className="form-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              title="Filtrar por Categoria"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Reorganization / Sort Filter */}
            <select
              className="form-select sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              title="Organizar e Reordenar Lançamentos"
            >
              <option value="due_date_asc">Vencimento (Mais próximas)</option>
              <option value="due_date_desc">Vencimento (Mais distantes)</option>
              <option value="date_desc">Data (Mais recentes)</option>
              <option value="date_asc">Data (Mais antigas)</option>
              <option value="amount_desc">Valor (Maior primeiro)</option>
              <option value="amount_asc">Valor (Menor primeiro)</option>
              <option value="description_asc">Descrição (A - Z)</option>
              <option value="description_desc">Descrição (Z - A)</option>
            </select>
          </div>
        </div>

        <button onClick={onOpenNewTx} className="btn btn-primary" style={{ flexShrink: 0 }}>
          <PlusCircle size={16} />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Transactions & Invoices Table Container */}
      <div className="tx-table-container">
        {sortedItems.length > 0 ? (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="tx-desktop-table-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th
                      className="sortable-th"
                      onClick={() => handleToggleHeaderSort('description')}
                      title="Clique para ordenar por Descrição"
                    >
                      <div className="th-sort-content">
                        <span>Descrição & Categoria</span>
                        {getSortIcon('description')}
                      </div>
                    </th>
                    <th
                      className="sortable-th"
                      onClick={() => handleToggleHeaderSort('date')}
                      title="Clique para ordenar por Data de Lançamento"
                    >
                      <div className="th-sort-content">
                        <span>Data</span>
                        {getSortIcon('date')}
                      </div>
                    </th>
                    <th
                      className="sortable-th"
                      onClick={() => handleToggleHeaderSort('due_date')}
                      title="Clique para ordenar por Data de Vencimento"
                    >
                      <div className="th-sort-content">
                        <span>Vencimento</span>
                        {getSortIcon('due_date')}
                      </div>
                    </th>
                    <th>Status</th>
                    <th>Forma</th>
                    <th
                      className="sortable-th"
                      style={{ textAlign: 'right' }}
                      onClick={() => handleToggleHeaderSort('amount')}
                      title="Clique para ordenar por Valor"
                    >
                      <div className="th-sort-content" style={{ justifyContent: 'flex-end' }}>
                        <span>Valor</span>
                        {getSortIcon('amount')}
                      </div>
                    </th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const isExpense = item.type === 'expense';

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="tx-desc-cell">
                            <div
                              className="tx-cat-icon"
                              style={{
                                backgroundColor: item.isInvoice
                                  ? 'rgba(139, 92, 246, 0.15)'
                                  : isExpense
                                  ? 'var(--color-expense-bg)'
                                  : 'var(--color-income-bg)',
                                color: item.isInvoice
                                  ? '#8b5cf6'
                                  : isExpense
                                  ? 'var(--color-expense)'
                                  : 'var(--color-income)',
                              }}
                            >
                              {item.isInvoice ? (
                                <CreditCard size={18} />
                              ) : isExpense ? (
                                <ArrowDownLeft size={16} />
                              ) : (
                                <ArrowUpRight size={16} />
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {item.description}
                              </div>
                              <div className="tx-meta-sub">
                                {item.isInvoice ? (
                                  <span
                                    style={{
                                      color: '#8b5cf6',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      fontWeight: 500,
                                    }}
                                  >
                                    <CreditCard size={11} />
                                    {item.categoryName}
                                  </span>
                                ) : (
                                  <span>{item.categoryName}</span>
                                )}

                                {item.isInvoice && item.rawInvoice?.status === 'partially_paid' && (
                                  <span style={{ color: 'var(--color-warning)' }}>
                                    • Pago: {formatCurrencyBRL(item.rawInvoice.paid_amount_cents)}
                                  </span>
                                )}

                                {item.is_recurring && (
                                  <span
                                    style={{
                                      marginLeft: '0.4rem',
                                      color: 'var(--brand-primary)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}
                                  >
                                    <Repeat size={11} /> Recorrente
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>{formatDateBRL(item.date)}</td>

                        <td>
                          {item.due_date ? (
                            <span
                              style={{
                                fontWeight: item.isInvoice ? 600 : 'normal',
                                color: item.isInvoice ? 'var(--text-primary)' : 'inherit',
                              }}
                            >
                              {formatDateBRL(item.due_date)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>

                        <td>
                          {item.isInvoice ? (
                            <button
                              onClick={() => {
                                if (item.status !== 'completed' && item.rawInvoice) {
                                  handleOpenPayInvoice(item.rawInvoice);
                                }
                              }}
                              className={`badge ${
                                item.status === 'completed'
                                  ? 'badge-paid'
                                  : item.status === 'overdue'
                                  ? 'badge-overdue'
                                  : 'badge-pending'
                              }`}
                              title={
                                item.status === 'completed'
                                  ? 'Fatura Paga'
                                  : 'Clique para pagar esta fatura'
                              }
                              style={{
                                cursor: item.status !== 'completed' ? 'pointer' : 'default',
                              }}
                            >
                              {item.status === 'completed' ? (
                                <>
                                  <CheckCircle size={12} />
                                  <span>Paga</span>
                                </>
                              ) : item.status === 'overdue' ? (
                                <>
                                  <AlertCircle size={12} />
                                  <span>Vencida</span>
                                </>
                              ) : (
                                <>
                                  <Clock size={12} />
                                  <span>Pendente</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => item.rawTransaction && handleToggleStatus(item.rawTransaction)}
                              className={`badge ${
                                item.status === 'completed'
                                  ? 'badge-paid'
                                  : item.status === 'overdue'
                                  ? 'badge-overdue'
                                  : 'badge-pending'
                              }`}
                              title="Clique para alternar entre Pago/Recebido e Pendente"
                            >
                              {item.status === 'completed' ? (
                                <>
                                  <CheckCircle size={12} />
                                  <span>{item.type === 'income' ? 'Recebido' : 'Pago'}</span>
                                </>
                              ) : item.status === 'overdue' ? (
                                <>
                                  <AlertCircle size={12} />
                                  <span>Vencido</span>
                                </>
                              ) : (
                                <>
                                  <Clock size={12} />
                                  <span>Pendente</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        <td>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {item.isInvoice
                              ? 'Fatura Cartão'
                              : item.payment_method === 'credit_card'
                              ? 'Cartão'
                              : item.payment_method === 'cash'
                              ? 'Dinheiro'
                              : 'Conta'}
                          </span>
                        </td>

                        <td
                          className={`tx-amount-col ${isExpense ? 'expense' : 'income'}`}
                          style={{
                            color: isExpense ? 'var(--color-expense)' : 'var(--color-income)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {isExpense ? '- ' : '+ '}
                          {formatCurrencyBRL(item.amount_cents)}
                        </td>

                        <td className="tx-actions-col">
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.35rem',
                            }}
                          >
                            {item.isInvoice ? (
                              <>
                                {item.status !== 'completed' && item.rawInvoice && (
                                  <button
                                    onClick={() => handleOpenPayInvoice(item.rawInvoice!)}
                                    className="btn-pay-action"
                                    title="Pagar Fatura do Cartão"
                                  >
                                    <DollarSign size={13} />
                                    <span>Pagar</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => onNavigateTab?.('cards')}
                                  className="btn-icon"
                                  title="Ver compras e detalhes no Cartões"
                                  aria-label="Ver no Cartão"
                                  style={{ color: '#8b5cf6' }}
                                >
                                  <CreditCard size={15} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => item.rawTransaction && onEditTx(item.rawTransaction)}
                                  className="btn-icon"
                                  title="Editar lançamento"
                                  aria-label="Editar"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => item.rawTransaction && setTxToDelete(item.rawTransaction)}
                                  className="btn-icon"
                                  title="Excluir lançamento"
                                  aria-label="Excluir"
                                  style={{ color: 'var(--color-expense)' }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="tx-mobile-list" style={{ padding: '0.75rem' }}>
              {sortedItems.map((item) => {
                const isExpense = item.type === 'expense';

                return (
                  <div key={`mob-${item.id}`} className="tx-mobile-card">
                    <div className="tx-mobile-card-header">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          minWidth: 0,
                        }}
                      >
                        <div
                          className="tx-cat-icon"
                          style={{
                            backgroundColor: item.isInvoice
                              ? 'rgba(139, 92, 246, 0.15)'
                              : isExpense
                              ? 'var(--color-expense-bg)'
                              : 'var(--color-income-bg)',
                            color: item.isInvoice
                              ? '#8b5cf6'
                              : isExpense
                              ? 'var(--color-expense)'
                              : 'var(--color-income)',
                          }}
                        >
                          {item.isInvoice ? (
                            <CreditCard size={18} />
                          ) : isExpense ? (
                            <ArrowDownLeft size={16} />
                          ) : (
                            <ArrowUpRight size={16} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="tx-mobile-card-title">{item.description}</div>
                          <div className="tx-meta-sub">
                            {item.isInvoice ? (
                              <span style={{ color: '#8b5cf6', fontWeight: 500 }}>
                                {item.categoryName}
                              </span>
                            ) : (
                              <span>{item.categoryName}</span>
                            )}
                            <span>•</span>
                            <span>{formatDateBRL(item.date)}</span>
                            {item.due_date && item.due_date !== item.date && (
                              <span>(Vence {formatDateBRL(item.due_date)})</span>
                            )}
                            {item.isInvoice && item.rawInvoice?.status === 'partially_paid' && (
                              <span style={{ color: 'var(--color-warning)' }}>
                                • Pago: {formatCurrencyBRL(item.rawInvoice.paid_amount_cents)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="tx-mobile-card-amount"
                        style={{ color: isExpense ? 'var(--color-expense)' : 'var(--color-income)' }}
                      >
                        {isExpense ? '- ' : '+ '}
                        {formatCurrencyBRL(item.amount_cents)}
                      </div>
                    </div>

                    <div className="tx-mobile-card-footer">
                      {item.isInvoice ? (
                        <button
                          onClick={() => {
                            if (item.status !== 'completed' && item.rawInvoice) {
                              handleOpenPayInvoice(item.rawInvoice);
                            }
                          }}
                          className={`badge ${
                            item.status === 'completed'
                              ? 'badge-paid'
                              : item.status === 'overdue'
                              ? 'badge-overdue'
                              : 'badge-pending'
                          }`}
                          title={
                            item.status === 'completed'
                              ? 'Fatura Paga'
                              : 'Clique para pagar fatura'
                          }
                        >
                          {item.status === 'completed' ? (
                            <>
                              <CheckCircle size={12} />
                              <span>Paga</span>
                            </>
                          ) : item.status === 'overdue' ? (
                            <>
                              <AlertCircle size={12} />
                              <span>Vencida</span>
                            </>
                          ) : (
                            <>
                              <Clock size={12} />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => item.rawTransaction && handleToggleStatus(item.rawTransaction)}
                          className={`badge ${
                            item.status === 'completed'
                              ? 'badge-paid'
                              : item.status === 'overdue'
                              ? 'badge-overdue'
                              : 'badge-pending'
                          }`}
                          title="Alternar status"
                        >
                          {item.status === 'completed' ? (
                            <>
                              <CheckCircle size={12} />
                              <span>{item.type === 'income' ? 'Recebido' : 'Pago'}</span>
                            </>
                          ) : item.status === 'overdue' ? (
                            <>
                              <AlertCircle size={12} />
                              <span>Vencido</span>
                            </>
                          ) : (
                            <>
                              <Clock size={12} />
                              <span>Pendente</span>
                            </>
                          )}
                        </button>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {item.isInvoice ? (
                          <>
                            {item.status !== 'completed' && item.rawInvoice && (
                              <button
                                onClick={() => handleOpenPayInvoice(item.rawInvoice!)}
                                className="btn-pay-action"
                                style={{ padding: '0.3rem 0.6rem' }}
                              >
                                <DollarSign size={13} />
                                <span>Pagar</span>
                              </button>
                            )}
                            <button
                              onClick={() => onNavigateTab?.('cards')}
                              className="btn-icon"
                              title="Ver no Cartão"
                              style={{ color: '#8b5cf6', padding: '0.35rem' }}
                            >
                              <CreditCard size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                marginRight: '0.4rem',
                              }}
                            >
                              {item.payment_method === 'credit_card'
                                ? 'Cartão'
                                : item.payment_method === 'cash'
                                ? 'Dinheiro'
                                : 'Conta'}
                            </span>
                            <button
                              onClick={() => item.rawTransaction && onEditTx(item.rawTransaction)}
                              className="btn-icon"
                              title="Editar"
                              aria-label="Editar lançamento"
                              style={{ padding: '0.35rem' }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => item.rawTransaction && setTxToDelete(item.rawTransaction)}
                              className="btn-icon"
                              title="Excluir"
                              aria-label="Excluir lançamento"
                              style={{ color: 'var(--color-expense)', padding: '0.35rem' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p className="empty-title">Nenhum lançamento encontrado</p>
            <p className="empty-desc">
              Não há movimentações ou faturas correspondentes aos filtros selecionados para {selectedYearMonth}.
            </p>
            <button onClick={onOpenNewTx} className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Adicionar Lançamento</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Transaction Deletion */}
      {txToDelete && (
        <div className="modal-overlay" onClick={() => setTxToDelete(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-expense)' }}>
                Confirmar Exclusão
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Tem certeza que deseja excluir o lançamento <strong>"{txToDelete.description}"</strong> no
                valor de <strong>{formatCurrencyBRL(txToDelete.amount_cents)}</strong>?
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Esta ação atualizará automaticamente o saldo atual e os orçamentos da categoria.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTxToDelete(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>
                <Trash2 size={16} />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {payingInvoice && (
        <div className="modal-overlay" onClick={() => setPayingInvoice(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={20} style={{ color: '#8b5cf6' }} />
                <h3 className="modal-title">
                  Pagar Fatura de {creditCards.find((c) => c.id === payingInvoice.card_id)?.name || 'Cartão'}
                </h3>
              </div>
              <button
                className="btn-icon"
                onClick={() => setPayingInvoice(null)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePayInvoiceSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {payError && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-expense-bg)',
                      color: 'var(--color-expense)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {payError}
                  </div>
                )}

                {/* Summary Info Box */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Total da Fatura
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {formatCurrencyBRL(payingInvoice.total_amount_cents)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Total Já Pago
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--color-income)', marginTop: '0.2rem' }}>
                      {formatCurrencyBRL(payingInvoice.paid_amount_cents)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Saldo Pendente
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--color-expense)', marginTop: '0.2rem' }}>
                      {formatCurrencyBRL(
                        Math.max(0, payingInvoice.total_amount_cents - payingInvoice.paid_amount_cents)
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Vencimento:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatDateBRL(payingInvoice.due_date)}
                  </strong>{' '}
                  • Ciclo: {payingInvoice.year_month}
                </div>

                <div className="form-group">
                  <label className="form-label">Valor a Pagar (R$)</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={payAmountStr}
                    onChange={(e) => setPayAmountStr(e.target.value)}
                    placeholder="0,00"
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Você pode efetuar o pagamento integral ou parcial desta fatura.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Observações (opcional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Ex: Pago via conta corrente..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPayingInvoice(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <DollarSign size={16} />
                  <span>Confirmar Pagamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

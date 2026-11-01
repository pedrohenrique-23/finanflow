import React, { useState, useMemo } from 'react';
import {
  PlusCircle,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Tag,
  CreditCard,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Transaction, TransactionType } from '../domain/types';
import {
  formatCurrencyBRL,
  formatDateBRL,
  deriveTransactionStatus,
  getTodayDateStr,
} from '../domain/finance';

interface TransactionsPageProps {
  onOpenNewTx: () => void;
  onEditTx: (tx: Transaction) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ onOpenNewTx, onEditTx }) => {
  const {
    transactions,
    categories,
    selectedYearMonth,
    deleteTransaction,
    updateTransaction,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Filter for currently selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const d = tx.date || tx.due_date;
      return d && d.startsWith(selectedYearMonth);
    });
  }, [transactions, selectedYearMonth]);

  // Apply search and status filters
  const filteredTransactions = useMemo(() => {
    return monthTransactions
      .filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterCategory !== 'all' && tx.category_id !== filterCategory) return false;

        const derived = deriveTransactionStatus(tx);
        if (filterStatus === 'completed' && derived !== 'completed') return false;
        if (filterStatus === 'pending' && derived !== 'pending') return false;
        if (filterStatus === 'overdue' && derived !== 'overdue') return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const cat = categories.find((c) => c.id === tx.category_id)?.name.toLowerCase();
          const matchCat = cat?.includes(q);
          return matchDesc || matchCat;
        }

        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [monthTransactions, filterType, filterStatus, filterCategory, searchQuery, categories]);

  // Quick action: toggle between completed and pending
  const handleToggleStatus = async (tx: Transaction) => {
    const isNowCompleted = tx.status === 'pending';
    const today = getTodayDateStr();
    await updateTransaction({
      ...tx,
      status: isNowCompleted ? 'completed' : 'pending',
      payment_date: isNowCompleted ? today : undefined,
    });
  };

  const handleConfirmDelete = async () => {
    if (txToDelete) {
      await deleteTransaction(txToDelete.id);
      setTxToDelete(null);
    }
  };

  return (
    <div className="transactions-container">
      {/* Filters Toolbar */}
      <div className="transactions-filter-bar">
        <div className="filters-group">
          {/* Search Input */}
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon-pos" />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              className="form-input search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Selects Container for responsive mobile layout */}
          <div className="filters-selects-container">
            {/* Type Filter */}
            <select
              className="form-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">Todos os Tipos</option>
              <option value="income">Apenas Receitas</option>
              <option value="expense">Apenas Despesas</option>
            </select>

            {/* Status Filter */}
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">Todos os Status</option>
              <option value="completed">Pagos / Recebidos</option>
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidos</option>
            </select>

            {/* Category Filter */}
            <select
              className="form-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={onOpenNewTx} className="btn btn-primary" style={{ flexShrink: 0 }}>
          <PlusCircle size={16} />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* Transactions Container */}
      <div className="tx-table-container">
        {filteredTransactions.length > 0 ? (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="tx-desktop-table-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Descrição & Categoria</th>
                    <th>Data</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th>Forma</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const category = categories.find((c) => c.id === tx.category_id);
                    const derivedStatus = deriveTransactionStatus(tx);
                    const isExpense = tx.type === 'expense';

                    return (
                      <tr key={tx.id}>
                        <td>
                          <div className="tx-desc-cell">
                            <div
                              className="tx-cat-icon"
                              style={{
                                backgroundColor: isExpense ? 'var(--color-expense-bg)' : 'var(--color-income-bg)',
                                color: isExpense ? 'var(--color-expense)' : 'var(--color-income)',
                              }}
                            >
                              {isExpense ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {tx.description}
                              </div>
                              <div className="tx-meta-sub">
                                {category?.name || 'Sem categoria'}
                                {tx.is_recurring && (
                                  <span style={{ marginLeft: '0.4rem', color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    <Repeat size={11} /> Recorrente
                                  </span>
                                )}
                                {tx.is_invoice_payment && (
                                  <span style={{ marginLeft: '0.4rem', color: '#8b5cf6', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    <CreditCard size={11} /> Pagamento Fatura
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>{formatDateBRL(tx.date)}</td>

                        <td>
                          {tx.due_date ? (
                            formatDateBRL(tx.due_date)
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>

                        <td>
                          <button
                            onClick={() => handleToggleStatus(tx)}
                            className={`badge ${
                              derivedStatus === 'completed'
                                ? 'badge-paid'
                                : derivedStatus === 'overdue'
                                ? 'badge-overdue'
                                : 'badge-pending'
                            }`}
                            title="Clique para alternar entre Pago/Recebido e Pendente"
                          >
                            {derivedStatus === 'completed' ? (
                              <>
                                <CheckCircle size={12} />
                                <span>{tx.type === 'income' ? 'Recebido' : 'Pago'}</span>
                              </>
                            ) : derivedStatus === 'overdue' ? (
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
                        </td>

                        <td>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            {tx.payment_method === 'credit_card'
                              ? 'Cartão'
                              : tx.payment_method === 'cash'
                              ? 'Dinheiro'
                              : 'Conta'}
                          </span>
                        </td>

                        <td
                          className={`tx-amount-col ${
                            isExpense ? 'expense' : 'income'
                          }`}
                          style={{
                            color: isExpense ? 'var(--color-expense)' : 'var(--color-income)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {isExpense ? '- ' : '+ '}
                          {formatCurrencyBRL(tx.amount_cents)}
                        </td>

                        <td className="tx-actions-col">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <button
                              onClick={() => onEditTx(tx)}
                              className="btn-icon"
                              title="Editar lançamento"
                              aria-label="Editar"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setTxToDelete(tx)}
                              className="btn-icon"
                              title="Excluir lançamento"
                              aria-label="Excluir"
                              style={{ color: 'var(--color-expense)' }}
                            >
                              <Trash2 size={15} />
                            </button>
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
              {filteredTransactions.map((tx) => {
                const category = categories.find((c) => c.id === tx.category_id);
                const derivedStatus = deriveTransactionStatus(tx);
                const isExpense = tx.type === 'expense';

                return (
                  <div key={`mob-${tx.id}`} className="tx-mobile-card">
                    <div className="tx-mobile-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <div
                          className="tx-cat-icon"
                          style={{
                            backgroundColor: isExpense ? 'var(--color-expense-bg)' : 'var(--color-income-bg)',
                            color: isExpense ? 'var(--color-expense)' : 'var(--color-income)',
                          }}
                        >
                          {isExpense ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="tx-mobile-card-title">{tx.description}</div>
                          <div className="tx-meta-sub">
                            <span>{category?.name || 'Sem categoria'}</span>
                            <span>•</span>
                            <span>{formatDateBRL(tx.date)}</span>
                            {tx.due_date && tx.due_date !== tx.date && (
                              <span>(Vence {formatDateBRL(tx.due_date)})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="tx-mobile-card-amount"
                        style={{ color: isExpense ? 'var(--color-expense)' : 'var(--color-income)' }}
                      >
                        {isExpense ? '- ' : '+ '}
                        {formatCurrencyBRL(tx.amount_cents)}
                      </div>
                    </div>

                    <div className="tx-mobile-card-footer">
                      <button
                        onClick={() => handleToggleStatus(tx)}
                        className={`badge ${
                          derivedStatus === 'completed'
                            ? 'badge-paid'
                            : derivedStatus === 'overdue'
                            ? 'badge-overdue'
                            : 'badge-pending'
                        }`}
                        title="Alternar status"
                      >
                        {derivedStatus === 'completed' ? (
                          <>
                            <CheckCircle size={12} />
                            <span>{tx.type === 'income' ? 'Recebido' : 'Pago'}</span>
                          </>
                        ) : derivedStatus === 'overdue' ? (
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.4rem' }}>
                          {tx.payment_method === 'credit_card'
                            ? 'Cartão'
                            : tx.payment_method === 'cash'
                            ? 'Dinheiro'
                            : 'Conta'}
                        </span>
                        <button
                          onClick={() => onEditTx(tx)}
                          className="btn-icon"
                          title="Editar"
                          aria-label="Editar lançamento"
                          style={{ padding: '0.35rem' }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setTxToDelete(tx)}
                          className="btn-icon"
                          title="Excluir"
                          aria-label="Excluir lançamento"
                          style={{ color: 'var(--color-expense)', padding: '0.35rem' }}
                        >
                          <Trash2 size={15} />
                        </button>
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
              Não há movimentações correspondentes aos filtros selecionados para {selectedYearMonth}.
            </p>
            <button onClick={onOpenNewTx} className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Adicionar Lançamento</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Deletion */}
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
    </div>
  );
};

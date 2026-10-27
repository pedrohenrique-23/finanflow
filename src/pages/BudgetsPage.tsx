import React, { useState, useMemo } from 'react';
import {
  PieChart as PieIcon,
  Copy,
  PlusCircle,
  AlertTriangle,
  CheckCircle,
  Edit2,
  TrendingDown,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatCurrencyBRL, fromCents, toCents, calculateBudgetStatus, addMonthsToYearMonth } from '../domain/finance';

export const BudgetsPage: React.FC = () => {
  const {
    budgets,
    categories,
    transactions,
    installments,
    selectedYearMonth,
    saveBudget,
    copyPreviousMonthBudgets,
  } = useApp();

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [budgetLimitStr, setBudgetLimitStr] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'expense' && !c.is_archived);
  }, [categories]);

  // Calculate actual spending per category in selected month:
  // Direct cash expenses in category + card installments assigned to this category in this month
  const categorySpending = useMemo(() => {
    const map = new Map<string, number>();

    // Direct expenses
    for (const tx of transactions) {
      if (
        tx.type === 'expense' &&
        tx.status === 'completed' &&
        tx.payment_method !== 'credit_card' &&
        !tx.is_invoice_payment &&
        (tx.date || tx.due_date)?.startsWith(selectedYearMonth)
      ) {
        map.set(tx.category_id, (map.get(tx.category_id) || 0) + tx.amount_cents);
      }
    }

    // Card installments
    for (const inst of installments) {
      if (inst.cycle_year_month === selectedYearMonth) {
        // default to first expense category if unmapped
        const defaultCatId = expenseCategories[0]?.id || 'cat_exp_1';
        map.set(defaultCatId, (map.get(defaultCatId) || 0) + inst.amount_cents);
      }
    }

    return map;
  }, [transactions, installments, selectedYearMonth, expenseCategories]);

  const handleSaveBudget = async (categoryId: string) => {
    const val = parseFloat(budgetLimitStr.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      await saveBudget(categoryId, selectedYearMonth, toCents(val));
      setEditingCategoryId(null);
      setBudgetLimitStr('');
      setFeedbackMsg({ text: 'Orçamento atualizado com sucesso!', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  const handleCopyFromPrevious = async () => {
    const count = await copyPreviousMonthBudgets(selectedYearMonth);
    const prevYm = addMonthsToYearMonth(selectedYearMonth, -1);
    if (count > 0) {
      setFeedbackMsg({
        text: `${count} orçamentos importados de ${prevYm} para ${selectedYearMonth}!`,
        type: 'success',
      });
    } else {
      setFeedbackMsg({
        text: `Nenhum orçamento encontrado em ${prevYm} para ser importado.`,
        type: 'info',
      });
    }
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Summary of total planned budget vs spent
  const totalBudgetSummary = useMemo(() => {
    const monthBudgets = budgets.filter((b) => b.year_month === selectedYearMonth);
    const totalPlannedCents = monthBudgets.reduce((s, b) => s + b.limit_cents, 0);
    let totalSpentInBudgetedCents = 0;

    for (const b of monthBudgets) {
      totalSpentInBudgetedCents += categorySpending.get(b.category_id) || 0;
    }

    const { percentage, status } = calculateBudgetStatus(totalSpentInBudgetedCents, totalPlannedCents);

    return {
      totalPlannedCents,
      totalSpentInBudgetedCents,
      percentage,
      status,
    };
  }, [budgets, categorySpending, selectedYearMonth]);

  return (
    <div className="budgets-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Orçamentos Mensais por Categoria
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Defina limites máximos para cada tipo de gasto no mês de {selectedYearMonth}
          </p>
        </div>

        <button onClick={handleCopyFromPrevious} className="btn btn-secondary">
          <Copy size={16} />
          <span>Copiar Orçamentos do Mês Anterior</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className={`alert-banner ${feedbackMsg.type === 'success' ? 'info' : 'warning'}`}>
          <Info size={16} />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Overview Card */}
      {totalBudgetSummary.totalPlannedCents > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Resumo do Planejamento ({selectedYearMonth})</h3>
            <span className="card-subtitle">
              Total Consumido: {formatCurrencyBRL(totalBudgetSummary.totalSpentInBudgetedCents)} de{' '}
              {formatCurrencyBRL(totalBudgetSummary.totalPlannedCents)}
            </span>
          </div>

          <div className="progress-container">
            <div className="progress-header">
              <span>Utilização Global</span>
              <span style={{ fontWeight: 700 }}>{totalBudgetSummary.percentage}%</span>
            </div>
            <div className="progress-track" style={{ height: 10 }}>
              <div
                className={`progress-fill ${
                  totalBudgetSummary.status === 'exceeded'
                    ? 'danger'
                    : totalBudgetSummary.status === 'warning'
                    ? 'warning'
                    : ''
                }`}
                style={{ width: `${Math.min(100, totalBudgetSummary.percentage)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Categories Budget Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {expenseCategories.map((cat) => {
          const budget = budgets.find((b) => b.category_id === cat.id && b.year_month === selectedYearMonth);
          const limitCents = budget?.limit_cents || 0;
          const spentCents = categorySpending.get(cat.id) || 0;
          const { percentage, remainingCents, status } = calculateBudgetStatus(spentCents, limitCents);
          const isEditing = editingCategoryId === cat.id;

          return (
            <div key={cat.id} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: cat.color || 'var(--brand-primary)',
                    }}
                  />
                  <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{cat.name}</h4>
                </div>

                <button
                  onClick={() => {
                    setEditingCategoryId(cat.id);
                    setBudgetLimitStr(limitCents > 0 ? String(fromCents(limitCents)) : '');
                  }}
                  className="btn-icon"
                  title="Ajustar limite deste mês"
                  aria-label="Ajustar limite"
                >
                  <Edit2 size={15} />
                </button>
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-input"
                    placeholder="Limite em R$"
                    value={budgetLimitStr}
                    onChange={(e) => setBudgetLimitStr(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => handleSaveBudget(cat.id)} className="btn btn-primary btn-sm">
                    Salvar
                  </button>
                  <button onClick={() => setEditingCategoryId(null)} className="btn btn-secondary btn-sm">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: 'var(--text-xs)' }}>
                      Gasto Atual
                    </span>
                    <strong style={{ fontSize: 'var(--text-base)' }}>{formatCurrencyBRL(spentCents)}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: 'var(--text-xs)' }}>
                      Teto Planejado
                    </span>
                    <strong style={{ fontSize: 'var(--text-base)' }}>
                      {limitCents > 0 ? formatCurrencyBRL(limitCents) : 'Não definido'}
                    </strong>
                  </div>
                </div>
              )}

              {limitCents > 0 ? (
                <div className="progress-container">
                  <div className="progress-header">
                    <span>
                      {remainingCents >= 0
                        ? `Restam ${formatCurrencyBRL(remainingCents)}`
                        : `Excedido em ${formatCurrencyBRL(Math.abs(remainingCents))}`}
                    </span>
                    <span
                      style={{
                        color:
                          status === 'exceeded'
                            ? 'var(--color-expense)'
                            : status === 'warning'
                            ? 'var(--color-warning)'
                            : 'var(--color-income)',
                        fontWeight: 700,
                      }}
                    >
                      {percentage}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${
                        status === 'exceeded' ? 'danger' : status === 'warning' ? 'warning' : ''
                      }`}
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                  Toque no ícone de lápis para definir uma meta de gastos para {cat.name}.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

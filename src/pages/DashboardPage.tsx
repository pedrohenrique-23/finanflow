import React, { useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  CreditCard,
  PlusCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { formatCurrencyBRL, formatDateBRL, fromCents, deriveTransactionStatus } from '../domain/finance';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#64748b'];

interface DashboardPageProps {
  onOpenNewTx: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenNewTx, onNavigateTab }) => {
  const {
    metrics,
    selectedYearMonth,
    transactions,
    categories,
    creditCards,
    installments,
    invoices,
    budgets,
  } = useApp();

  // Filter transactions for this month
  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const d = tx.date || tx.due_date;
      return d && d.startsWith(selectedYearMonth);
    });
  }, [transactions, selectedYearMonth]);

  // Upcoming and overdue obligations in this month
  const upcomingBills = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'expense' && tx.status === 'pending')
      .map((tx) => ({
        ...tx,
        derivedStatus: deriveTransactionStatus(tx),
      }))
      .sort((a, b) => (a.due_date || a.date).localeCompare(b.due_date || b.date));
  }, [monthTransactions]);

  // Category breakdown for expenses
  const categoryExpensesData = useMemo(() => {
    const map = new Map<string, number>();

    // 1. Direct cash expenses
    for (const tx of monthTransactions) {
      if (tx.type === 'expense' && tx.status === 'completed' && tx.payment_method !== 'credit_card' && !tx.is_invoice_payment) {
        const catName = categories.find((c) => c.id === tx.category_id)?.name || 'Outros';
        map.set(catName, (map.get(catName) || 0) + tx.amount_cents);
      }
    }

    // 2. Card installments belonging to this cycle
    for (const inst of installments) {
      if (inst.cycle_year_month === selectedYearMonth) {
        // Find purchase category if possible
        map.set('Cartão de Crédito', (map.get('Cartão de Crédito') || 0) + inst.amount_cents);
      }
    }

    return Array.from(map.entries())
      .map(([name, cents]) => ({
        name,
        value: fromCents(cents),
        formatted: formatCurrencyBRL(cents),
      }))
      .filter((d) => d.value > 0);
  }, [monthTransactions, installments, categories, selectedYearMonth]);

  // Income vs Expense Comparison data
  const comparisonData = useMemo(() => {
    return [
      {
        name: 'Mês Atual',
        Receitas: fromCents(metrics.receivedIncomeCents),
        Despesas: fromCents(metrics.paidExpenseCents + metrics.creditCardConsumptionCents),
      },
    ];
  }, [metrics]);

  // Monthly Spending Comparison (This Month vs Previous Month)
  const spendingTrendData = useMemo(() => {
    return [
      {
        periodo: 'Mês Anterior',
        gastos: fromCents(metrics.previousMonthExpenseCents),
      },
      {
        periodo: 'Mês Atual',
        gastos: fromCents(metrics.paidExpenseCents + metrics.creditCardConsumptionCents),
      },
    ];
  }, [metrics]);

  const hasAnyActivity =
    monthTransactions.length > 0 ||
    installments.some((i) => i.cycle_year_month === selectedYearMonth) ||
    metrics.currentBalanceCents > 0;

  return (
    <div className="dashboard-content">
      {/* Critical Overdue Alert Banner if any overdue bills exist */}
      {metrics.overdueExpenseCents > 0 && (
        <div className="alert-banner danger">
          <AlertTriangle size={20} />
          <div style={{ flex: 1 }}>
            <strong>Atenção:</strong> Você possui{' '}
            <strong>{formatCurrencyBRL(metrics.overdueExpenseCents)}</strong> em contas vencidas que
            ainda não foram marcadas como pagas.
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="btn btn-sm btn-secondary"
            style={{ color: 'var(--color-expense)', borderColor: 'var(--color-expense)' }}
          >
            Ver Contas
          </button>
        </div>
      )}

      {/* Main Financial Metrics Cards */}
      <div className="metrics-grid metrics-grid-4" style={{ marginBottom: '1.5rem' }}>
        {/* Card 1: Saldo Atual */}
        <div className="metric-card primary">
          <div className="metric-header">
            <span className="metric-title">Saldo Atual</span>
            <div className="metric-icon-wrap" style={{ backgroundColor: 'var(--color-income-bg)', color: 'var(--color-income)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className="metric-value">
            {formatCurrencyBRL(metrics.currentBalanceCents)}
          </div>
          <div className="metric-footer">
            Disponível em caixa e contas bancárias
          </div>
        </div>

        {/* Card 2: Saldo Previsto */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Saldo Previsto (Fim do Mês)</span>
            <div className="metric-icon-wrap" style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div
            className={`metric-value ${
              metrics.projectedBalanceCents < 0 ? 'expense' : ''
            }`}
          >
            {formatCurrencyBRL(metrics.projectedBalanceCents)}
          </div>
          <div className="metric-footer">
            Considera receitas e obrigações pendentes
          </div>
        </div>

        {/* Card 3: Receitas Recebidas */}
        <div className="metric-card success">
          <div className="metric-header">
            <span className="metric-title">Receitas Recebidas</span>
            <div className="metric-icon-wrap" style={{ backgroundColor: 'var(--color-income-bg)', color: 'var(--color-income)' }}>
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="metric-value income">
            {formatCurrencyBRL(metrics.receivedIncomeCents)}
          </div>
          <div className="metric-footer">
            Entradas efetivas no mês
          </div>
        </div>

        {/* Card 4: Despesas Pagas */}
        <div className="metric-card danger">
          <div className="metric-header">
            <span className="metric-title">Despesas Pagas</span>
            <div className="metric-icon-wrap" style={{ backgroundColor: 'var(--color-expense-bg)', color: 'var(--color-expense)' }}>
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="metric-value expense">
            {formatCurrencyBRL(metrics.paidExpenseCents)}
          </div>
          <div className="metric-footer">
            Liquidadas em dinheiro / conta
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row: Contas Pendentes & Consumo de Cartão */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="metric-icon-wrap" style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="metric-title">Contas Pendentes</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-warning)' }}>
              {formatCurrencyBRL(metrics.pendingExpenseCents)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="metric-icon-wrap" style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
            <CreditCard size={20} />
          </div>
          <div>
            <div className="metric-title">Gastos no Cartão (Parcelas do Mês)</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrencyBRL(metrics.creditCardConsumptionCents)}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="metric-icon-wrap" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="metric-title">Faturas Pagas no Mês</div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrencyBRL(metrics.invoicePaymentsCents)}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts Bar */}
      <div className="quick-actions-bar" style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Ações Rápidas:
        </span>
        <button onClick={onOpenNewTx} className="btn btn-secondary btn-sm">
          <PlusCircle size={15} style={{ color: 'var(--brand-primary)' }} />
          <span>Cadastrar Receita ou Despesa</span>
        </button>
        <button onClick={() => onNavigateTab('cards')} className="btn btn-secondary btn-sm">
          <CreditCard size={15} style={{ color: 'var(--color-info)' }} />
          <span>Lançar Compra no Cartão</span>
        </button>
        <button onClick={() => onNavigateTab('recurring')} className="btn btn-secondary btn-sm">
          <Calendar size={15} style={{ color: 'var(--color-warning)' }} />
          <span>Conferir Recorrências do Mês</span>
        </button>
      </div>

      {/* Main Charts & Breakdown Section */}
      {hasAnyActivity ? (
        <div className="dashboard-sections-grid">
          {/* Left Column: Visual Charts */}
          <div>
            <div className="charts-row charts-row-2">
              {/* Chart 1: Despesas por Categoria */}
              <div className="card chart-card">
                <div className="card-header">
                  <h3 className="card-title">Despesas por Categoria</h3>
                  <span className="card-subtitle">Competência do mês</span>
                </div>
                <div className="chart-wrapper">
                  {categoryExpensesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryExpensesData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {categoryExpensesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) =>
                            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
                          }
                          contentStyle={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                      <p className="empty-desc">Nenhuma despesa registrada para este mês.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 2: Comparativo Receitas x Despesas */}
              <div className="card chart-card">
                <div className="card-header">
                  <h3 className="card-title">Receitas vs. Despesas</h3>
                  <span className="card-subtitle">Total consolidado</span>
                </div>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip
                        formatter={(value: any) =>
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
                        }
                        contentStyle={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Chart 3: Comparativo de Gastos com o Mês Anterior */}
            <div className="card" style={{ height: 260, marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h3 className="card-title">Comparativo com Mês Anterior</h3>
                <span className="card-subtitle">Evolução dos gastos de consumo</span>
              </div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="periodo" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      formatter={(value: any) =>
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
                      }
                      contentStyle={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="gastos" name="Total de Gastos (R$)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Próximas Contas & Resumo de Orçamento */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Próximas Contas a Vencer */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <Clock size={16} style={{ color: 'var(--color-warning)' }} />
                  <span>Obrigações a Vencer</span>
                </h3>
                <button onClick={() => onNavigateTab('transactions')} className="btn btn-sm btn-outline">
                  Ver Todas
                </button>
              </div>

              {upcomingBills.length > 0 ? (
                <div className="obligations-list">
                  {upcomingBills.slice(0, 5).map((bill) => (
                    <div key={bill.id} className="obligation-item">
                      <div className="obligation-left">
                        <div
                          className="obligation-icon"
                          style={{
                            backgroundColor:
                              bill.derivedStatus === 'overdue'
                                ? 'var(--color-expense-bg)'
                                : 'var(--color-warning-bg)',
                            color:
                              bill.derivedStatus === 'overdue'
                                ? 'var(--color-expense)'
                                : 'var(--color-warning)',
                          }}
                        >
                          <FileText size={16} />
                        </div>
                        <div className="obligation-info">
                          <span className="obligation-title">{bill.description}</span>
                          <span className="obligation-date">
                            Vence em: {formatDateBRL(bill.due_date || bill.date)}
                          </span>
                        </div>
                      </div>
                      <div className="obligation-amount">
                        <div className="obligation-val">{formatCurrencyBRL(bill.amount_cents)}</div>
                        <span
                          className={`badge ${
                            bill.derivedStatus === 'overdue' ? 'badge-overdue' : 'badge-pending'
                          }`}
                        >
                          {bill.derivedStatus === 'overdue' ? 'Vencida' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Nenhuma conta pendente para este mês. Tudo em dia!
                </div>
              )}
            </div>

            {/* Próximas Faturas de Cartão */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <CreditCard size={16} style={{ color: 'var(--color-info)' }} />
                  <span>Faturas de Cartão</span>
                </h3>
                <button onClick={() => onNavigateTab('cards')} className="btn btn-sm btn-outline">
                  Gerenciar
                </button>
              </div>

              {invoices.filter((i) => i.year_month === selectedYearMonth).length > 0 ? (
                <div>
                  {invoices
                    .filter((i) => i.year_month === selectedYearMonth)
                    .map((inv) => {
                      const card = creditCards.find((c) => c.id === inv.card_id);
                      const pending = Math.max(0, inv.total_amount_cents - inv.paid_amount_cents);
                      return (
                        <div key={inv.id} className="obligation-item">
                          <div className="obligation-left">
                            <div className="obligation-icon" style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                              <CreditCard size={16} />
                            </div>
                            <div className="obligation-info">
                              <span className="obligation-title">{card?.name || 'Cartão'}</span>
                              <span className="obligation-date">Vencimento: {formatDateBRL(inv.due_date)}</span>
                            </div>
                          </div>
                          <div className="obligation-amount">
                            <div className="obligation-val">{formatCurrencyBRL(inv.total_amount_cents)}</div>
                            <span className={`badge ${inv.status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                              {inv.status === 'paid' ? 'Paga' : `Restam ${formatCurrencyBRL(pending)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  Nenhuma fatura de cartão fechada para este mês.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State when month has zero movements */
        <div className="card empty-state">
          <div className="empty-icon">
            <Calendar size={28} />
          </div>
          <h3 className="empty-title">Nenhuma movimentação em {selectedYearMonth}</h3>
          <p className="empty-desc">
            Este mês ainda não possui receitas, despesas ou faturas registradas.
            Você pode navegar entre os meses anteriores ou começar registrando seu primeiro lançamento.
          </p>
          <button onClick={onOpenNewTx} className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Cadastrar Primeiro Lançamento</span>
          </button>
        </div>
      )}
    </div>
  );
};

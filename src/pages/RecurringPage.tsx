import React, { useState, useMemo } from 'react';
import {
  Repeat,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Edit3,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RecurringRule, RecurrenceFrequency, TransactionType } from '../domain/types';
import { formatCurrencyBRL, formatDateBRL, fromCents, toCents, getTodayDateStr } from '../domain/finance';

export const RecurringPage: React.FC = () => {
  const {
    recurringRules,
    recurringOccurrences,
    categories,
    selectedYearMonth,
    addRecurringRule,
    confirmRecurringOccurrence,
    dismissRecurringOccurrence,
  } = useApp();

  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [adjustingRuleId, setAdjustingRuleId] = useState<string | null>(null);
  const [adjustedAmountStr, setAdjustedAmountStr] = useState('');

  // Form State for new recurring rule
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('5');
  const [startDate, setStartDate] = useState(getTodayDateStr());
  const [errorMsg, setErrorMsg] = useState('');

  // Generate planned occurrences for the selected month
  const monthOccurrences = useMemo(() => {
    return recurringRules.map((rule) => {
      const existing = recurringOccurrences.find(
        (occ) => occ.rule_id === rule.id && occ.year_month === selectedYearMonth
      );
      const isConfirmed = existing?.status === 'confirmed';
      const isDismissed = existing?.status === 'dismissed';

      return {
        rule,
        status: isConfirmed ? 'confirmed' : isDismissed ? 'dismissed' : 'pending_confirmation',
        expectedDate: `${selectedYearMonth}-${String(Math.min(rule.day_of_month, 28)).padStart(2, '0')}`,
        amountCents: existing ? existing.amount_cents : rule.amount_cents,
      };
    });
  }, [recurringRules, recurringOccurrences, selectedYearMonth]);

  const pendingOccurrences = monthOccurrences.filter((o) => o.status === 'pending_confirmation');

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Informe um valor válido.');
      return;
    }

    if (!desc.trim()) {
      setErrorMsg('Informe uma descrição.');
      return;
    }

    const catId = categoryId || categories.find((c) => c.type === type)?.id || 'cat_1';

    await addRecurringRule({
      description: desc.trim(),
      amount_cents: toCents(amt),
      type: type as any,
      category_id: catId,
      frequency,
      day_of_month: parseInt(dayOfMonth, 10),
      start_date: startDate,
      is_active: true,
    });

    setIsNewRuleModalOpen(false);
    setDesc('');
    setAmountStr('');
  };

  const handleConfirmSingle = async (ruleId: string, customCents?: number) => {
    await confirmRecurringOccurrence(ruleId, selectedYearMonth, customCents);
    setAdjustingRuleId(null);
  };

  const handleConfirmAll = async () => {
    for (const item of pendingOccurrences) {
      await confirmRecurringOccurrence(item.rule.id, selectedYearMonth, item.amountCents);
    }
  };

  const handleDismissSingle = async (ruleId: string) => {
    await dismissRecurringOccurrence(ruleId, selectedYearMonth);
  };

  return (
    <div className="recurring-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Lançamentos Recorrentes ({selectedYearMonth})
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Confirmação consciente obrigatória antes de gerar movimentações definitivas
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {pendingOccurrences.length > 0 && (
            <button onClick={handleConfirmAll} className="btn btn-primary">
              <CheckCircle2 size={16} />
              <span>Confirmar Todas do Mês ({pendingOccurrences.length})</span>
            </button>
          )}
          <button onClick={() => setIsNewRuleModalOpen(true)} className="btn btn-secondary">
            <PlusCircle size={16} />
            <span>Nova Recorrência</span>
          </button>
        </div>
      </div>

      {/* Rules & Confirmation Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Repeat size={18} style={{ color: 'var(--brand-primary)' }} />
            <span>Ocorrências Previstas para {selectedYearMonth}</span>
          </h3>
          <span className="card-subtitle">
            Regra Financeira: Ocorrências só geram transações reais no extrato após sua confirmação
          </span>
        </div>

        {monthOccurrences.length > 0 ? (
          <table className="tx-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Previsão</th>
                <th>Valor Previsto</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {monthOccurrences.map(({ rule, status, expectedDate, amountCents }) => {
                const category = categories.find((c) => c.id === rule.category_id);
                const isExpense = rule.type === 'expense';
                const isAdjusting = adjustingRuleId === rule.id;

                return (
                  <tr key={rule.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{rule.description}</div>
                      <div className="tx-meta-sub">{category?.name} • Todo dia {rule.day_of_month}</div>
                    </td>

                    <td>
                      <span className={`badge ${isExpense ? 'badge-expense' : 'badge-income'}`}>
                        {isExpense ? 'Despesa' : 'Receita'}
                      </span>
                    </td>

                    <td>{formatDateBRL(expectedDate)}</td>

                    <td>
                      {isAdjusting ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            style={{ width: 110, padding: '0.35rem 0.5rem' }}
                            value={adjustedAmountStr}
                            onChange={(e) => setAdjustedAmountStr(e.target.value)}
                          />
                          <button
                            onClick={() => {
                              const val = parseFloat(adjustedAmountStr.replace(',', '.'));
                              if (!isNaN(val) && val > 0) {
                                handleConfirmSingle(rule.id, toCents(val));
                              }
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 700 }}>
                          {formatCurrencyBRL(amountCents)}
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          status === 'confirmed'
                            ? 'badge-paid'
                            : status === 'dismissed'
                            ? 'badge-pending'
                            : 'badge-overdue'
                        }`}
                      >
                        {status === 'confirmed'
                          ? 'Confirmada no Extrato'
                          : status === 'dismissed'
                          ? 'Ignorada Neste Mês'
                          : 'Aguardando Confirmação'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {status === 'pending_confirmation' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleConfirmSingle(rule.id, amountCents)}
                            className="btn btn-primary btn-sm"
                            title="Confirmar lançamento no extrato"
                          >
                            <CheckCircle2 size={14} />
                            <span>Confirmar</span>
                          </button>

                          <button
                            onClick={() => {
                              setAdjustingRuleId(rule.id);
                              setAdjustedAmountStr(String(fromCents(amountCents)));
                            }}
                            className="btn btn-secondary btn-sm"
                            title="Ajustar valor antes de lançar"
                          >
                            <Edit3 size={14} />
                            <span>Ajustar</span>
                          </button>

                          <button
                            onClick={() => handleDismissSingle(rule.id)}
                            className="btn btn-outline btn-sm"
                            title="Ignorar neste mês"
                          >
                            <XCircle size={14} />
                            <span>Ignorar</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {status === 'confirmed' ? 'Lançamento gerado' : 'Ignorado'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p className="empty-title">Nenhuma regra de recorrência cadastrada</p>
            <p className="empty-desc">
              Cadastre despesas fixas (como aluguel, luz e assinaturas) ou receitas previsíveis (salário, freelance)
              para acompanhar e confirmar a cada virada de mês sem gerar duplicatas.
            </p>
            <button onClick={() => setIsNewRuleModalOpen(true)} className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Cadastrar Nova Recorrência</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal: Nova Regra Recorrente */}
      {isNewRuleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewRuleModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Cadastrar Lançamento Recorrente</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewRuleModalOpen(false)}
                aria-label="Fechar"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body">
                {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className="btn"
                    style={{
                      backgroundColor: type === 'expense' ? 'var(--color-expense-bg)' : 'var(--bg-surface-elevated)',
                      border: '1px solid',
                      borderColor: type === 'expense' ? 'var(--color-expense)' : 'var(--border-subtle)',
                      color: type === 'expense' ? 'var(--color-expense)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      fontSize: 'var(--text-xs)',
                      minWidth: 0,
                    }}
                  >
                    <ArrowDownLeft size={16} style={{ flexShrink: 0 }} />
                    <span>Despesa Fixa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className="btn"
                    style={{
                      backgroundColor: type === 'income' ? 'var(--color-income-bg)' : 'var(--bg-surface-elevated)',
                      border: '1px solid',
                      borderColor: type === 'income' ? 'var(--color-income)' : 'var(--border-subtle)',
                      color: type === 'income' ? 'var(--color-income)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      fontSize: 'var(--text-xs)',
                      minWidth: 0,
                    }}
                  >
                    <ArrowUpRight size={16} style={{ flexShrink: 0 }} />
                    <span>Receita Fixa</span>
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rec-desc">Descrição</label>
                  <input
                    id="rec-desc"
                    type="text"
                    className="form-input"
                    placeholder="Ex: Aluguel, Salário, Internet Fibra, Netflix"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="rec-val">Valor Padrão (R$)</label>
                    <input
                      id="rec-val"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      placeholder="1200,00"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="rec-cat">Categoria</label>
                    <select
                      id="rec-cat"
                      className="form-select"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      {categories.filter((c) => c.type === type).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="rec-day">Dia do Mês para Vencimento</label>
                    <input
                      id="rec-day"
                      type="number"
                      min="1"
                      max="31"
                      className="form-input"
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="rec-freq">Frequência</label>
                    <select
                      id="rec-freq"
                      className="form-select"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                    >
                      <option value="monthly">Mensal</option>
                      <option value="weekly">Semanal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewRuleModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

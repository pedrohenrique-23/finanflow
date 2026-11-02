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
  Pencil,
  Trash2,
  Settings,
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
    updateRecurringRule,
    deleteRecurringRule,
    confirmRecurringOccurrence,
    dismissRecurringOccurrence,
  } = useApp();

  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [adjustingRuleId, setAdjustingRuleId] = useState<string | null>(null);
  const [adjustedAmountStr, setAdjustedAmountStr] = useState('');

  // Edit and Delete Recurring Rule State
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<RecurringRule | null>(null);

  // Form State for edit recurring rule
  const [editRuleDesc, setEditRuleDesc] = useState('');
  const [editRuleType, setEditRuleType] = useState<'income' | 'expense'>('expense');
  const [editRuleAmountStr, setEditRuleAmountStr] = useState('');
  const [editRuleCategoryId, setEditRuleCategoryId] = useState('');
  const [editRuleFrequency, setEditRuleFrequency] = useState<RecurrenceFrequency>('monthly');
  const [editRuleDayOfMonth, setEditRuleDayOfMonth] = useState('5');
  const [editRuleIsActive, setEditRuleIsActive] = useState(true);
  const [editRuleErrorMsg, setEditRuleErrorMsg] = useState('');

  // Form State for new recurring rule
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
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

  const handleOpenEditRule = (rule: RecurringRule) => {
    setEditingRule(rule);
    setEditRuleDesc(rule.description);
    setEditRuleType(rule.type);
    setEditRuleAmountStr(String(fromCents(rule.amount_cents)));
    setEditRuleCategoryId(rule.category_id);
    setEditRuleFrequency(rule.frequency);
    setEditRuleDayOfMonth(String(rule.day_of_month));
    setEditRuleIsActive(rule.is_active);
    setEditRuleErrorMsg('');
  };

  const handleSaveEditRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setEditRuleErrorMsg('');

    const amt = parseFloat(editRuleAmountStr.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setEditRuleErrorMsg('Informe um valor válido maior que zero.');
      return;
    }

    if (!editRuleDesc.trim()) {
      setEditRuleErrorMsg('Informe uma descrição.');
      return;
    }

    const day = parseInt(editRuleDayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      setEditRuleErrorMsg('Dia de vencimento deve ser entre 1 e 31.');
      return;
    }

    const catId = editRuleCategoryId || categories.find((c) => c.type === editRuleType)?.id || 'cat_1';

    await updateRecurringRule({
      ...editingRule,
      description: editRuleDesc.trim(),
      amount_cents: toCents(amt),
      type: editRuleType,
      category_id: catId,
      frequency: editRuleFrequency,
      day_of_month: day,
      is_active: editRuleIsActive,
    });

    setEditingRule(null);
  };

  const handleOpenDeleteRule = (rule: RecurringRule) => {
    setDeletingRule(rule);
  };

  const handleConfirmDeleteRule = async () => {
    if (!deletingRule) return;
    await deleteRecurringRule(deletingRule.id);
    setDeletingRule(null);
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {status === 'pending_confirmation' ? (
                          <>
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
                          </>
                        ) : (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {status === 'confirmed' ? 'Confirmada' : 'Ignorada'}
                          </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.4rem', marginLeft: '0.2rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditRule(rule)}
                            className="btn-icon"
                            title="Editar regra de recorrência"
                            style={{
                              padding: '0.35rem',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--brand-primary)',
                              backgroundColor: 'var(--bg-surface-elevated)',
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteRule(rule)}
                            className="btn-icon"
                            title="Excluir regra de recorrência"
                            style={{
                              padding: '0.35rem',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--color-expense)',
                              backgroundColor: 'var(--bg-surface-elevated)',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
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

      {/* Configured Rules Section */}
      {recurringRules.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">
              <Settings size={18} style={{ color: 'var(--brand-primary)' }} />
              <span>Regras de Recorrência Configuradas ({recurringRules.length})</span>
            </h3>
            <span className="card-subtitle">
              Gerencie suas despesas fixas e receitas automáticas. Edite valores base, dia de vencimento ou exclua regras.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', padding: '1rem' }}>
            {recurringRules.map((rule) => {
              const category = categories.find((c) => c.id === rule.category_id);
              const isExpense = rule.type === 'expense';
              return (
                <div
                  key={rule.id}
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span className={`badge ${isExpense ? 'badge-expense' : 'badge-income'}`}>
                        {isExpense ? 'Despesa Fixa' : 'Receita Recorrente'}
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: rule.is_active ? 'var(--color-income-bg)' : 'var(--bg-surface)',
                          color: rule.is_active ? 'var(--color-income)' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {rule.is_active ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                      {rule.description}
                    </div>

                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {category?.name || 'Geral'} • Todo dia {rule.day_of_month} • {rule.frequency === 'monthly' ? 'Mensal' : rule.frequency === 'weekly' ? 'Semanal' : 'Anual'}
                    </div>

                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, marginTop: '0.5rem', color: isExpense ? 'var(--color-expense)' : 'var(--color-income)' }}>
                      {formatCurrencyBRL(rule.amount_cents)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditRule(rule)}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Pencil size={14} />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteRule(rule)}
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--color-expense)', borderColor: 'var(--color-expense)', padding: '0.35rem 0.6rem' }}
                      title="Excluir regra"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    <span>Receita Recorrente</span>
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

      {/* Modal: Editar Regra Recorrente */}
      {editingRule && (
        <div className="modal-overlay" onClick={() => setEditingRule(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Editar Regra de Recorrência</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setEditingRule(null)}
                aria-label="Fechar"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEditRule} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body">
                {editRuleErrorMsg && <div className="alert-banner danger">{editRuleErrorMsg}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setEditRuleType('expense')}
                    className="btn"
                    style={{
                      backgroundColor: editRuleType === 'expense' ? 'var(--color-expense-bg)' : 'var(--bg-surface-elevated)',
                      border: '1px solid',
                      borderColor: editRuleType === 'expense' ? 'var(--color-expense)' : 'var(--border-subtle)',
                      color: editRuleType === 'expense' ? 'var(--color-expense)' : 'var(--text-secondary)',
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
                    onClick={() => setEditRuleType('income')}
                    className="btn"
                    style={{
                      backgroundColor: editRuleType === 'income' ? 'var(--color-income-bg)' : 'var(--bg-surface-elevated)',
                      border: '1px solid',
                      borderColor: editRuleType === 'income' ? 'var(--color-income)' : 'var(--border-subtle)',
                      color: editRuleType === 'income' ? 'var(--color-income)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      padding: '0.6rem 0.4rem',
                      fontSize: 'var(--text-xs)',
                      minWidth: 0,
                    }}
                  >
                    <ArrowUpRight size={16} style={{ flexShrink: 0 }} />
                    <span>Receita Recorrente</span>
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-rec-desc">Descrição</label>
                  <input
                    id="edit-rec-desc"
                    type="text"
                    className="form-input"
                    value={editRuleDesc}
                    onChange={(e) => setEditRuleDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-rec-val">Valor Padrão (R$)</label>
                    <input
                      id="edit-rec-val"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={editRuleAmountStr}
                      onChange={(e) => setEditRuleAmountStr(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-rec-cat">Categoria</label>
                    <select
                      id="edit-rec-cat"
                      className="form-select"
                      value={editRuleCategoryId}
                      onChange={(e) => setEditRuleCategoryId(e.target.value)}
                    >
                      {categories.filter((c) => c.type === editRuleType).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-rec-day">Dia do Mês para Vencimento</label>
                    <input
                      id="edit-rec-day"
                      type="number"
                      min="1"
                      max="31"
                      className="form-input"
                      value={editRuleDayOfMonth}
                      onChange={(e) => setEditRuleDayOfMonth(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-rec-freq">Frequência</label>
                    <select
                      id="edit-rec-freq"
                      className="form-select"
                      value={editRuleFrequency}
                      onChange={(e) => setEditRuleFrequency(e.target.value as any)}
                    >
                      <option value="monthly">Mensal</option>
                      <option value="weekly">Semanal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={editRuleIsActive}
                      onChange={(e) => setEditRuleIsActive(e.target.checked)}
                      style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--brand-primary)' }}
                    />
                    <span>Regra de recorrência ativa (gera previsões mensalmente)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingRule(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão de Regra Recorrente */}
      {deletingRule && (
        <div className="modal-overlay" onClick={() => setDeletingRule(null)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-expense)' }}>
                <AlertTriangle size={20} />
                <h3 className="modal-title" style={{ color: 'var(--color-expense)' }}>Excluir Recorrência</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setDeletingRule(null)}
                aria-label="Fechar"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                Tem certeza que deseja excluir a regra de recorrência "{deletingRule.description}"?
              </p>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                <p>• Ocorrências futuras pendentes não serão mais geradas nos próximos meses.</p>
                <p style={{ marginTop: '0.25rem' }}>
                  • Lançamentos que você já <strong>confirmou no extrato</strong> em meses anteriores continuarão registrados e preservados no seu histórico financeiro.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDeletingRule(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--color-expense)', borderColor: 'var(--color-expense)' }}
                onClick={handleConfirmDeleteRule}
              >
                Sim, Excluir Recorrência
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

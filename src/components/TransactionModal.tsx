import React, { useState, useEffect } from 'react';
import { X, Check, ArrowDownLeft, ArrowUpRight, Calendar, Tag, CreditCard } from 'lucide-react';
import { Transaction, TransactionType, PaymentMethod } from '../domain/types';
import { toCents, fromCents, getTodayDateStr } from '../domain/finance';
import { useApp } from '../context/AppContext';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  transactionToEdit,
}) => {
  const { categories, creditCards, addTransaction, updateTransaction, selectedYearMonth } = useApp();

  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(`${selectedYearMonth}-01`);
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('account');
  const [status, setStatus] = useState<'completed' | 'pending'>('completed');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (transactionToEdit) {
      setType(transactionToEdit.type);
      setDescription(transactionToEdit.description);
      setAmountStr(String(fromCents(transactionToEdit.amount_cents)));
      setCategoryId(transactionToEdit.category_id || '');
      setDate(transactionToEdit.date);
      setDueDate(transactionToEdit.due_date || '');
      setPaymentMethod(transactionToEdit.payment_method);
      setStatus(transactionToEdit.status);
      setNotes(transactionToEdit.notes || '');
    } else {
      setType('expense');
      setDescription('');
      setAmountStr('');
      const today = getTodayDateStr();
      setDate(today.startsWith(selectedYearMonth) ? today : `${selectedYearMonth}-01`);
      setDueDate('');
      setPaymentMethod('account');
      setStatus('completed');
      setNotes('');
    }
    setErrorMsg('');
  }, [transactionToEdit, isOpen, selectedYearMonth]);

  // Filter categories matching current transaction type
  const availableCategories = categories.filter((c) => c.type === type && !c.is_archived);

  // Auto-select first matching category if current selection is invalid
  useEffect(() => {
    if (!categoryId || !availableCategories.some((c) => c.id === categoryId)) {
      if (availableCategories.length > 0) {
        setCategoryId(availableCategories[0].id);
      }
    }
  }, [type, availableCategories, categoryId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim()) {
      setErrorMsg('Informe uma descrição para o lançamento.');
      return;
    }

    const parsedAmount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Informe um valor financeiro válido maior que zero.');
      return;
    }

    const amountCents = toCents(parsedAmount);

    try {
      if (transactionToEdit) {
        await updateTransaction({
          ...transactionToEdit,
          description: description.trim(),
          amount_cents: amountCents,
          type,
          category_id: categoryId,
          date,
          due_date: dueDate || date,
          payment_method: paymentMethod,
          status,
          notes: notes.trim(),
        });
      } else {
        await addTransaction({
          description: description.trim(),
          amount_cents: amountCents,
          type,
          category_id: categoryId,
          date,
          due_date: dueDate || date,
          payment_method: paymentMethod,
          status,
          notes: notes.trim(),
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Erro ao salvar: ${msg}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {transactionToEdit ? 'Editar Movimentação' : 'Nova Movimentação'}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body">
            {/* Tipo Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setType('expense')}
              className="btn"
              style={{
                backgroundColor: type === 'expense' ? 'var(--color-expense-bg)' : 'var(--bg-surface-elevated)',
                borderColor: type === 'expense' ? 'var(--color-expense)' : 'var(--border-subtle)',
                borderWidth: '1px',
                borderStyle: 'solid',
                color: type === 'expense' ? 'var(--color-expense)' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
            >
              <ArrowDownLeft size={16} />
              <span>Despesa</span>
            </button>

            <button
              type="button"
              onClick={() => setType('income')}
              className="btn"
              style={{
                backgroundColor: type === 'income' ? 'var(--color-income-bg)' : 'var(--bg-surface-elevated)',
                borderColor: type === 'income' ? 'var(--color-income)' : 'var(--border-subtle)',
                borderWidth: '1px',
                borderStyle: 'solid',
                color: type === 'income' ? 'var(--color-income)' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
            >
              <ArrowUpRight size={16} />
              <span>Receita</span>
            </button>
          </div>

          {errorMsg && (
            <div className="alert-banner danger" style={{ padding: '0.65rem 1rem', marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="tx-desc">Descrição</label>
            <input
              id="tx-desc"
              type="text"
              className="form-input"
              placeholder="Ex: Supermercado, Salário, Internet"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="tx-val">Valor (R$)</label>
              <input
                id="tx-val"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tx-cat">Categoria</label>
              <select
                id="tx-cat"
                className="form-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="tx-date">Data da Movimentação</label>
              <input
                id="tx-date"
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tx-due">Data de Vencimento</label>
              <input
                id="tx-due"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="tx-method">Forma de Pagamento</label>
              <select
                id="tx-method"
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="account">Conta Corrente / PIX</option>
                <option value="cash">Dinheiro em Espécie</option>
                <option value="credit_card">Cartão de Crédito</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tx-status">Status</label>
              <select
                id="tx-status"
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'completed' | 'pending')}
              >
                <option value="completed">
                  {type === 'income' ? 'Recebido' : 'Pago'}
                </option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tx-notes">Observações (Opcional)</label>
            <input
              id="tx-notes"
              type="text"
              className="form-input"
              placeholder="Detalhes adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            <Check size={16} />
            <span>{transactionToEdit ? 'Salvar Alterações' : 'Confirmar Lançamento'}</span>
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

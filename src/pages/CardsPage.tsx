import React, { useState, useMemo } from 'react';
import {
  CreditCard as CreditCardIcon,
  PlusCircle,
  ShoppingBag,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Lock,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CreditCard, CreditCardPurchase, Installment, Invoice } from '../domain/types';
import {
  formatCurrencyBRL,
  formatDateBRL,
  fromCents,
  toCents,
  calculateCardLimits,
  getTodayDateStr,
} from '../domain/finance';

interface CardsPageProps {
  onNavigateTab: (tab: string) => void;
}

export const CardsPage: React.FC<CardsPageProps> = ({ onNavigateTab }) => {
  const {
    creditCards,
    purchases,
    installments,
    invoices,
    categories,
    selectedYearMonth,
    addCard,
    updateCard,
    addPurchase,
    updatePurchase,
    deletePurchase,
    payInvoice,
  } = useApp();

  // Modals state
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CreditCardPurchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<CreditCardPurchase | null>(null);

  // Edit Card State
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardIssuer, setEditCardIssuer] = useState('');
  const [editCardLimitStr, setEditCardLimitStr] = useState('');
  const [editClosingDay, setEditClosingDay] = useState('20');
  const [editDueDay, setEditDueDay] = useState('28');
  const [editCardColor, setEditCardColor] = useState('#6366f1');

  // Edit Purchase State
  const [editDesc, setEditDesc] = useState('');
  const [editAmountStr, setEditAmountStr] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editInstallmentsCount, setEditInstallmentsCount] = useState(1);
  const [editNotes, setEditNotes] = useState('');

  // New Card Form State
  const [cardName, setCardName] = useState('');
  const [cardIssuer, setCardIssuer] = useState('');
  const [cardLimitStr, setCardLimitStr] = useState('');
  const [closingDay, setClosingDay] = useState('20');
  const [dueDay, setDueDay] = useState('28');
  const [cardColor, setCardColor] = useState('#6366f1');

  // New Purchase Form State
  const [selectedCardId, setSelectedCardId] = useState(creditCards[0]?.id || '');
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseAmountStr, setPurchaseAmountStr] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayDateStr());
  const [purchaseCategoryId, setPurchaseCategoryId] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Payment Form State
  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateStr());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected card for viewing details
  const [activeCardId, setActiveCardId] = useState<string>(creditCards[0]?.id || '');

  // Keep active card valid if list changes
  React.useEffect(() => {
    if (!activeCardId && creditCards.length > 0) {
      setActiveCardId(creditCards[0].id);
    }
  }, [creditCards, activeCardId]);

  const activeCard = creditCards.find((c) => c.id === activeCardId) || creditCards[0];

  // Active card limits
  const activeCardLimits = useMemo(() => {
    if (!activeCard) return { committedLimitCents: 0, availableLimitCents: 0, isExceeded: false };
    const cardInstallments = installments.filter((i) => i.card_id === activeCard.id);
    return calculateCardLimits(activeCard.limit_cents, cardInstallments);
  }, [activeCard, installments]);

  // Invoices for the active card in the current month
  const activeCardInvoice = useMemo(() => {
    if (!activeCard) return null;
    return invoices.find((inv) => inv.card_id === activeCard.id && inv.year_month === selectedYearMonth);
  }, [activeCard, invoices, selectedYearMonth]);

  // Installments in active card's invoice for this month
  const currentInvoiceInstallments = useMemo(() => {
    if (!activeCard) return [];
    return installments.filter(
      (inst) => inst.card_id === activeCard.id && inst.cycle_year_month === selectedYearMonth
    );
  }, [activeCard, installments, selectedYearMonth]);

  // Handle New Card Submit
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const limitVal = parseFloat(cardLimitStr.replace(',', '.'));
    if (isNaN(limitVal) || limitVal <= 0) {
      setErrorMsg('Informe um limite total válido.');
      return;
    }

    await addCard({
      name: cardName.trim(),
      issuer: cardIssuer.trim() || undefined,
      limit_cents: toCents(limitVal),
      closing_day: parseInt(closingDay, 10),
      due_day: parseInt(dueDay, 10),
      color: cardColor,
      is_archived: false,
    });

    setIsNewCardModalOpen(false);
    setCardName('');
    setCardIssuer('');
    setCardLimitStr('');
  };

  // Open Edit Card Modal
  const handleOpenEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setEditCardName(card.name);
    setEditCardIssuer(card.issuer || '');
    setEditCardLimitStr(String(fromCents(card.limit_cents)));
    setEditClosingDay(String(card.closing_day));
    setEditDueDay(String(card.due_day));
    setEditCardColor(card.color || '#6366f1');
    setErrorMsg('');
  };

  // Handle Save Edit Card Submit
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) return;
    setErrorMsg('');

    const limitVal = parseFloat(editCardLimitStr.replace(',', '.'));
    if (isNaN(limitVal) || limitVal <= 0) {
      setErrorMsg('Informe um limite válido maior que zero.');
      return;
    }

    if (!editCardName.trim()) {
      setErrorMsg('Informe o nome do cartão.');
      return;
    }

    const cDay = parseInt(editClosingDay, 10);
    const dDay = parseInt(editDueDay, 10);
    if (isNaN(cDay) || cDay < 1 || cDay > 31 || isNaN(dDay) || dDay < 1 || dDay > 31) {
      setErrorMsg('Dias de fechamento e vencimento devem ser entre 1 e 31.');
      return;
    }

    await updateCard({
      ...editingCard,
      name: editCardName.trim(),
      issuer: editCardIssuer.trim() || undefined,
      limit_cents: toCents(limitVal),
      closing_day: cDay,
      due_day: dDay,
      color: editCardColor,
    });

    setEditingCard(null);
  };

  // Handle New Purchase Submit
  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(purchaseAmountStr.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Informe um valor de compra válido.');
      return;
    }

    if (!purchaseDesc.trim()) {
      setErrorMsg('Informe a descrição da compra.');
      return;
    }

    const catId = purchaseCategoryId || categories.find((c) => c.type === 'expense')?.id || 'cat_exp_1';

    await addPurchase({
      cardId: selectedCardId || activeCard?.id || creditCards[0].id,
      description: purchaseDesc.trim(),
      totalAmountCents: toCents(amt),
      purchaseDate,
      categoryId: catId,
      installmentsCount: Number(installmentsCount),
      notes: purchaseNotes.trim(),
    });

    setIsNewPurchaseModalOpen(false);
    setPurchaseDesc('');
    setPurchaseAmountStr('');
    setInstallmentsCount(1);
    setPurchaseNotes('');
  };

  // Open invoice payment modal
  const handleOpenPayment = (inv: Invoice) => {
    setPaymentInvoice(inv);
    const pendingCents = Math.max(0, inv.total_amount_cents - inv.paid_amount_cents);
    setPaymentAmountStr(String(fromCents(pendingCents)));
    setPaymentDate(getTodayDateStr());
    setPaymentNotes('');
    setErrorMsg('');
  };

  // Confirm payment of invoice
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    const amt = parseFloat(paymentAmountStr.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Informe um valor de pagamento válido.');
      return;
    }

    const paymentCents = toCents(amt);
    const pendingCents = Math.max(0, paymentInvoice.total_amount_cents - paymentInvoice.paid_amount_cents);

    if (paymentCents > pendingCents) {
      setErrorMsg(`O valor de pagamento não pode ser maior que o saldo pendente (${formatCurrencyBRL(pendingCents)}).`);
      return;
    }

    await payInvoice(paymentInvoice, paymentCents, paymentDate, paymentNotes);
    setPaymentInvoice(null);
  };

  const handleOpenEditPurchase = (purchase: CreditCardPurchase) => {
    setEditingPurchase(purchase);
    setEditDesc(purchase.description);
    setEditAmountStr(String(fromCents(purchase.total_amount_cents)));
    setEditDate(purchase.purchase_date);
    setEditCategoryId(purchase.category_id);
    setEditInstallmentsCount(purchase.installments_count);
    setEditNotes(purchase.notes || '');
    setErrorMsg('');
  };

  const handleSaveEditPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    setErrorMsg('');

    const amt = parseFloat(editAmountStr.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Informe um valor de compra válido.');
      return;
    }

    if (!editDesc.trim()) {
      setErrorMsg('Informe a descrição da compra.');
      return;
    }

    await updatePurchase({
      purchaseId: editingPurchase.id,
      cardId: editingPurchase.card_id,
      description: editDesc.trim(),
      totalAmountCents: toCents(amt),
      purchaseDate: editDate,
      categoryId: editCategoryId || editingPurchase.category_id,
      installmentsCount: Math.max(1, Number(editInstallmentsCount)),
      notes: editNotes.trim(),
    });

    setEditingPurchase(null);
  };

  const handleOpenDeletePurchase = (purchase: CreditCardPurchase) => {
    setDeletingPurchase(purchase);
    setErrorMsg('');
  };

  const handleConfirmDeletePurchase = async () => {
    if (!deletingPurchase) return;
    await deletePurchase(deletingPurchase.id);
    setDeletingPurchase(null);
  };

  return (
    <div className="cards-page">
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Gerenciamento de Cartões e Faturas
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Acompanhe limites, datas de fechamento e compras parceladas sem duplicar despesas
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setIsNewCardModalOpen(true)} className="btn btn-secondary">
            <PlusCircle size={16} />
            <span>Novo Cartão</span>
          </button>
          {creditCards.length > 0 && (
            <button onClick={() => { setSelectedCardId(activeCard?.id || creditCards[0].id); setIsNewPurchaseModalOpen(true); }} className="btn btn-primary">
              <ShoppingBag size={16} />
              <span>Lançar Compra</span>
            </button>
          )}
        </div>
      </div>

      {creditCards.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">
            <CreditCardIcon size={28} />
          </div>
          <h3 className="empty-title">Nenhum cartão cadastrado</h3>
          <p className="empty-desc">
            Cadastre seu primeiro cartão de crédito para gerenciar limites, faturas e parcelamentos
            com cálculo exato de centavos.
          </p>
          <button onClick={() => setIsNewCardModalOpen(true)} className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Cadastrar Meu Primeiro Cartão</span>
          </button>
        </div>
      ) : (
        <div>
          {/* Credit Cards Horizontal / Grid Selector */}
          <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            {creditCards.map((card) => {
              const isActive = card.id === activeCard?.id;
              const cardInsts = installments.filter((i) => i.card_id === card.id);
              const limits = calculateCardLimits(card.limit_cents, cardInsts);

              return (
                <div
                  key={card.id}
                  onClick={() => setActiveCardId(card.id)}
                  className="credit-card-mockup"
                  style={{
                    background: `linear-gradient(135deg, ${card.color} 0%, #0f172a 100%)`,
                    minWidth: 290,
                    cursor: 'pointer',
                    outline: isActive ? '3px solid var(--brand-primary)' : 'none',
                    outlineOffset: '2px',
                  }}
                >
                  <div className="card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className="card-chip" />
                      <span className="card-issuer">{card.issuer || 'FinanFlow Card'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditCard(card);
                      }}
                      className="btn-icon"
                      title="Editar Limite e Cartão"
                      aria-label="Editar Limite"
                      style={{
                        color: '#ffffff',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        borderRadius: 'var(--radius-full)',
                        padding: '0.35rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>

                  <div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{card.name}</div>
                    <div className="card-number-masked">•••• •••• •••• 8821</div>
                  </div>

                  <div className="card-bottom">
                    <div>
                      <div className="card-holder">Limite Disponível</div>
                      <div style={{ fontWeight: 800, fontSize: 'var(--text-base)' }}>
                        {formatCurrencyBRL(limits.availableLimitCents)}
                      </div>
                    </div>
                    <div className="card-dates">
                      <div>Fecha dia {card.closing_day}</div>
                      <div>Vence dia {card.due_day}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Card Limits & Summary Details */}
          {activeCard && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 className="card-title">
                    <CreditCardIcon size={18} style={{ color: activeCard.color }} />
                    <span>Detalhes do Cartão: {activeCard.name}</span>
                  </h3>
                  <span className="card-subtitle">
                    Fechamento todo dia {activeCard.closing_day} • Vencimento todo dia {activeCard.due_day}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditCard(activeCard)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Editar Limite do Cartão"
                >
                  <Pencil size={14} />
                  <span>Editar Limite / Cartão</span>
                </button>
              </div>

              {/* Limit Gauge & Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="card" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="metric-title">Limite Total</div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCard(activeCard)}
                      className="btn-icon"
                      title="Editar Limite Total"
                      style={{ padding: '0.2rem', color: 'var(--brand-primary)' }}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>
                    {formatCurrencyBRL(activeCard.limit_cents)}
                  </div>
                </div>

                <div className="card" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                  <div className="metric-title">Limite Comprometido</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-warning)' }}>
                    {formatCurrencyBRL(activeCardLimits.committedLimitCents)}
                  </div>
                </div>

                <div className="card" style={{ backgroundColor: 'var(--bg-surface-elevated)' }}>
                  <div className="metric-title">Limite Disponível</div>
                  <div
                    style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 800,
                      color: activeCardLimits.isExceeded ? 'var(--color-expense)' : 'var(--color-income)',
                    }}
                  >
                    {formatCurrencyBRL(activeCardLimits.availableLimitCents)}
                    {activeCardLimits.isExceeded && (
                      <span style={{ fontSize: 'var(--text-xs)', display: 'block', color: 'var(--color-expense)' }}>
                        Limite Excedido!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar of Limit Usage */}
              <div className="progress-container">
                <div className="progress-header">
                  <span>Utilização do Limite</span>
                  <span>
                    {Math.round(
                      (activeCardLimits.committedLimitCents / (activeCard.limit_cents || 1)) * 100
                    )}%
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${
                      activeCardLimits.isExceeded
                        ? 'danger'
                        : activeCardLimits.committedLimitCents / activeCard.limit_cents >= 0.8
                        ? 'warning'
                        : ''
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (activeCardLimits.committedLimitCents / (activeCard.limit_cents || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active Card Invoice for Current Month */}
          {activeCard && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    Fatura de {selectedYearMonth} ({activeCard.name})
                  </h3>
                  <span className="card-subtitle">
                    Vencimento: dia {activeCard.due_day} • Compras efetuadas após o dia {activeCard.closing_day} entrarão no ciclo seguinte
                  </span>
                </div>

                {activeCardInvoice && activeCardInvoice.status !== 'paid' && (
                  <button
                    onClick={() => handleOpenPayment(activeCardInvoice)}
                    className="btn btn-primary btn-sm"
                  >
                    <DollarSign size={15} />
                    <span>Pagar Fatura</span>
                  </button>
                )}
              </div>

              {activeCardInvoice ? (
                <div>
                  {/* Invoice Summary Header */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '1rem',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div>
                      <div className="metric-title">Total da Fatura</div>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>
                        {formatCurrencyBRL(activeCardInvoice.total_amount_cents)}
                      </div>
                    </div>
                    <div>
                      <div className="metric-title">Total Pago</div>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-income)' }}>
                        {formatCurrencyBRL(activeCardInvoice.paid_amount_cents)}
                      </div>
                    </div>
                    <div>
                      <div className="metric-title">Saldo Pendente</div>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-warning)' }}>
                        {formatCurrencyBRL(
                          Math.max(0, activeCardInvoice.total_amount_cents - activeCardInvoice.paid_amount_cents)
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="metric-title">Status da Fatura</div>
                      <span
                        className={`badge ${
                          activeCardInvoice.status === 'paid'
                            ? 'badge-paid'
                            : activeCardInvoice.status === 'partially_paid'
                            ? 'badge-pending'
                            : 'badge-overdue'
                        }`}
                        style={{ marginTop: '0.25rem' }}
                      >
                        {activeCardInvoice.status === 'paid'
                          ? 'Quitada'
                          : activeCardInvoice.status === 'partially_paid'
                          ? 'Parcialmente Paga'
                          : 'Aberta / Pendente'}
                      </span>
                    </div>
                  </div>

                  {/* Installments in this invoice */}
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Compras e Parcelas Incluídas Nesta Fatura:
                  </h4>
                  <table className="tx-table">
                    <thead>
                      <tr>
                        <th>Compra / Descrição</th>
                        <th>Categoria</th>
                        <th>Parcela</th>
                        <th>Vencimento</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Valor da Parcela</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInvoiceInstallments.map((inst) => {
                        const purchase = purchases.find((p) => p.id === inst.purchase_id);
                        const category = categories.find((c) => c.id === purchase?.category_id);
                        return (
                          <tr key={inst.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {purchase?.description || 'Compra no cartão'}
                              </div>
                              {purchase && (
                                <div className="tx-meta-sub">
                                  Feita em {formatDateBRL(purchase.purchase_date)} • Total {formatCurrencyBRL(purchase.total_amount_cents)}
                                </div>
                              )}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'var(--bg-surface-elevated)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 500,
                                }}
                              >
                                {category?.name || 'Geral'}
                              </span>
                            </td>
                            <td>
                              <strong>
                                Parcela {inst.installment_number} de {inst.total_installments}
                              </strong>
                            </td>
                            <td>{formatDateBRL(inst.due_date)}</td>
                            <td>
                              <span className={`badge ${inst.is_liquidated ? 'badge-paid' : 'badge-pending'}`}>
                                {inst.is_liquidated ? 'Liquidada' : 'Aberta'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatCurrencyBRL(inst.amount_cents)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {purchase ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPurchase(purchase)}
                                    className="btn-icon"
                                    title="Editar compra completa (valor, parcelas, descrição)"
                                    style={{
                                      padding: '0.4rem',
                                      borderRadius: 'var(--radius-sm)',
                                      color: 'var(--brand-primary)',
                                      backgroundColor: 'var(--bg-surface-elevated)',
                                    }}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeletePurchase(purchase)}
                                    className="btn-icon"
                                    title="Excluir compra e remover todas as suas parcelas"
                                    style={{
                                      padding: '0.4rem',
                                      borderRadius: 'var(--radius-sm)',
                                      color: 'var(--color-expense)',
                                      backgroundColor: 'var(--bg-surface-elevated)',
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum gasto ou parcela de cartão lançada para esta fatura no mês {selectedYearMonth}.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo Cartão */}
      {isNewCardModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewCardModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Cadastrar Novo Cartão</h3>
            </div>
            <form onSubmit={handleCreateCard} className="modal-body">
              {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="card-n">Nome do Cartão</label>
                <input
                  id="card-n"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Nubank Roxinho, Itaú Black"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="card-iss">Emissor (Opcional)</label>
                  <input
                    id="card-iss"
                    type="text"
                    className="form-input"
                    placeholder="Ex: Mastercard, Visa"
                    value={cardIssuer}
                    onChange={(e) => setCardIssuer(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="card-lim">Limite Total (R$)</label>
                  <input
                    id="card-lim"
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="3000,00"
                    value={cardLimitStr}
                    onChange={(e) => setCardLimitStr(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="card-close">Dia de Fechamento</label>
                  <input
                    id="card-close"
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    required
                  />
                  <span className="form-hint">Compras a partir deste dia vão para o mês seguinte</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="card-due">Dia de Vencimento</label>
                  <input
                    id="card-due"
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cor do Cartão</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCardColor(color)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: cardColor === color ? '3px solid #ffffff' : 'none',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewCardModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Cartão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lançar Compra no Cartão */}
      {isNewPurchaseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewPurchaseModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nova Compra no Cartão</h3>
            </div>
            <form onSubmit={handleCreatePurchase} className="modal-body">
              {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="pur-card">Cartão</label>
                <select
                  id="pur-card"
                  className="form-select"
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                >
                  {creditCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Limite disponível: {formatCurrencyBRL(calculateCardLimits(c.limit_cents, installments.filter(i => i.card_id === c.id)).availableLimitCents)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pur-desc">Descrição da Compra</label>
                <input
                  id="pur-desc"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Smart TV, Jantar, Passagem aérea"
                  value={purchaseDesc}
                  onChange={(e) => setPurchaseDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pur-amt">Valor Total da Compra (R$)</label>
                  <input
                    id="pur-amt"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="600,00"
                    value={purchaseAmountStr}
                    onChange={(e) => setPurchaseAmountStr(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pur-inst">Número de Parcelas</label>
                  <select
                    id="pur-inst"
                    className="form-select"
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                  >
                    <option value={1}>1x à vista (no cartão)</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((num) => (
                      <option key={num} value={num}>
                        {num}x parcelado
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="pur-date">Data da Compra</label>
                  <input
                    id="pur-date"
                    type="date"
                    className="form-input"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pur-cat">Categoria</label>
                  <select
                    id="pur-cat"
                    className="form-select"
                    value={purchaseCategoryId}
                    onChange={(e) => setPurchaseCategoryId(e.target.value)}
                  >
                    {categories.filter((c) => c.type === 'expense').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {installmentsCount > 1 && purchaseAmountStr && (
                <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <strong>Distribuição exata de centavos:</strong> As parcelas serão geradas automaticamente
                  garantindo que a soma resulte exatamente no valor total, respeitando o dia de fechamento do cartão.
                </div>
              )}

              <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsNewPurchaseModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirmar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pagamento de Fatura */}
      {paymentInvoice && (
        <div className="modal-overlay" onClick={() => setPaymentInvoice(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Pagar Fatura de Cartão</h3>
            </div>
            <form onSubmit={handleConfirmPayment} className="modal-body">
              {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
                <div>Total da Fatura: <strong>{formatCurrencyBRL(paymentInvoice.total_amount_cents)}</strong></div>
                <div>Já Pago: <strong>{formatCurrencyBRL(paymentInvoice.paid_amount_cents)}</strong></div>
                <div style={{ color: 'var(--color-warning)', marginTop: '0.25rem' }}>
                  Saldo Pendente: <strong>{formatCurrencyBRL(Math.max(0, paymentInvoice.total_amount_cents - paymentInvoice.paid_amount_cents))}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-amt">Valor a Pagar (R$)</label>
                <input
                  id="pay-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input"
                  value={paymentAmountStr}
                  onChange={(e) => setPaymentAmountStr(e.target.value)}
                  required
                />
                <span className="form-hint">Permite pagamento parcial ou quitação integral</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-date">Data do Pagamento</label>
                <input
                  id="pay-date"
                  type="date"
                  className="form-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-notes">Observação (Opcional)</label>
                <input
                  id="pay-notes"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Débito automático, PIX, transferência"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', gap: '0.35rem' }}>
                <ShieldCheck size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Regra de Liquidação:</strong> O pagamento reduzirá seu saldo bancário e restaurará o
                  limite disponível do cartão, <em>sem duplicar</em> despesas de consumo.
                </span>
              </div>

              <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentInvoice(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Compra no Cartão */}
      {editingPurchase && (
        <div className="modal-overlay" onClick={() => setEditingPurchase(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Editar Compra no Cartão</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setEditingPurchase(null)}
                aria-label="Fechar"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEditPurchase} className="modal-body">
              {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="edit-purch-desc">Descrição da Compra</label>
                <input
                  id="edit-purch-desc"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Celular novo, Supermercado, Passagem"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  required
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-purch-amt">Valor Total da Compra (R$)</label>
                  <input
                    id="edit-purch-amt"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="250,00"
                    value={editAmountStr}
                    onChange={(e) => setEditAmountStr(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-purch-date">Data da Compra</label>
                  <input
                    id="edit-purch-date"
                    type="date"
                    className="form-input"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-purch-inst">Quantidade de Parcelas</label>
                  <select
                    id="edit-purch-inst"
                    className="form-select"
                    value={editInstallmentsCount}
                    onChange={(e) => setEditInstallmentsCount(Number(e.target.value))}
                  >
                    {Array.from({ length: 48 }, (_, i) => i + 1).map((n) => {
                      const totalVal = parseFloat(editAmountStr.replace(',', '.')) || 0;
                      const approxInst = totalVal > 0 ? (totalVal / n).toFixed(2) : '0,00';
                      return (
                        <option key={n} value={n}>
                          {n}x de ~R$ {approxInst} {n === 1 ? '(À vista na fatura)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-purch-cat">Categoria</label>
                  <select
                    id="edit-purch-cat"
                    className="form-select"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                  >
                    {categories.filter((c) => c.type === 'expense').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-purch-notes">Observações (Opcional)</label>
                <input
                  id="edit-purch-notes"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Compra feita na Amazon, garantia estendida"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                <strong>Atenção ao recalcular:</strong> As parcelas desta compra serão redistribuídas a partir da nova data
                respeitando o dia de fechamento do cartão ({activeCard?.closing_day || 20}) e a soma de centavos exata.
              </div>

              <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPurchase(null)}>
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

      {/* Modal: Confirmar Exclusão de Compra */}
      {deletingPurchase && (
        <div className="modal-overlay" onClick={() => setDeletingPurchase(null)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-expense)' }}>
                <AlertTriangle size={20} />
                <h3 className="modal-title" style={{ color: 'var(--color-expense)' }}>Excluir Compra do Cartão</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setDeletingPurchase(null)}
                aria-label="Fechar"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Tem certeza que deseja excluir permanentemente a compra <strong>"{deletingPurchase.description}"</strong>?
              </p>

              <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                <div>Valor Total: <strong>{formatCurrencyBRL(deletingPurchase.total_amount_cents)}</strong></div>
                <div>Data: <strong>{formatDateBRL(deletingPurchase.purchase_date)}</strong></div>
                <div>Parcelas vinculadas: <strong>{deletingPurchase.installments_count} parcela(s)</strong></div>
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Esta ação removerá todas as parcelas associadas desta e de faturas futuras, restaurando automaticamente o limite do cartão.
              </p>

              <div className="modal-footer" style={{ margin: '1.25rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDeletingPurchase(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePurchase}
                  className="btn"
                  style={{
                    backgroundColor: 'var(--color-expense)',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                >
                  <Trash2 size={16} />
                  <span>Excluir Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Limite e Detalhes do Cartão */}
      {editingCard && (
        <div className="modal-overlay" onClick={() => setEditingCard(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCardIcon size={20} style={{ color: editCardColor }} />
                <h3 className="modal-title">Editar Limite do Cartão</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setEditingCard(null)}
                aria-label="Fechar"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="modal-body">
              {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

              {/* Limite Total Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-card-lim">
                  <strong>Novo Limite Total (R$) *</strong>
                </label>
                <input
                  id="edit-card-lim"
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-input"
                  placeholder="3000,00"
                  value={editCardLimitStr}
                  onChange={(e) => setEditCardLimitStr(e.target.value)}
                  required
                  style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}
                />
                <span className="form-hint">
                  O limite disponível e o percentual de uso serão recalculados imediatamente.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-card-name">Nome do Cartão *</label>
                <input
                  id="edit-card-name"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Nubank Roxinho, Itaú Black"
                  value={editCardName}
                  onChange={(e) => setEditCardName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-card-iss">Bandeira / Emissor (Opcional)</label>
                  <input
                    id="edit-card-iss"
                    type="text"
                    className="form-input"
                    placeholder="Ex: Mastercard, Visa"
                    value={editCardIssuer}
                    onChange={(e) => setEditCardIssuer(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-card-close">Dia de Fechamento</label>
                  <input
                    id="edit-card-close"
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    value={editClosingDay}
                    onChange={(e) => setEditClosingDay(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-card-due">Dia de Vencimento</label>
                  <input
                    id="edit-card-due"
                    type="number"
                    min="1"
                    max="31"
                    className="form-input"
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cor do Cartão</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#3b82f6'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditCardColor(color)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: editCardColor === color ? '3px solid #ffffff' : 'none',
                          boxShadow: 'var(--shadow-sm)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingCard(null)}>
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
    </div>
  );
};

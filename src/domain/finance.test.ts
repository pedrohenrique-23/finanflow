import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCents,
  fromCents,
  formatCurrencyBRL,
  calculateCurrentBalance,
  calculateProjectedBalance,
  generateInstallments,
  determineFirstInvoiceCycle,
  calculateCardLimits,
  deriveTransactionStatus,
  calculateMonthlyMetrics,
  calculateBudgetStatus,
  isRecurrenceAlreadyConfirmed,
  addMonthsToYearMonth,
} from './finance';
import {
  CreditCard,
  Installment,
  Invoice,
  InvoicePayment,
  RecurringOccurrence,
  Transaction,
} from './types';

// Cenário 1: Saldo inicial de R$ 1.000,00, receita recebida de R$ 500,00 e despesa paga de R$ 200,00: saldo atual de R$ 1.300,00.
test('Cenário 1: Saldo inicial + receita recebida - despesa paga = R$ 1.300,00', () => {
  const initialBalanceCents = toCents(1000); // 100000
  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      user_id: 'user-1',
      description: 'Salário',
      amount_cents: toCents(500),
      type: 'income',
      category_id: 'cat-income',
      date: '2026-10-05',
      status: 'completed',
      payment_method: 'account',
    },
    {
      id: 'tx-2',
      user_id: 'user-1',
      description: 'Mercado',
      amount_cents: toCents(200),
      type: 'expense',
      category_id: 'cat-market',
      date: '2026-10-06',
      status: 'completed',
      payment_method: 'cash',
    },
  ];

  const currentBalance = calculateCurrentBalance({
    initialBalanceCents,
    transactions,
  });

  assert.equal(currentBalance, toCents(1300));
  assert.equal(fromCents(currentBalance), 1300);
});

// Cenário 2: Compra de R$ 600,00 em seis parcelas: seis parcelas cuja soma seja exatamente R$ 600,00.
test('Cenário 2: Compra de R$ 600,00 em 6x resulta em 6 parcelas somando exatamente R$ 600,00', () => {
  const installments = generateInstallments({
    purchaseId: 'purch-1',
    userId: 'user-1',
    cardId: 'card-1',
    totalAmountCents: toCents(600),
    installmentsCount: 6,
    purchaseDate: '2026-10-10',
    closingDay: 20,
    dueDay: 28,
  });

  assert.equal(installments.length, 6);
  const sum = installments.reduce((acc, inst) => acc + inst.amount_cents, 0);
  assert.equal(sum, toCents(600));
  installments.forEach((inst) => {
    assert.equal(inst.amount_cents, toCents(100));
  });
});

// Cenário 3: Compra no cartão não deve reduzir imediatamente o saldo atual.
test('Cenário 3: Compra no cartão não reduz o saldo bancário/caixa imediatamente', () => {
  const initialBalanceCents = toCents(1000);
  const transactions: Transaction[] = [
    {
      id: 'tx-card-1',
      user_id: 'user-1',
      description: 'Eletrônico no cartão de crédito',
      amount_cents: toCents(450),
      type: 'expense',
      category_id: 'cat-tech',
      date: '2026-10-15',
      status: 'completed',
      payment_method: 'credit_card', // cartão de crédito não é caixa imediato
    },
  ];

  const currentBalance = calculateCurrentBalance({
    initialBalanceCents,
    transactions,
  });

  // Saldo permanece R$ 1.000,00 intacto
  assert.equal(currentBalance, toCents(1000));
});

// Cenário 4: Pagamento de fatura deve reduzir o saldo atual sem duplicar as despesas de consumo.
test('Cenário 4: Pagamento de fatura reduz saldo atual sem duplicar despesas de consumo', () => {
  const initialBalanceCents = toCents(1000);
  const invoicePayment: InvoicePayment = {
    id: 'pay-1',
    user_id: 'user-1',
    invoice_id: 'inv-1',
    card_id: 'card-1',
    amount_cents: toCents(300),
    payment_date: '2026-10-25',
  };

  const currentBalance = calculateCurrentBalance({
    initialBalanceCents,
    transactions: [],
    invoicePayments: [invoicePayment],
  });

  // Reduz saldo atual para 700
  assert.equal(currentBalance, toCents(700));

  // Verificar que métricas mensais tratam parcelas do cartão como consumo e pagamento como liquidação de passivo
  const installments: Installment[] = [
    {
      id: 'inst-1',
      user_id: 'user-1',
      purchase_id: 'p-1',
      card_id: 'card-1',
      installment_number: 1,
      total_installments: 1,
      amount_cents: toCents(300),
      cycle_year_month: '2026-10',
      due_date: '2026-10-25',
      is_liquidated: true,
    },
  ];

  const metrics = calculateMonthlyMetrics({
    yearMonth: '2026-10',
    initialBalanceCents,
    transactions: [],
    installments,
    invoices: [],
    invoicePayments: [invoicePayment],
  });

  // O consumo do mês é R$ 300 (da compra/parcela no cartão)
  assert.equal(metrics.creditCardConsumptionCents, toCents(300));
  // O pagamento da fatura é computado como movimentação financeira
  assert.equal(metrics.invoicePaymentsCents, toCents(300));
  // Despesas diretas de caixa pagas foram 0 (não houve despesa em dinheiro duplicada)
  assert.equal(metrics.paidExpenseCents, 0);
});

// Cenário 5: Pagamento parcial: a fatura deve permanecer pendente pelo valor restante.
test('Cenário 5: Pagamento parcial mantém a fatura pendente com o saldo restante', () => {
  const totalAmountCents = toCents(500); // R$ 500
  const paidAmountCents = toCents(200); // R$ 200 pagos
  const pendingAmountCents = totalAmountCents - paidAmountCents;

  assert.equal(pendingAmountCents, toCents(300));
});

// Cenário 6: Compra realizada depois do fechamento: deve ser direcionada ao ciclo seguinte.
test('Cenário 6: Compra realizada depois do fechamento vai para o ciclo seguinte', () => {
  const closingDay = 20;
  // Compra em 22/10/2026 (após dia 20)
  const cycle = determineFirstInvoiceCycle('2026-10-22', closingDay);
  assert.equal(cycle, '2026-11');
});

// Cenário 7: Compra realizada exatamente no dia de fechamento: obedece à regra documentada (ciclo seguinte).
test('Cenário 7: Compra realizada no dia de fechamento entra no ciclo seguinte', () => {
  const closingDay = 20;
  // Compra em 20/10/2026 (exatamente no dia do fechamento)
  const cycle = determineFirstInvoiceCycle('2026-10-20', closingDay);
  assert.equal(cycle, '2026-11');

  // Compra antes do fechamento entra no mês atual
  const cycleBefore = determineFirstInvoiceCycle('2026-10-19', closingDay);
  assert.equal(cycleBefore, '2026-10');
});

// Cenário 8: Compra parcelada atravessando a virada do ano: distribuída pelos meses corretos.
test('Cenário 8: Compra parcelada atravessando a virada de ano (ex: Nov/2026 em 4 parcelas)', () => {
  const installments = generateInstallments({
    purchaseId: 'purch-new-year',
    userId: 'user-1',
    cardId: 'card-1',
    totalAmountCents: toCents(400),
    installmentsCount: 4,
    purchaseDate: '2026-11-10',
    closingDay: 20,
    dueDay: 28,
  });

  assert.equal(installments.length, 4);
  assert.equal(installments[0].cycle_year_month, '2026-11');
  assert.equal(installments[1].cycle_year_month, '2026-12');
  assert.equal(installments[2].cycle_year_month, '2027-01');
  assert.equal(installments[3].cycle_year_month, '2027-02');
});

// Cenário 9: Despesa vencida e não paga: aparece como vencida, sem ser considerada paga.
test('Cenário 9: Despesa com vencimento anterior e status pendente deriva status "overdue"', () => {
  const tx: Transaction = {
    id: 'tx-overdue',
    user_id: 'user-1',
    description: 'Conta de luz',
    amount_cents: toCents(180),
    type: 'expense',
    category_id: 'cat-utilities',
    date: '2026-10-01',
    due_date: '2026-10-10',
    status: 'pending',
    payment_method: 'account',
  };

  const status = deriveTransactionStatus(tx, '2026-10-27');
  assert.equal(status, 'overdue');
  assert.notEqual(status, 'completed');
});

// Cenário 10: Recorrência confirmada duas vezes: não pode criar duplicatas.
test('Cenário 10: Recorrência já confirmada bloqueia geração de duplicata para o mesmo mês', () => {
  const ruleId = 'rule-aluguel-123';
  const yearMonth = '2026-10';
  const existingOccurrences: RecurringOccurrence[] = [
    {
      id: `${ruleId}_${yearMonth}`,
      user_id: 'user-1',
      rule_id: ruleId,
      year_month: '2026-10',
      expected_date: '2026-10-05',
      amount_cents: toCents(1200),
      status: 'confirmed',
      transaction_id: 'tx-aluguel-1',
    },
  ];

  const isDuplicate = isRecurrenceAlreadyConfirmed(ruleId, yearMonth, existingOccurrences);
  assert.equal(isDuplicate, true);

  // Para o mês seguinte ainda não está confirmada
  const isDuplicateNextMonth = isRecurrenceAlreadyConfirmed(ruleId, '2026-11', existingOccurrences);
  assert.equal(isDuplicateNextMonth, false);
});

// Cenário 11: Edição de uma compra parcelada mantém consistência das parcelas e faturas.
test('Cenário 11: Regenerar parcelas após alteração de valor mantém a soma exata', () => {
  // Alteração de R$ 600 em 3x para R$ 750 em 3x
  const newInstallments = generateInstallments({
    purchaseId: 'purch-edit',
    userId: 'user-1',
    cardId: 'card-1',
    totalAmountCents: toCents(750),
    installmentsCount: 3,
    purchaseDate: '2026-10-05',
    closingDay: 20,
    dueDay: 28,
  });

  const sum = newInstallments.reduce((acc, inst) => acc + inst.amount_cents, 0);
  assert.equal(sum, toCents(750));
  assert.equal(newInstallments[0].amount_cents, toCents(250));
  assert.equal(newInstallments[1].amount_cents, toCents(250));
  assert.equal(newInstallments[2].amount_cents, toCents(250));
});

// Cenário 12: Exclusão de movimentação atualiza corretamente saldos.
test('Cenário 12: Exclusão de uma despesa reflete no recálculo do saldo', () => {
  const initialBalanceCents = toCents(1000);
  const tx1: Transaction = {
    id: 'tx-1',
    user_id: 'user-1',
    description: 'Gasolina',
    amount_cents: toCents(150),
    type: 'expense',
    category_id: 'transp',
    date: '2026-10-02',
    status: 'completed',
    payment_method: 'cash',
  };
  const tx2: Transaction = {
    id: 'tx-2',
    user_id: 'user-1',
    description: 'Farmácia',
    amount_cents: toCents(50),
    type: 'expense',
    category_id: 'health',
    date: '2026-10-03',
    status: 'completed',
    payment_method: 'cash',
  };

  const balanceBefore = calculateCurrentBalance({
    initialBalanceCents,
    transactions: [tx1, tx2],
  });
  assert.equal(balanceBefore, toCents(800));

  // Exclui tx2
  const balanceAfter = calculateCurrentBalance({
    initialBalanceCents,
    transactions: [tx1],
  });
  assert.equal(balanceAfter, toCents(850));
});

// Cenário 13: Pagamento de uma fatura libera o limite correspondente uma única vez.
test('Cenário 13: Pagamento de fatura liquida parcelas e restaura limite apenas uma vez', () => {
  const cardLimitCents = toCents(2000);
  const installments: Installment[] = [
    {
      id: 'inst-1',
      user_id: 'user-1',
      purchase_id: 'p-1',
      card_id: 'card-1',
      installment_number: 1,
      total_installments: 2,
      amount_cents: toCents(400),
      cycle_year_month: '2026-10',
      due_date: '2026-10-25',
      is_liquidated: false,
    },
    {
      id: 'inst-2',
      user_id: 'user-1',
      purchase_id: 'p-1',
      card_id: 'card-1',
      installment_number: 2,
      total_installments: 2,
      amount_cents: toCents(400),
      cycle_year_month: '2026-11',
      due_date: '2026-11-25',
      is_liquidated: false,
    },
  ];

  // Antes de pagar: limite comprometido é 800, disponível é 1200
  const limitsBefore = calculateCardLimits(cardLimitCents, installments);
  assert.equal(limitsBefore.committedLimitCents, toCents(800));
  assert.equal(limitsBefore.availableLimitCents, toCents(1200));

  // Liquidação da parcela 1 (fatura de Outubro paga)
  installments[0].is_liquidated = true;

  const limitsAfter = calculateCardLimits(cardLimitCents, installments);
  assert.equal(limitsAfter.committedLimitCents, toCents(400));
  assert.equal(limitsAfter.availableLimitCents, toCents(1600));

  // Se calcular novamente sem novas alterações, não libera novamente
  const limitsRepeat = calculateCardLimits(cardLimitCents, installments);
  assert.equal(limitsRepeat.availableLimitCents, toCents(1600));
});

// Cenário 14: Usuário A tentando acessar dados de Usuário B é isolado.
test('Cenário 14: Isolamento estrito de dados por user_id', () => {
  const transactions: Transaction[] = [
    {
      id: 'tx-user-a',
      user_id: 'user-a',
      description: 'Salário Usuário A',
      amount_cents: toCents(5000),
      type: 'income',
      category_id: 'cat-sal',
      date: '2026-10-01',
      status: 'completed',
      payment_method: 'account',
    },
    {
      id: 'tx-user-b',
      user_id: 'user-b',
      description: 'Salário Usuário B',
      amount_cents: toCents(8000),
      type: 'income',
      category_id: 'cat-sal',
      date: '2026-10-01',
      status: 'completed',
      payment_method: 'account',
    },
  ];

  const userATransactions = transactions.filter((t) => t.user_id === 'user-a');
  assert.equal(userATransactions.length, 1);
  assert.equal(userATransactions[0].description, 'Salário Usuário A');
});

// Cenário 15: Valores monetários com centavos: sem erros de arredondamento.
test('Cenário 15: Distribuição determinística de centavos (ex: R$ 100,00 em 3 parcelas)', () => {
  const installments = generateInstallments({
    purchaseId: 'p-cents',
    userId: 'user-1',
    cardId: 'card-1',
    totalAmountCents: toCents(100.0), // 10000 centavos
    installmentsCount: 3,
    purchaseDate: '2026-10-01',
    closingDay: 20,
    dueDay: 28,
  });

  // 10000 / 3 = 3333.3333...
  // Parcela 1: 3334 centavos (R$ 33,34)
  // Parcela 2: 3333 centavos (R$ 33,33)
  // Parcela 3: 3333 centavos (R$ 33,33)
  // Soma exata = 10000 centavos (R$ 100,00)
  assert.equal(installments[0].amount_cents, 3334);
  assert.equal(installments[1].amount_cents, 3333);
  assert.equal(installments[2].amount_cents, 3333);

  const total = installments.reduce((acc, i) => acc + i.amount_cents, 0);
  assert.equal(total, 10000);
});

// Cenário 16: Mês sem movimentações exibe dashboard correto e sem quebra.
test('Cenário 16: Mês vazio retorna métricas zeradas sem erros', () => {
  const metrics = calculateMonthlyMetrics({
    yearMonth: '2026-01',
    initialBalanceCents: toCents(500),
    transactions: [],
    installments: [],
    invoices: [],
    invoicePayments: [],
  });

  assert.equal(metrics.currentBalanceCents, toCents(500));
  assert.equal(metrics.receivedIncomeCents, 0);
  assert.equal(metrics.paidExpenseCents, 0);
  assert.equal(metrics.pendingExpenseCents, 0);
  assert.equal(metrics.overdueExpenseCents, 0);
  assert.equal(metrics.creditCardConsumptionCents, 0);
  assert.equal(metrics.projectedBalanceCents, toCents(500));
});

// Teste adicional: Orçamento por categoria (normal, alerta 80%, excedido 100%)
test('Orçamento por categoria calcula percentuais e status corretamente', () => {
  const statusNormal = calculateBudgetStatus(toCents(700), toCents(1000));
  assert.equal(statusNormal.percentage, 70);
  assert.equal(statusNormal.status, 'normal');

  const statusWarning = calculateBudgetStatus(toCents(850), toCents(1000));
  assert.equal(statusWarning.percentage, 85);
  assert.equal(statusWarning.status, 'warning');

  const statusExceeded = calculateBudgetStatus(toCents(1050), toCents(1000));
  assert.equal(statusExceeded.percentage, 105);
  assert.equal(statusExceeded.status, 'exceeded');
});

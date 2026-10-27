-- ====================================================================
-- FinanFlow - Script de Migração e Modelagem PostgreSQL para Supabase
-- Sistema de Controle Financeiro Pessoal
-- Data: 2026-10-27
-- ====================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Perfis de Usuário (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Categorias (categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Cartões de Crédito (credit_cards)
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  limit_cents BIGINT NOT NULL CHECK (limit_cents >= 0),
  closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela de Transações / Movimentações (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'initial_balance')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  due_date DATE,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'account' CHECK (payment_method IN ('cash', 'account', 'credit_card')),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_rule_id UUID,
  origin_id TEXT,
  is_invoice_payment BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela de Compras no Cartão de Crédito (credit_card_purchases)
CREATE TABLE IF NOT EXISTS public.credit_card_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents >= 0),
  purchase_date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  installments_count INTEGER NOT NULL CHECK (installments_count >= 1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabela de Parcelas de Compras (installments)
CREATE TABLE IF NOT EXISTS public.installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.credit_card_purchases(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number >= 1),
  total_installments INTEGER NOT NULL CHECK (total_installments >= 1),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  cycle_year_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  due_date DATE NOT NULL,
  is_liquidated BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tabela de Faturas de Cartão (invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_cents >= 0),
  paid_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid', 'partially_paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_card_invoice_month UNIQUE (user_id, card_id, year_month)
);

-- 9. Tabela de Pagamentos de Faturas (invoice_payments)
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Tabela de Regras Recorrentes (recurring_rules)
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Tabela de Ocorrências Recorrentes com Idempotência (recurring_occurrences)
CREATE TABLE IF NOT EXISTS public.recurring_occurrences (
  id TEXT PRIMARY KEY, -- '${rule_id}_${year_month}' impede duplicações acidentais
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.recurring_rules(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL,
  expected_date DATE NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN ('pending_confirmation', 'confirmed', 'dismissed')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rule_month UNIQUE (rule_id, year_month)
);

-- 12. Tabela de Orçamentos Mensais por Categoria (monthly_budgets)
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  limit_cents BIGINT NOT NULL CHECK (limit_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_category_month UNIQUE (user_id, category_id, year_month)
);

-- ====================================================================
-- ÍNDICES DE PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_user_cycle ON public.installments(user_id, cycle_year_month);
CREATE INDEX IF NOT EXISTS idx_invoices_user_card ON public.invoices(user_id, card_id, year_month);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.monthly_budgets(user_id, year_month);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA POR USUÁRIO
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para perfis
CREATE POLICY "Users can view and manage their own profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categorias
CREATE POLICY "Users can view and manage their own categories"
  ON public.categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Cartões de crédito
CREATE POLICY "Users can view and manage their own cards"
  ON public.credit_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transações
CREATE POLICY "Users can view and manage their own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Compras no cartão
CREATE POLICY "Users can view and manage their credit card purchases"
  ON public.credit_card_purchases FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Parcelas
CREATE POLICY "Users can view and manage their installments"
  ON public.installments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Faturas
CREATE POLICY "Users can view and manage their invoices"
  ON public.invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pagamentos de fatura
CREATE POLICY "Users can view and manage their invoice payments"
  ON public.invoice_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Regras recorrentes
CREATE POLICY "Users can view and manage their recurring rules"
  ON public.recurring_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ocorrências recorrentes
CREATE POLICY "Users can view and manage their recurring occurrences"
  ON public.recurring_occurrences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Orçamentos
CREATE POLICY "Users can view and manage their monthly budgets"
  ON public.monthly_budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- TRIGGER AUTOMÁTICO: CRIAR PERFIL E CATEGORIAS AO CADASTRAR NO AUTH
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
BEGIN
  -- Cria perfil inicial
  INSERT INTO public.profiles (user_id, display_name, initial_balance_cents, start_date)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'), 0, CURRENT_DATE);

  -- Categorias padrão de Receitas
  INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id, 'Salário', 'income', 'briefcase', '#10b981', true),
    (NEW.id, 'Freelance', 'income', 'laptop', '#06b6d4', true),
    (NEW.id, 'Vendas', 'income', 'shopping-bag', '#8b5cf6', true),
    (NEW.id, 'Rendimentos', 'income', 'trending-up', '#3b82f6', true),
    (NEW.id, 'Outros recebimentos', 'income', 'plus-circle', '#64748b', true);

  -- Categorias padrão de Despesas
  INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id, 'Moradia', 'expense', 'home', '#ef4444', true),
    (NEW.id, 'Alimentação', 'expense', 'utensils', '#f97316', true),
    (NEW.id, 'Transporte', 'expense', 'car', '#eab308', true),
    (NEW.id, 'Saúde', 'expense', 'heart-pulse', '#ec4899', true),
    (NEW.id, 'Educação', 'expense', 'graduation-cap', '#6366f1', true),
    (NEW.id, 'Lazer', 'expense', 'film', '#a855f7', true),
    (NEW.id, 'Assinaturas', 'expense', 'repeat', '#06b6d4', true),
    (NEW.id, 'Compras', 'expense', 'shopping-cart', '#14b8a6', true),
    (NEW.id, 'Contas e serviços', 'expense', 'file-text', '#f43f5e', true),
    (NEW.id, 'Outros gastos', 'expense', 'more-horizontal', '#64748b', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger disparado no cadastro do auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

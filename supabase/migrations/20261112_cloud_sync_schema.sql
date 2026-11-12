-- ====================================================================
-- FinanFlow - Schema de sincronização na nuvem (substitui 20261027_init)
--
-- O app gera IDs de texto no cliente (ex.: "tx_1731...", "cat_exp_1"),
-- e IDs como "cat_exp_1" se repetem entre usuários. Por isso cada tabela
-- usa chave primária composta (user_id, id) com id TEXT.
-- user_id é o UUID do Supabase Auth, preenchido por padrão com auth.uid().
-- Não há FKs entre entidades: a integridade é mantida pelo app
-- (ex.: a categoria virtual "cat_invoice_payment" não existe como linha).
-- ====================================================================

-- Perfil (1 por usuário). A tabela já existia (vazia) com id UUID e user_id UNIQUE;
-- aqui apenas completamos as colunas. O app faz upsert com onConflict = user_id.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  theme TEXT NOT NULL DEFAULT 'dark',
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.categories (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.credit_cards (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  issuer TEXT,
  limit_cents BIGINT NOT NULL DEFAULT 0,
  closing_day SMALLINT NOT NULL,
  due_day SMALLINT NOT NULL,
  color TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  type TEXT NOT NULL,
  category_id TEXT,
  date DATE NOT NULL,
  due_date DATE,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'account',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_rule_id TEXT,
  origin_id TEXT,
  is_invoice_payment BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.credit_card_purchases (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  description TEXT NOT NULL,
  total_amount_cents BIGINT NOT NULL,
  purchase_date DATE NOT NULL,
  category_id TEXT,
  installments_count INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.installments (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  installment_number INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  amount_cents BIGINT NOT NULL,
  cycle_year_month VARCHAR(7) NOT NULL,
  due_date DATE NOT NULL,
  is_liquidated BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  year_month VARCHAR(7) NOT NULL,
  closing_date DATE,
  due_date DATE,
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  paid_amount_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.invoice_payments (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.recurring_rules (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  type TEXT NOT NULL,
  category_id TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day_of_month SMALLINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.recurring_occurrences (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  year_month VARCHAR(7) NOT NULL,
  expected_date DATE,
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  year_month VARCHAR(7) NOT NULL,
  category_id TEXT NOT NULL,
  limit_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_installments_user_cycle ON public.installments(user_id, cycle_year_month);
CREATE INDEX IF NOT EXISTS idx_installments_user_purchase ON public.installments(user_id, purchase_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.monthly_budgets(user_id, year_month);

-- RLS: cada usuário só enxerga e altera as próprias linhas
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','categories','credit_cards','transactions','credit_card_purchases',
    'installments','invoices','invoice_payments','recurring_rules',
    'recurring_occurrences','monthly_budgets'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'own_rows'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "own_rows" ON public.%I FOR ALL TO authenticated
           USING ((select auth.uid()) = user_id)
           WITH CHECK ((select auth.uid()) = user_id)', t);
    END IF;
  END LOOP;
END $$;

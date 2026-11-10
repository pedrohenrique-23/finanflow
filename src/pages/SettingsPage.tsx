import React, { useState } from 'react';
import {
  Settings,
  Database,
  Moon,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Clock,
  DollarSign,
  AlertCircle,
  Sparkles,
  Download,
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Save,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../services/supabase';
import { formatCurrencyBRL, fromCents, toCents } from '../domain/finance';

export const SettingsPage: React.FC = () => {
  const { profile, updateProfile, theme, toggleTheme, user, updateUserCredentials, logout } = useApp();

  const creds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(creds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(creds.anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // User profile & security edit state
  const [profileName, setProfileName] = useState(profile.display_name || user?.displayName || '');
  const [profileNewPwd, setProfileNewPwd] = useState('');
  const [profileConfirmPwd, setProfileConfirmPwd] = useState('');
  const [showProfilePwd, setShowProfilePwd] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Initial balance correction flow
  const [initialBalanceStr, setInitialBalanceStr] = useState(
    String(fromCents(profile.initial_balance_cents))
  );
  const [balanceSavedMsg, setBalanceSavedMsg] = useState(false);

  // Sync profileName if profile changes
  React.useEffect(() => {
    if (profile.display_name || user?.displayName) {
      setProfileName(profile.display_name || user?.displayName || '');
    }
  }, [profile.display_name, user?.displayName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    const trimmed = profileName.trim();
    if (!trimmed) {
      setProfileFeedback({ type: 'error', message: 'O nome de exibição não pode ficar vazio.' });
      return;
    }

    if (profileNewPwd) {
      if (profileNewPwd.length < 6) {
        setProfileFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres.' });
        return;
      }
      if (profileNewPwd !== profileConfirmPwd) {
        setProfileFeedback({ type: 'error', message: 'A confirmação de senha não confere com a nova senha digitada.' });
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const res = await updateUserCredentials({
        displayName: trimmed,
        newPassword: profileNewPwd || undefined,
      });

      if (!res.success) {
        setProfileFeedback({ type: 'error', message: res.error || 'Erro ao salvar alterações do perfil.' });
      } else {
        setProfileFeedback({ type: 'success', message: res.message || 'Perfil e credenciais atualizados com sucesso!' });
        setProfileNewPwd('');
        setProfileConfirmPwd('');
        setTimeout(() => setProfileFeedback(null), 4000);
      }
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Erro inesperado ao salvar perfil.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // SQL Script display modal
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(initialBalanceStr.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      await updateProfile({
        initial_balance_cents: toCents(val),
      });
      setBalanceSavedMsg(true);
      setTimeout(() => setBalanceSavedMsg(false), 3000);
    }
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    setTestResult({
      success: true,
      message: 'Credenciais salvas com sucesso no navegador.',
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const sqlSchemaCode = `-- ====================================================================
-- FinanFlow - Script de Migração e Modelagem PostgreSQL para Supabase
-- Sistema de Controle Financeiro Pessoal
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
  cycle_year_month VARCHAR(7) NOT NULL,
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
  year_month VARCHAR(7) NOT NULL,
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
  id TEXT PRIMARY KEY,
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

-- 13. HABILITAR ROW LEVEL SECURITY (RLS)
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

-- 14. POLÍTICAS DE RLS (USUÁRIO SÓ ACESSA OS PRÓPRIOS DADOS)
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own cards" ON public.credit_cards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own purchases" ON public.credit_card_purchases FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own installments" ON public.installments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own invoices" ON public.invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own invoice payments" ON public.invoice_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own recurring rules" ON public.recurring_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own recurring occurrences" ON public.recurring_occurrences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage own monthly budgets" ON public.monthly_budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="settings-page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Configurações e Parâmetros Financeiros
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Gerencie o saldo de abertura, banco de dados Supabase e preferências de exibição
        </p>
      </div>

      {/* 0. Meu Perfil e Segurança da Conta */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <User size={18} style={{ color: 'var(--brand-primary)' }} />
              <span>Meu Perfil e Segurança da Conta</span>
            </h3>
            <span className="card-subtitle">
              Atualize seu nome de exibição e altere sua senha de acesso
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="settings-profile-name">
                Nome de Exibição
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="settings-profile-name"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Seu nome"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">E-mail Cadastrado</label>
              <div
                className="form-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  opacity: 0.85,
                  cursor: 'not-allowed',
                }}
              >
                <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                <span>{user?.email || 'demo@finanflow.app'}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Alterar Senha de Acesso (Opcional)
            </div>

            <div className="form-row form-row-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="settings-new-pwd">
                  Nova Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="settings-new-pwd"
                    type={showProfilePwd ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                    placeholder="Mínimo 6 caracteres"
                    value={profileNewPwd}
                    onChange={(e) => setProfileNewPwd(e.target.value)}
                    minLength={6}
                  />
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePwd(!showProfilePwd)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 0,
                    }}
                    title={showProfilePwd ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showProfilePwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="settings-confirm-pwd">
                  Confirmar Nova Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="settings-confirm-pwd"
                    type={showProfilePwd ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '2.25rem' }}
                    placeholder="Repita a nova senha"
                    value={profileConfirmPwd}
                    onChange={(e) => setProfileConfirmPwd(e.target.value)}
                    required={profileNewPwd.length > 0}
                  />
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingProfile}
            >
              <Save size={16} />
              <span>{isSavingProfile ? 'Salvando...' : 'Salvar Dados do Perfil'}</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="btn btn-secondary"
              style={{ color: 'var(--color-expense)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              title="Encerrar sessão nesta conta"
            >
              <LogOut size={16} />
              <span>Sair da Conta (Deslogar)</span>
            </button>
          </div>

          {profileFeedback && (
            <div
              className={`alert-banner ${profileFeedback.type === 'success' ? 'info' : 'danger'}`}
              style={{ marginTop: '1rem', padding: '0.65rem 1rem' }}
            >
              {profileFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{profileFeedback.message}</span>
            </div>
          )}
        </form>
      </div>

      {/* 1. Ajuste do Saldo Inicial de Abertura */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <DollarSign size={18} style={{ color: 'var(--brand-primary)' }} />
            <span>Ajuste Explícito do Saldo Inicial</span>
          </h3>
          <span className="card-subtitle">Saldo de abertura das contas</span>
        </div>

        <form onSubmit={handleSaveBalance}>
          <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            <ShieldCheck size={16} style={{ color: 'var(--brand-primary)', display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            <strong>Regra de Integridade:</strong> O saldo inicial representa seu patrimônio líquido existente
            no início do controle financeiro. A alteração recalcula o saldo atual e previsões, sem ser contabilizada
            como salário ou receita do mês.
          </div>

          <div className="form-row form-row-2" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="set-bal">Saldo de Abertura (R$)</label>
              <input
                id="set-bal"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={initialBalanceStr}
                onChange={(e) => setInitialBalanceStr(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
              <span>Salvar Correção de Saldo</span>
            </button>
          </div>

          {balanceSavedMsg && (
            <div className="alert-banner info" style={{ marginTop: '1rem', padding: '0.65rem 1rem' }}>
              <CheckCircle2 size={16} />
              <span>Saldo inicial atualizado e todos os indicadores foram recalculados com sucesso!</span>
            </div>
          )}
        </form>
      </div>

      {/* 2. Preferências Visuais e Regionais */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Sparkles size={18} style={{ color: '#8b5cf6' }} />
            <span>Preferências Regionais e Visuais</span>
          </h3>
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Tema da Interface</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={theme === 'light' ? toggleTheme : undefined}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: theme === 'dark' ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: '1px solid',
                  borderColor: theme === 'dark' ? 'var(--brand-primary)' : 'var(--border-subtle)',
                  color: theme === 'dark' ? 'var(--brand-primary)' : 'var(--text-muted)',
                }}
              >
                <Moon size={15} />
                <span>Tema Escuro</span>
              </button>
              <button
                type="button"
                onClick={theme === 'dark' ? toggleTheme : undefined}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: theme === 'light' ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: '1px solid',
                  borderColor: theme === 'light' ? 'var(--brand-primary)' : 'var(--border-subtle)',
                  color: theme === 'light' ? 'var(--brand-primary)' : 'var(--text-muted)',
                }}
              >
                <Sun size={15} />
                <span>Tema Claro</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fuso Horário Padrão</label>
            <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.85 }}>
              <Clock size={16} />
              <span>America/Fortaleza (UTC-3 - Padrão Nacional)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Conexão com Supabase (PostgreSQL & RLS) */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <Database size={18} style={{ color: 'var(--color-info)' }} />
              <span>Banco de Dados Supabase (PostgreSQL)</span>
            </h3>
            <span className="card-subtitle">
              Persistência relacional em nuvem com Row Level Security (RLS)
            </span>
          </div>

          <button onClick={() => setShowSqlModal(true)} className="btn btn-secondary btn-sm">
            <Download size={14} />
            <span>Ver Schema SQL</span>
          </button>
        </div>

        <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-income)', marginBottom: '0.4rem' }}>
            <CheckCircle2 size={16} />
            <span>
              <strong>Banco de Dados FinanFlow Ativo:</strong> Suas movimentações, despesas e cartões estão sendo sincronizados no servidor para acesso mútuo entre computador e celular.
            </span>
          </div>
          {creds.isConfigured ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-income)' }}>
              <CheckCircle2 size={16} />
              <span>
                <strong>Supabase Configurado:</strong> As credenciais do projeto externo estão ativas.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Database size={16} />
              <span>
                <strong>Supabase Externo (Opcional):</strong> Caso deseje replicar os dados para seu próprio banco Supabase PostgreSQL em tempo real, informe suas chaves abaixo.
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSupabaseConfig}>
          <div className="form-group">
            <label className="form-label" htmlFor="sp-url">Project URL</label>
            <input
              id="sp-url"
              type="text"
              className="form-input"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sp-key">Project Anon Key (Pública)</label>
            <input
              id="sp-key"
              type="password"
              className="form-input"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
            />
            <span className="form-hint">
              Nunca utilize a service_role key. Apenas a anon public key protegida por RLS.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary">
              Salvar Credenciais
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              className="btn btn-secondary"
              disabled={isTesting}
            >
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </button>
          </div>

          {testResult && (
            <div
              className={`alert-banner ${testResult.success ? 'info' : 'danger'}`}
              style={{ marginTop: '1rem' }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </form>
      </div>

      {/* SQL Script View Modal */}
      {showSqlModal && (
        <div className="modal-overlay" onClick={() => setShowSqlModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3 className="modal-title">Script de Migração SQL (PostgreSQL / Supabase)</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Copie o script abaixo e execute no <strong>SQL Editor</strong> do seu painel Supabase
                para criar todas as 11 tabelas, índices e políticas de Row Level Security (RLS):
              </p>
              <pre
                style={{
                  padding: '1rem',
                  backgroundColor: '#050811',
                  borderRadius: 'var(--radius-md)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  maxHeight: 260,
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                }}
              >
                {sqlSchemaCode}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSqlModal(false)}>
                Fechar
              </button>
              <button className="btn btn-primary" onClick={handleCopySql}>
                <Copy size={16} />
                <span>{copiedSql ? 'Copiado para Área de Transferência!' : 'Copiar SQL Completo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

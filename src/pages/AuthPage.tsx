import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  CreditCard,
  PieChart,
  Repeat,
  Lock,
  Mail,
  User,
  ArrowRight,
  Sun,
  Moon,
  Database,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const { login, register, theme, toggleTheme, isSupabaseActive } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email.trim(), password);
        if (!res.success) {
          setErrorMsg(res.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
        }
      } else {
        if (!name.trim()) {
          setErrorMsg('Por favor, informe seu nome completo.');
          setLoading(false);
          return;
        }
        const res = await register(email.trim(), password, name.trim());
        if (!res.success) {
          setErrorMsg(res.error || 'Falha ao criar conta.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Erro: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      {/* Top right theme toggle */}
      <div className="auth-theme-toggle-wrap">
        <button
          onClick={toggleTheme}
          className="btn-icon"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="auth-card-wrapper">
        {/* Left Side: Presentation & Features */}
        <div className="auth-presentation-side">
          <div>
            <div className="brand-badge" style={{ marginBottom: '1.5rem' }}>
              <div className="brand-logo-icon">
                <TrendingUp size={20} />
              </div>
              <span style={{ fontSize: 'var(--text-xl)' }}>FinanFlow</span>
            </div>

            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.75rem' }}>
              Controle financeiro pessoal com rigor, precisão e privacidade.
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Organize receitas, despesas, faturas de cartão de crédito e metas orçamentárias
              com cálculos sem imprecisão de centavos.
            </p>
          </div>

          <div className="auth-features-list">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <CreditCard size={18} />
              </div>
              <div>
                <div className="auth-feature-title">Cartões e Parcelamentos Reais</div>
                <div className="auth-feature-desc">
                  Regra de fechamento consistente e pagamentos de fatura sem duplicação de despesas.
                </div>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <Repeat size={18} />
              </div>
              <div>
                <div className="auth-feature-title">Recorrências com Confirmação</div>
                <div className="auth-feature-desc">
                  Você decide e confirma cada lançamento na virada do mês, com proteção anti-duplicidade.
                </div>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <PieChart size={18} />
              </div>
              <div>
                <div className="auth-feature-title">Orçamentos com Alertas 80% e 100%</div>
                <div className="auth-feature-desc">
                  Monitore limites por categoria e copie metas do mês anterior com 1 clique.
                </div>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="auth-feature-title">Segurança e Row Level Security (RLS)</div>
                <div className="auth-feature-desc">
                  Seus dados protegidos no Supabase PostgreSQL onde cada usuário acessa apenas o que é seu.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <Database size={14} style={{ color: 'var(--color-income)' }} />
            <span>
              {isSupabaseActive
                ? 'Conectado à nuvem Supabase (PostgreSQL)'
                : 'Banco de Dados FinanFlow Ativo (Sincronizado na Nuvem Desktop & Mobile)'}
            </span>
          </div>
        </div>

        {/* Right Side: Login & Registration Form */}
        <div className="auth-form-side">
          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', padding: '0.25rem', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: mode === 'login' ? 'var(--bg-surface)' : 'transparent',
                fontWeight: mode === 'login' ? 700 : 500,
                color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: mode === 'login' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: mode === 'register' ? 'var(--bg-surface)' : 'transparent',
                fontWeight: mode === 'register' ? 700 : 500,
                color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: mode === 'register' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Criar Conta
            </button>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>
              {mode === 'login' ? 'Acesse suas finanças' : 'Crie sua conta gratuita'}
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {mode === 'login'
                ? 'Digite seu e-mail e senha cadastrados para continuar'
                : 'Leva menos de 30 segundos e seus dados ficam protegidos'}
            </p>
          </div>

          {errorMsg && (
            <div className="alert-banner danger" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-reg-name">Nome Completo</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="auth-reg-name"
                    type="text"
                    className="form-input"
                    placeholder="Ex: Pedro Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-main-email">E-mail</label>
              <input
                id="auth-main-email"
                type="email"
                className="form-input"
                placeholder="seu.email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-main-pass">Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-main-pass"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: '2.5rem' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem',
                  }}
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.75rem', height: 44 }}
              disabled={loading}
            >
              <span>{loading ? 'Autenticando...' : mode === 'login' ? 'Entrar no FinanFlow' : 'Cadastrar e Começar'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

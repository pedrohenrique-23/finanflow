import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, Database } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, isSupabaseActive } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Falha ao autenticar.');
        } else {
          onClose();
        }
      } else {
        const res = await register(email, password, name);
        if (!res.success) {
          setErrorMsg(res.error || 'Falha ao cadastrar.');
        } else {
          onClose();
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'login' ? 'Entrar no FinanFlow' : 'Criar Conta Gratuita'}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Mode Switcher Tabs */}
          <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-elevated)', padding: '0.25rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); }}
              style={{
                flex: 1,
                padding: '0.5rem',
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
                padding: '0.5rem',
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

          {errorMsg && (
            <div className="alert-banner danger" style={{ padding: '0.65rem 1rem', marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Nome Completo</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-name"
                  type="text"
                  className="form-input"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">E-mail</label>
            <input
              id="auth-email"
              type="email"
              className="form-input"
              placeholder="exemplo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-pass">Senha</label>
            <input
              id="auth-pass"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '1rem 0' }}>
            <Database size={14} style={{ color: isSupabaseActive ? 'var(--brand-primary)' : 'var(--color-warning)' }} />
            <span>
              {isSupabaseActive
                ? 'Conectado ao Supabase (PostgreSQL com RLS)'
                : 'Modo seguro local ativo (Dados persistidos com isolamento)'}
            </span>
          </div>

          <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

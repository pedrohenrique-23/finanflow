import React, { useState } from 'react';
import { Sparkles, DollarSign, Calendar, Moon, Sun, ShieldAlert, Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toCents, fromCents, getTodayDateStr } from '../domain/finance';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { profile, completeOnboarding } = useApp();

  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [initialBalanceStr, setInitialBalanceStr] = useState(
    profile.initial_balance_cents > 0 ? String(fromCents(profile.initial_balance_cents)) : ''
  );
  const [startDate, setStartDate] = useState(profile.start_date || getTodayDateStr());
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light'>(profile.theme || 'dark');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleDismiss = async () => {
    await completeOnboarding({
      onboarding_completed: true,
    });
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedBalance = initialBalanceStr ? parseFloat(initialBalanceStr.replace(',', '.')) : 0;
    if (isNaN(parsedBalance) || parsedBalance < 0) {
      setErrorMsg('Informe um valor de saldo inicial válido (zero ou positivo).');
      return;
    }

    const initialBalanceCents = toCents(parsedBalance);

    await completeOnboarding({
      display_name: displayName.trim() || 'Usuário',
      initial_balance_cents: initialBalanceCents,
      start_date: startDate,
      theme: selectedTheme,
      onboarding_completed: true,
    });

    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="brand-logo-icon" style={{ width: 28, height: 28 }}>
              <Sparkles size={16} />
            </div>
            <h2 className="modal-title">Boas-vindas ao FinanFlow</h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={handleDismiss}
            aria-label="Fechar"
            title="Fechar e configurar depois"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Configure seu ponto de partida financeiro para começarmos a organizar suas contas com total clareza.
          </p>

          {errorMsg && (
            <div className="alert-banner danger" style={{ padding: '0.65rem 1rem', marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="onb-name">Nome de Exibição (Opcional)</label>
            <input
              id="onb-name"
              type="text"
              className="form-input"
              placeholder="Ex: Pedro Silva"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="onb-balance">
              Saldo Inicial Atual (R$)
            </label>
            <input
              id="onb-balance"
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              placeholder="0,00"
              value={initialBalanceStr}
              onChange={(e) => setInitialBalanceStr(e.target.value)}
            />
            <span className="form-hint" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.35rem' }}>
              <ShieldAlert size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong>Regra Financeira:</strong> Este é o valor que você já possui hoje em conta/carteira.
                Ele define o saldo de abertura e <em>não infla</em> seus gráficos de salário ou receitas mensais.
              </span>
            </span>
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="onb-date">Data de Início do Controle</label>
              <input
                id="onb-date"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Preferência de Tema</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTheme('dark')}
                  className="btn"
                  style={{
                    flex: 1,
                    backgroundColor: selectedTheme === 'dark' ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedTheme === 'dark' ? 'var(--brand-primary)' : 'var(--border-subtle)',
                    color: selectedTheme === 'dark' ? 'var(--brand-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Moon size={14} />
                  <span>Escuro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTheme('light')}
                  className="btn"
                  style={{
                    flex: 1,
                    backgroundColor: selectedTheme === 'light' ? 'var(--bg-surface-elevated)' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedTheme === 'light' ? 'var(--brand-primary)' : 'var(--border-subtle)',
                    color: selectedTheme === 'light' ? 'var(--brand-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Sun size={14} />
                  <span>Claro</span>
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: '1.25rem -1.5rem -1.5rem -1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDismiss}
              style={{ flex: 1 }}
            >
              Pular por enquanto
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
              <Check size={16} />
              <span>Concluir e Acessar o Dashboard</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

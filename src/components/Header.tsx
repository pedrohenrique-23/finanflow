import React from 'react';
import { PlusCircle, Moon, Sun, User, TrendingUp } from 'lucide-react';
import { MonthPicker } from './MonthPicker';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: string;
  onOpenNewTx: () => void;
  onOpenAuth?: () => void;
  onOpenProfileEdit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenNewTx, onOpenProfileEdit }) => {
  const { user, profile, theme, toggleTheme } = useApp();

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Visão Geral';
      case 'transactions':
        return 'Receitas e Despesas';
      case 'cards':
        return 'Cartões & Faturas';
      case 'recurring':
        return 'Recorrências';
      case 'budgets':
        return 'Orçamentos';
      case 'categories':
        return 'Categorias';
      case 'settings':
        return 'Configurações';
      default:
        return 'FinanFlow';
    }
  };

  const showMonthPicker = ['dashboard', 'transactions', 'cards', 'recurring', 'budgets'].includes(activeTab);

  return (
    <header className="top-header">
      <div className="top-header-row-primary">
        <div className="header-brand-and-title">
          <div className="mobile-brand-tag" title="FinanFlow">
            <div className="brand-logo-icon-sm">
              <TrendingUp size={15} />
            </div>
            <span className="brand-name-sm">FinanFlow</span>
          </div>
          <h1 className="page-title">{getPageTitle()}</h1>
        </div>

        <div className="header-quick-tools">
          <PWAInstallButton />

          <button
            onClick={toggleTheme}
            className="btn-icon header-theme-toggle"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user && onOpenProfileEdit && (
            <button
              onClick={onOpenProfileEdit}
              className="btn btn-secondary header-user-pill"
              title="Editar perfil e alterar senha"
              aria-label="Perfil do usuário"
            >
              <div className="header-user-avatar">
                {profile.display_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="header-user-name">
                {profile.display_name || user.displayName || 'Meu Perfil'}
              </span>
            </button>
          )}
        </div>
      </div>

      {(showMonthPicker || true) && (
        <div className="top-header-row-actions">
          {showMonthPicker && (
            <div className="header-month-picker-wrap">
              <MonthPicker />
            </div>
          )}

          <button
            onClick={onOpenNewTx}
            className="btn btn-primary header-new-tx-btn"
            title="Adicionar movimentação"
          >
            <PlusCircle size={16} />
            <span className="header-new-tx-text-desktop">Novo Lançamento</span>
            <span className="header-new-tx-text-mobile">Novo</span>
          </button>
        </div>
      )}
    </header>
  );
};

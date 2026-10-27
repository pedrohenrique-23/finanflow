import React from 'react';
import { PlusCircle, CreditCard, Moon, Sun, User } from 'lucide-react';
import { MonthPicker } from './MonthPicker';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: string;
  onOpenNewTx: () => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenNewTx, onOpenAuth }) => {
  const { user, theme, toggleTheme } = useApp();

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Visão Geral Financeira';
      case 'transactions':
        return 'Receitas e Despesas';
      case 'cards':
        return 'Cartões & Faturas';
      case 'recurring':
        return 'Lançamentos Recorrentes';
      case 'budgets':
        return 'Orçamentos Mensais';
      case 'categories':
        return 'Categorias';
      case 'settings':
        return 'Configurações do Sistema';
      default:
        return 'FinanFlow';
    }
  };

  const showMonthPicker = ['dashboard', 'transactions', 'cards', 'recurring', 'budgets'].includes(activeTab);

  return (
    <header className="top-header">
      <div className="page-title-group">
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {showMonthPicker && <MonthPicker />}

        <button onClick={onOpenNewTx} className="btn btn-primary" title="Adicionar movimentação">
          <PlusCircle size={16} />
          <span>Novo Lançamento</span>
        </button>

        <div className="mobile-only-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PWAInstallButton />
          <button
            onClick={toggleTheme}
            className="btn-icon"
            aria-label="Alternar tema"
            style={{ display: 'flex' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};

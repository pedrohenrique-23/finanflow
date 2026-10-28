import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Repeat,
  PieChart,
  Tag,
  Settings,
  TrendingUp,
  Moon,
  Sun,
  LogOut,
  User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onOpenAuth }) => {
  const { user, profile, theme, toggleTheme, logout, recurringOccurrences, selectedYearMonth } = useApp();

  // Pending recurring occurrences count for badge
  const pendingRecurringCount = recurringOccurrences.filter(
    (o) => o.year_month === selectedYearMonth && o.status === 'pending_confirmation'
  ).length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Receitas e Despesas', icon: ArrowLeftRight },
    { id: 'cards', label: 'Cartões & Faturas', icon: CreditCard },
    {
      id: 'recurring',
      label: 'Recorrências',
      icon: Repeat,
      badge: pendingRecurringCount > 0 ? String(pendingRecurringCount) : undefined,
    },
    { id: 'budgets', label: 'Orçamentos', icon: PieChart },
    { id: 'categories', label: 'Categorias', icon: Tag },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">
          <div className="brand-logo-icon">
            <TrendingUp size={18} />
          </div>
          <span>FinanFlow</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-link ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.25rem' }}>
          <PWAInstallButton />
          <button
            onClick={toggleTheme}
            className="btn-icon"
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {user ? (
          <div className="user-profile-widget">
            <div className="user-avatar">
              {profile.display_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-meta">
              <div className="user-name">{profile.display_name || user.displayName}</div>
              <div className="user-status">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="btn-icon"
              title="Sair da conta"
              aria-label="Sair"
              style={{ color: 'var(--color-expense)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button onClick={onOpenAuth} className="btn btn-secondary" style={{ width: '100%' }}>
            <User size={16} />
            <span>Entrar / Cadastrar</span>
          </button>
        )}
      </div>
    </aside>
  );
};

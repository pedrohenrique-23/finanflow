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
  LogOut,
  User,
  Edit3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth?: () => void;
  onOpenProfileEdit?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenProfileEdit,
}) => {
  const { user, profile, logout, recurringOccurrences, selectedYearMonth } = useApp();

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
        <div className="sidebar-footer-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0 0.25rem' }}>
          <PWAInstallButton />
        </div>

        {user ? (
          <div className="user-profile-widget">
            <div
              className="user-avatar"
              onClick={onOpenProfileEdit}
              style={{ cursor: onOpenProfileEdit ? 'pointer' : 'default' }}
              title="Clique para editar perfil e senha"
            >
              {profile.display_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div
              className="user-meta"
              onClick={onOpenProfileEdit}
              style={{ cursor: onOpenProfileEdit ? 'pointer' : 'default' }}
              title="Clique para editar perfil e senha"
            >
              <div className="user-name">{profile.display_name || user.displayName}</div>
              <div className="user-status">{user.email}</div>
            </div>
            {onOpenProfileEdit && (
              <button
                onClick={onOpenProfileEdit}
                className="btn-icon"
                title="Editar perfil e senha"
                aria-label="Editar perfil"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Edit3 size={15} />
              </button>
            )}
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

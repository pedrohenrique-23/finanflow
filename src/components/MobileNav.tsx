import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Repeat,
  PieChart,
  Settings,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab }) => {
  const { recurringOccurrences, selectedYearMonth } = useApp();

  const pendingRecurringCount = recurringOccurrences.filter(
    (o) => o.year_month === selectedYearMonth && o.status === 'pending_confirmation'
  ).length;

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'transactions', label: 'Extrato', icon: ArrowLeftRight },
    { id: 'cards', label: 'Cartões', icon: CreditCard },
    {
      id: 'recurring',
      label: 'Recorrentes',
      icon: Repeat,
      badge: pendingRecurringCount > 0,
    },
    { id: 'budgets', label: 'Orçamentos', icon: PieChart },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="mobile-nav-bar" aria-label="Navegação móvel principal">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={20} />
              {item.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-warning)',
                  }}
                />
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

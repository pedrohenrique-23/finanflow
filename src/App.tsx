/**
 * FinanFlow - Sistema de Controle Financeiro Pessoal
 * Componente Principal da Aplicação
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { CardsPage } from './pages/CardsPage';
import { RecurringPage } from './pages/RecurringPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionModal } from './components/TransactionModal';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthPage } from './pages/AuthPage';
import { Transaction } from './domain/types';

function MainApp() {
  const { user, isOnboarded } = useApp();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);

  // If user is logged out or not authenticated, protect all private financial data!
  if (!user) {
    return <AuthPage />;
  }

  const handleOpenNewTx = () => {
    setEditingTx(null);
    setIsTxModalOpen(true);
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setIsTxModalOpen(true);
  };

  // Render current tab view
  const renderCurrentPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onOpenNewTx={handleOpenNewTx} onNavigateTab={setActiveTab} />;
      case 'transactions':
        return <TransactionsPage onOpenNewTx={handleOpenNewTx} onEditTx={handleEditTx} />;
      case 'cards':
        return <CardsPage onNavigateTab={setActiveTab} />;
      case 'recurring':
        return <RecurringPage />;
      case 'budgets':
        return <BudgetsPage />;
      case 'categories':
        return <CategoriesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onOpenNewTx={handleOpenNewTx} onNavigateTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <Header
          activeTab={activeTab}
          onOpenNewTx={handleOpenNewTx}
        />

        <div className="page-body">
          {renderCurrentPage()}
        </div>
      </main>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Modals & Dialogs */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setEditingTx(null);
        }}
        transactionToEdit={editingTx}
      />

      {/* Onboarding Dialog for First-Time Users */}
      <OnboardingModal
        isOpen={!isOnboarded && !isOnboardingDismissed}
        onClose={() => setIsOnboardingDismissed(true)}
      />

      {/* PWA Offline Banner */}
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}

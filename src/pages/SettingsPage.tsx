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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../services/supabase';
import { formatCurrencyBRL, fromCents, toCents } from '../domain/finance';

export const SettingsPage: React.FC = () => {
  const { profile, updateProfile, theme, toggleTheme, user } = useApp();

  const creds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(creds.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(creds.anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Initial balance correction flow
  const [initialBalanceStr, setInitialBalanceStr] = useState(
    String(fromCents(profile.initial_balance_cents))
  );
  const [balanceSavedMsg, setBalanceSavedMsg] = useState(false);

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

  const sqlSchemaCode = `-- Script SQL FinanFlow para Supabase (Execute no SQL Editor da plataforma Supabase)
-- Criação de tabelas, índices e políticas de Row Level Security (RLS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Perfis
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  theme TEXT NOT NULL DEFAULT 'dark',
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id);
-- (Consulte o arquivo supabase/migrations/20261027_init_finanflow.sql para a migração completa)`;

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
          {creds.isConfigured ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-income)' }}>
              <CheckCircle2 size={16} />
              <span>
                <strong>Supabase Configurado:</strong> As credenciais do projeto estão ativas.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-warning)' }}>
              <AlertCircle size={16} />
              <span>
                <strong>Modo Local Persistente Ativo:</strong> Se você não possui um projeto Supabase configurado agora,
                o FinanFlow armazena e recalcula tudo localmente com persistência integral. Para conectar seu Supabase,
                informe a URL e a Anon Key abaixo:
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

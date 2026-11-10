import React, { useState, useEffect } from 'react';
import { User, Lock, Mail, Eye, EyeOff, CheckCircle2, AlertCircle, Save, X, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateUserCredentials, logout } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setDisplayName(profile.display_name || user.displayName || '');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, user, profile.display_name]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErrorMsg('Por favor, informe seu nome de exibição.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setErrorMsg('A nova senha deve possuir no mínimo 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('A confirmação da nova senha não confere com a senha digitada.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await updateUserCredentials({
        displayName: trimmedName,
        newPassword: newPassword || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Falha ao atualizar dados.');
      } else {
        setSuccessMsg(res.message || 'Dados atualizados com sucesso!');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao salvar alterações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} style={{ color: 'var(--brand-primary)' }} />
              <span>Editar Perfil & Senha</span>
            </h3>
            <span className="card-subtitle">
              Atualize seus dados pessoais e credenciais de acesso
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Fechar"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorMsg && (
              <div className="alert-banner danger" style={{ padding: '0.65rem 0.85rem' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="alert-banner info" style={{ padding: '0.65rem 0.85rem' }}>
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Read-only account email */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">E-mail Cadastrado</label>
              <div
                className="form-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  opacity: 0.8,
                  cursor: 'not-allowed',
                }}
              >
                <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                <span>{user.email}</span>
              </div>
            </div>

            {/* Display Name */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="profile-modal-name">
                Nome de Exibição
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="profile-modal-name"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Ex: Pedro Silva"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>

            {/* New Password Section */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.25rem' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Alteração de Senha (Opcional)
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" htmlFor="profile-modal-newpwd">
                  Nova Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-modal-newpwd"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                    placeholder="Mínimo 6 caracteres (deixe em branco para manter)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                  />
                  <Lock
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
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
                      padding: 0,
                    }}
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {newPassword.length > 0 && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="profile-modal-confirmpwd">
                    Confirmar Nova Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="profile-modal-confirmpwd"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingLeft: '2.25rem' }}
                      placeholder="Repita a nova senha para confirmação"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={newPassword.length > 0}
                    />
                    <Lock
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                onClose();
                await logout();
              }}
              disabled={isSubmitting}
              style={{ color: 'var(--color-expense)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              title="Encerrar sessão nesta conta"
            >
              <LogOut size={16} />
              <span>Deslogar</span>
            </button>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                <Save size={16} />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

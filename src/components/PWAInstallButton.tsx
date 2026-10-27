import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, do not render
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="btn btn-primary btn-sm"
        title="Instalar FinanFlow no celular ou desktop"
      >
        <Download size={15} />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="btn btn-secondary btn-sm"
          title="Instalar no iPhone / iPad"
        >
          <Smartphone size={15} />
          <span>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="modal-overlay" onClick={() => setShowIOSGuide(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Instalar FinanFlow no iOS</h3>
                <button
                  className="btn-icon"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  Para instalar no seu iPhone ou iPad pelo Safari:
                </p>
                <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--text-sm)' }}>
                  <li>Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta) na barra inferior do Safari.</li>
                  <li>Role a lista de ações para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</li>
                  <li>Confirme o nome <strong>FinanFlow</strong> e toque em <strong>Adicionar</strong> no canto superior direito.</li>
                </ol>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowIOSGuide(false)}>
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

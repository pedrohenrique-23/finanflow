import React, { useState } from 'react';
import {
  Tag,
  PlusCircle,
  Archive,
  Edit2,
  Check,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Category } from '../domain/types';

export const CategoriesPage: React.FC = () => {
  const { categories, addCategory, updateCategory, archiveCategory, transactions } = useApp();

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState('#10b981');
  const [errorMsg, setErrorMsg] = useState('');

  // Archiving modal state with replacement category
  const [archivingCategory, setArchivingCategory] = useState<Category | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState<string>('');

  const filteredCategories = categories.filter((c) => c.type === activeTab && !c.is_archived);

  const handleOpenNew = () => {
    setEditingCategory(null);
    setName('');
    setType(activeTab);
    setColor(activeTab === 'expense' ? '#ef4444' : '#10b981');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome da categoria.');
      return;
    }

    if (editingCategory) {
      await updateCategory({
        ...editingCategory,
        name: name.trim(),
        type,
        color,
      });
    } else {
      await addCategory({
        name: name.trim(),
        type,
        color,
        icon: 'Tag',
      });
    }
    setIsModalOpen(false);
  };

  const handleOpenArchive = (cat: Category) => {
    setArchivingCategory(cat);
    const candidates = categories.filter((c) => c.type === cat.type && c.id !== cat.id && !c.is_archived);
    setReplacementCategoryId(candidates[0]?.id || '');
  };

  const handleConfirmArchive = async () => {
    if (archivingCategory) {
      await archiveCategory(archivingCategory.id, replacementCategoryId || undefined);
      setArchivingCategory(null);
    }
  };

  return (
    <div className="categories-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Categorias Financeiras
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Organize despesas e receitas. Histórico preservado mesmo ao desativar uma categoria.
          </p>
        </div>

        <button onClick={handleOpenNew} className="btn btn-primary">
          <PlusCircle size={16} />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Tabs Switcher: Despesas vs Receitas */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('expense')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'expense' ? 'var(--color-expense-bg)' : 'var(--bg-surface-elevated)',
            color: activeTab === 'expense' ? 'var(--color-expense)' : 'var(--text-secondary)',
            borderColor: activeTab === 'expense' ? 'var(--color-expense)' : 'transparent',
            borderWidth: 1,
            borderStyle: 'solid',
            fontWeight: 700,
          }}
        >
          <ArrowDownLeft size={16} />
          <span>Categorias de Despesas</span>
        </button>

        <button
          onClick={() => setActiveTab('income')}
          className="btn"
          style={{
            backgroundColor: activeTab === 'income' ? 'var(--color-income-bg)' : 'var(--bg-surface-elevated)',
            color: activeTab === 'income' ? 'var(--color-income)' : 'var(--text-secondary)',
            borderColor: activeTab === 'income' ? 'var(--color-income)' : 'transparent',
            borderWidth: 1,
            borderStyle: 'solid',
            fontWeight: 700,
          }}
        >
          <ArrowUpRight size={16} />
          <span>Categorias de Receitas</span>
        </button>
      </div>

      {/* Categories Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {filteredCategories.map((cat) => {
          const usageCount = transactions.filter((t) => t.category_id === cat.id).length;

          return (
            <div key={cat.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: cat.color || 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  <Tag size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{cat.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {usageCount} lançamento{usageCount !== 1 ? 's' : ''} associado{usageCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button onClick={() => handleOpenEdit(cat)} className="btn-icon" title="Editar categoria" aria-label="Editar">
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleOpenArchive(cat)}
                  className="btn-icon"
                  title="Arquivar categoria"
                  aria-label="Arquivar"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Archive size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Criar ou Editar Categoria */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="cat-name">Nome da Categoria</label>
                <input
                  id="cat-name"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Assinaturas de Streaming, Cursos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cat-t">Tipo</label>
                <select
                  id="cat-t"
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cor de Identificação</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    '#ef4444',
                    '#f97316',
                    '#eab308',
                    '#10b981',
                    '#06b6d4',
                    '#3b82f6',
                    '#6366f1',
                    '#8b5cf6',
                    '#ec4899',
                    '#64748b',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: color === c ? '3px solid #ffffff' : 'none',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-footer" style={{ margin: '1rem -1.5rem -1.5rem -1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} />
                  <span>Salvar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Arquivar Categoria com Categoria Substituta */}
      {archivingCategory && (
        <div className="modal-overlay" onClick={() => setArchivingCategory(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-warning)' }}>
                Arquivar Categoria
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Deseja arquivar a categoria <strong>"{archivingCategory.name}"</strong>?
              </p>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                <ShieldCheck size={16} style={{ color: 'var(--brand-primary)', display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                <strong>Preservação de Histórico:</strong> Lançamentos já realizados não serão apagados.
                Você pode optar por manter a categoria histórica ou reatribuir para outra categoria ativa abaixo:
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="rep-cat">Substituir lançamentos existentes por:</label>
                <select
                  id="rep-cat"
                  className="form-select"
                  value={replacementCategoryId}
                  onChange={(e) => setReplacementCategoryId(e.target.value)}
                >
                  <option value="">Manter categoria histórica nos lançamentos antigos</option>
                  {categories
                    .filter((c) => c.type === archivingCategory.type && c.id !== archivingCategory.id && !c.is_archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setArchivingCategory(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirmArchive}>
                Confirmar Arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

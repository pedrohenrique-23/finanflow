import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { addMonthsToYearMonth } from '../domain/finance';
import { useApp } from '../context/AppContext';

export const MonthPicker: React.FC = () => {
  const { selectedYearMonth, setSelectedYearMonth } = useApp();

  const handlePrev = () => {
    setSelectedYearMonth(addMonthsToYearMonth(selectedYearMonth, -1));
  };

  const handleNext = () => {
    setSelectedYearMonth(addMonthsToYearMonth(selectedYearMonth, 1));
  };

  // Format month name in Portuguese (e.g. "Outubro 2026")
  const formattedLabel = React.useMemo(() => {
    const [yearStr, monthStr] = selectedYearMonth.split('-');
    const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${yearStr}`;
  }, [selectedYearMonth]);

  return (
    <div className="month-selector" aria-label="Navegação entre meses">
      <button
        onClick={handlePrev}
        className="month-btn"
        aria-label="Mês anterior"
        title="Mês anterior"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="month-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Calendar size={14} style={{ color: 'var(--brand-primary)' }} />
        {formattedLabel}
      </span>

      <button
        onClick={handleNext}
        className="month-btn"
        aria-label="Próximo mês"
        title="Próximo mês"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

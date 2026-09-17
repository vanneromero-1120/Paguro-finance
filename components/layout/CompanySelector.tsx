'use client';

import React, { useState } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { INITIAL_COMPANIES } from '@/lib/supabase/mock-store';

interface CompanySelectorProps {
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({
  activeCompanyId,
  onSelectCompany,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeCompany = INITIAL_COMPANIES.find((c) => c.id === activeCompanyId) || INITIAL_COMPANIES[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 12px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-white)',
          cursor: 'pointer',
          transition: 'var(--transition-smooth)',
        }}
      >
        <Building2 size={16} color="var(--color-primary)" />
        <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{activeCompany.trade_name}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{activeCompany.tax_id}</div>
        </div>
        <ChevronDown size={14} color="var(--text-muted)" style={{ marginLeft: '4px' }} />
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: '240px',
              backgroundColor: 'var(--bg-card-elevated)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 100,
              padding: '6px',
            }}
          >
            <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Unidades de Negocio
            </div>
            {INITIAL_COMPANIES.map((c) => {
              const isSelected = c.id === activeCompanyId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectCompany(c.id);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-main)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>{c.trade_name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{c.tax_id}</div>
                  </div>
                  {isSelected && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

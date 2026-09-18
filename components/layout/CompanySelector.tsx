'use client';

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Company } from '@/types/database';
import { getAuthorizedCompaniesAction, switchActiveCompanyAction } from '@/lib/actions/dashboard';

interface CompanySelectorProps {
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
}

export const CompanySelector: React.FC<CompanySelectorProps> = ({
  activeCompanyId,
  onSelectCompany,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadCompanies() {
      try {
        const res = await getAuthorizedCompaniesAction();
        if (mounted && res.success && res.data) {
          const list = res.data.map((m) => m.company);
          setCompanies(list);
        }
      } catch (err) {
        console.error('Error fetching authorized companies:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCompanies();
    return () => {
      mounted = false;
    };
  }, []);

  // Authoritative fallback for active company
  const activeCompany =
    companies.find((c) => c.id === activeCompanyId) ||
    companies[0] || {
      id: activeCompanyId,
      trade_name: 'Paguro Corp',
      legal_name: 'Paguro Corp S.A.S.',
      tax_id: '901.458.120-1',
      country_code: 'COL',
      currency_code: 'COP',
      timezone: 'America/Bogota',
      is_active: true,
      created_at: '',
      updated_at: '',
    };

  const handleSelect = async (companyId: string) => {
    if (companyId === activeCompanyId) {
      setIsOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await switchActiveCompanyAction(companyId);
      if (res.success) {
        onSelectCompany(companyId);
        setIsOpen(false);
        // Refresh page to load context for new company
        window.location.reload();
      } else {
        alert(res.error || 'Error al cambiar de empresa');
      }
    } catch (err: any) {
      alert(err.message || 'Error al cambiar de empresa');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '7px 12px',
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-white)',
          cursor: switching ? 'wait' : 'pointer',
          transition: 'var(--transition-smooth)',
        }}
      >
        {switching ? (
          <Loader2 size={16} className="animate-spin" color="var(--color-primary)" />
        ) : (
          <Building2 size={16} color="var(--color-primary)" />
        )}
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
            <div
              style={{
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
              }}
            >
              Unidades de Negocio Autorizadas
            </div>
            {loading ? (
              <div style={{ padding: '12px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Cargando empresas...
              </div>
            ) : companies.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {activeCompany.trade_name}
              </div>
            ) : (
              companies.map((c) => {
                const isSelected = c.id === activeCompanyId;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
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
                      <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>
                        {c.trade_name || c.legal_name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{c.tax_id}</div>
                    </div>
                    {isSelected && <Check size={16} />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};


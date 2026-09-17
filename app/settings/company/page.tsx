'use client';

import React, { useState } from 'react';
import { Building2, Plus, Globe, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_COMPANIES } from '@/lib/supabase/mock-store';
import { Company } from '@/types/database';

export default function CompaniesSettingsPage() {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [currencyCode, setCurrencyCode] = useState('COP');

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName || !taxId) return;

    const newCompany: Company = {
      id: `comp-${Date.now()}`,
      legal_name: legalName,
      trade_name: tradeName || legalName,
      tax_id: taxId,
      country_code: 'COL',
      currency_code: currencyCode,
      timezone: 'America/Bogota',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCompanies([...companies, newCompany]);
    setIsModalOpen(false);
    setLegalName('');
    setTradeName('');
    setTaxId('');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Unidades de Negocio & Empresas
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Configuración de entidades legales y operativas dentro del ecosistema Paguro Corp.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsModalOpen(true)}
        >
          Nueva Empresa
        </Button>
      </div>

      {/* Companies Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {companies.map((c) => (
          <div key={c.id} className="card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)' }}>
                    {c.trade_name}
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{c.legal_name}</div>
                </div>
              </div>

              <Badge status={c.is_active ? 'active' : 'inactive'} />
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Identificación Fiscal:</span>
                <span className="num-mono" style={{ fontWeight: 600 }}>{c.tax_id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Moneda Operativa:</span>
                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{c.currency_code}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Zona Horaria:</span>
                <span style={{ color: 'var(--text-dim)' }}>{c.timezone}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Company */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Crear Nueva Unidad de Negocio"
      >
        <form onSubmit={handleCreateCompany}>
          <div className="form-group">
            <label className="form-label">Nombre Comercial *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Pagureo"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Razón Social Completa *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Pagureo E-Commerce S.A.S."
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">NIT / Número Tributario *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. 901.890.334-5"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Moneda Operativa Base</label>
              <select
                className="form-select"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                <option value="COP">COP - Peso Colombiano</option>
                <option value="USD">USD - Dólar Americano</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Empresa
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

// ============================================================================
// Paguro Finance - Company Settings Module
// Real Supabase data, authorized company context, RBAC enforcement & audit trail
// Zero mock-store dependencies
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Edit3,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Company, UpdateCompanyInput } from '@/types/database';
import { getCompanyDetailsAction, updateCompanyAction } from '@/lib/actions/company';

export default function CompaniesSettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<UpdateCompanyInput>({
    legal_name: '',
    trade_name: '',
    tax_id: '',
    country_code: 'COL',
    currency_code: 'COP',
    timezone: 'America/Bogota',
    email: '',
    phone: '',
    address: '',
    city: '',
  });

  const loadCompanyData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getCompanyDetailsAction();
      if (res.success && res.data) {
        setCompany(res.data);
        setFormData({
          legal_name: res.data.legal_name || '',
          trade_name: res.data.trade_name || '',
          tax_id: res.data.tax_id || '',
          country_code: res.data.country_code || 'COL',
          currency_code: res.data.currency_code || 'COP',
          timezone: res.data.timezone || 'America/Bogota',
          email: res.data.email || '',
          phone: res.data.phone || '',
          address: res.data.address || '',
          city: res.data.city || '',
        });
      } else {
        setErrorMessage(res.error || 'No fue posible cargar la información de la empresa.');
      }
    } catch (err: any) {
      console.error('[CompanySettings] Load error:', err);
      setErrorMessage(err?.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  const handleOpenEdit = () => {
    if (!company) return;
    setFormData({
      legal_name: company.legal_name || '',
      trade_name: company.trade_name || '',
      tax_id: company.tax_id || '',
      country_code: company.country_code || 'COL',
      currency_code: company.currency_code || 'COP',
      timezone: company.timezone || 'America/Bogota',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      city: company.city || '',
    });
    setErrorMessage(null);
    setIsEditModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateCompanyAction(formData);
      if (res.success && res.data) {
        setCompany(res.data);
        setSuccessMessage('Configuración de la empresa actualizada y registrada en la bitácora de auditoría.');
        setIsEditModalOpen(false);
      } else {
        setErrorMessage(res.error || 'No se pudo actualizar la configuración.');
      }
    } catch (err: any) {
      console.error('[CompanySettings] Save error:', err);
      setErrorMessage(err?.message || 'Error inesperado al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Configuración de la Empresa
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Información fiscal, domicilio corporativo y parámetros operacionales de la empresa activa.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={loadCompanyData}
            disabled={loading}
          >
            Refrescar
          </Button>
          {company && (
            <Button
              variant="primary"
              icon={<Edit3 size={16} />}
              onClick={handleOpenEdit}
              disabled={loading}
            >
              Editar Información
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: 'var(--color-success)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: 'var(--color-danger)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !company && (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px' }}>Cargando perfil corporativo desde Supabase...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !company && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Building2 size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
            No se encontró la empresa activa
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
            Asegúrese de contar con una membresía activa en el sistema para visualizar la entidad corporativa.
          </p>
        </div>
      )}

      {/* Company Profile Details Card */}
      {company && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
          {/* Main Fiscal Identity Card */}
          <div className="card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                  }}
                >
                  <Building2 size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-white)' }}>
                    {company.trade_name || company.legal_name}
                  </h2>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{company.legal_name}</div>
                </div>
              </div>

              <Badge status={company.is_active ? 'active' : 'inactive'} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> NIT / Identificación Fiscal:
                </span>
                <span className="num-mono" style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  {company.tax_id}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={14} /> Moneda Operativa:
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '11px', fontWeight: 600 }}>
                  {company.currency_code}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Zona Horaria Oficial:
                </span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                  {company.timezone}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={14} /> País Jurisdiccional:
                </span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                  {company.country_code === 'COL' ? 'Colombia (COL)' : company.country_code}
                </span>
              </div>
            </div>
          </div>

          {/* Contact and Corporate Address Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-success)',
                }}
              >
                <MapPin size={20} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)' }}>
                Contacto & Sede Corporativa
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={14} /> Correo Electrónico:
                </span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                  {company.email || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No registrado</span>}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} /> Teléfono PBX:
                </span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                  {company.phone || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No registrado</span>}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={14} /> Ciudad:
                </span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                  {company.city || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No registrado</span>}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> Dirección Principal:
                </span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500, textAlign: 'right', maxWidth: '240px' }}>
                  {company.address || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No registrada</span>}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security & Audit Compliance Footer Banner */}
      <div
        className="card"
        style={{
          marginTop: '24px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <ShieldCheck size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-white)' }}>Protección de Integridad Corporativa: </strong>
          Cualquier cambio a la razón social, identificación fiscal o parámetros de la empresa requiere rol de Administrador o Super Administrador y genera una entrada criptográfica inmutable en la bitácora de auditoría del sistema.
        </div>
      </div>

      {/* Modal: Edit Company Information */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !saving && setIsEditModalOpen(false)}
        title="Editar Información Corporativa"
      >
        <form onSubmit={handleSaveCompany}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Nombre Comercial *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. Paguro Corp"
                value={formData.trade_name || ''}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Razón Social Legal *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. Paguro Corp S.A.S."
                value={formData.legal_name || ''}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">NIT / Identificación Fiscal *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. 901.458.120-1"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda Operativa Base</label>
              <select
                className="form-select"
                value={formData.currency_code || 'COP'}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
              >
                <option value="COP">COP - Peso Colombiano</option>
                <option value="USD">USD - Dólar Americano</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Correo Corporativo</label>
              <input
                type="email"
                className="form-input"
                placeholder="contacto@pagurocorp.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono PBX</label>
              <input
                type="text"
                className="form-input"
                placeholder="+57 601 555 0100"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Dirección Fiscal / Sede</label>
              <input
                type="text"
                className="form-input"
                placeholder="Carrera 7 # 71-21 Torre A"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input
                type="text"
                className="form-input"
                placeholder="Bogotá D.C."
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Zona Horaria</label>
            <input
              type="text"
              className="form-input"
              value={formData.timezone || 'America/Bogota'}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving}
              icon={saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            >
              {saving ? 'Guardando Cambios...' : 'Guardar y Registrar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

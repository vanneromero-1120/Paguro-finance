'use client';

// ============================================================================
// Paguro Finance V1 - Unified Settings & Company Tax Profile Hub
// Multi-company isolated, Role enforcement, Company Tax Profile & Audit Access
// ============================================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  Building2,
  Users,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  getCompanyTaxProfileAction,
  updateCompanyTaxProfileAction,
} from '@/lib/actions/tax-operations';
import { CompanyTaxProfile } from '@/types/v1-financial';

export default function SettingsHubPage() {
  const [taxProfile, setTaxProfile] = useState<CompanyTaxProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompanyTaxProfileAction().then((res) => {
      if (res.success && res.data) setTaxProfile(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Configuración del Sistema</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Gestión de empresa, perfil fiscal DIAN, usuarios autorizados y bitácora de auditoría
        </p>
      </div>

      {/* 3 Main Settings Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <Link href="/settings/company" className="card" style={{ transition: 'var(--transition-smooth)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'var(--paguro-blue-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--paguro-blue)',
                flexShrink: 0,
              }}
            >
              <Building2 size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
                  Datos Empresariales
                </h3>
                <ArrowRight size={14} color="var(--text-dim)" />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Razón social, NIT, moneda, zona horaria y datos de contacto oficiales.
              </p>
            </div>
          </div>
        </Link>

        <Link href="/settings/users" className="card" style={{ transition: 'var(--transition-smooth)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(231, 33, 117, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--paguro-pink)',
                flexShrink: 0,
              }}
            >
              <Users size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
                  Usuarios & Roles
                </h3>
                <ArrowRight size={14} color="var(--text-dim)" />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Control de acceso RBAC de 6 niveles, permisos por empresa e invitaciones.
              </p>
            </div>
          </div>
        </Link>

        <Link href="/settings/audit" className="card" style={{ transition: 'var(--transition-smooth)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-success)',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
                  Bitácora de Auditoría
                </h3>
                <ArrowRight size={14} color="var(--text-dim)" />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Registro criptográfico inmutable de cambios en movimientos, impuestos y accesos.
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* COMPANY TAX PROFILE SECTION */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Perfil Fiscal & Tributario (Colombia)</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Parámetros de liquidación estimada para IVA, ICA y Retenciones
            </p>
          </div>
          <Link href="/taxes" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            <span>Ir a Operaciones Tributarias</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', fontSize: '13px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Régimen Tributario</span>
            <div style={{ fontWeight: 600, color: 'var(--text-white)', marginTop: '4px' }}>
              {taxProfile?.tax_regime || 'RESPONSABLE_DE_IVA'}
            </div>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Municipio ICA</span>
            <div style={{ fontWeight: 600, color: 'var(--text-white)', marginTop: '4px' }}>
              {taxProfile?.municipality || 'Medellín'} ({(Number(taxProfile?.ica_configuration?.rate || 0.007) * 1000).toFixed(1)} x 1.000)
            </div>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Responsable de IVA</span>
            <div style={{ fontWeight: 600, color: taxProfile?.iva_responsible ? 'var(--color-success)' : 'var(--text-muted)', marginTop: '4px' }}>
              {taxProfile?.iva_responsible ? 'SÍ (Tarifa general 19%)' : 'NO'}
            </div>
          </div>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Año Fiscal Activo</span>
            <div className="num-mono" style={{ fontWeight: 600, color: 'var(--text-white)', marginTop: '4px' }}>
              {taxProfile?.fiscal_year || 2026}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Responsabilidades Registradas en RUT:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(taxProfile?.rut_responsibilities || []).map((r, idx) => (
              <span key={idx} className="badge badge-neutral" style={{ fontSize: '11px' }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

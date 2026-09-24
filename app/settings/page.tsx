'use client';

// ============================================================================
// Paguro Finance V1 - Unified Settings, Movement Categories & Tax Profile Hub
// Multi-company isolated, Role enforcement, Category CRUD & Audit Access
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
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
  Plus,
  Edit2,
  Trash2,
  Tags,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  getCompanyTaxProfileAction,
  updateCompanyTaxProfileAction,
} from '@/lib/actions/tax-operations';
import {
  getMovementCategoriesAction,
  createMovementCategoryAction,
  updateMovementCategoryAction,
  deactivateMovementCategoryAction,
  CategoryInput,
} from '@/lib/actions/movements';
import { CompanyTaxProfile, MovementCategory } from '@/types/v1-financial';

export default function SettingsHubPage() {
  const [taxProfile, setTaxProfile] = useState<CompanyTaxProfile | null>(null);
  const [categories, setCategories] = useState<MovementCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MovementCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryInput>({
    name: '',
    code: '',
    direction: 'EXPENSE',
    default_tax_relevance: 'TAXABLE',
    color: '#0098FF',
    description: '',
  });
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Tax Profile Modal state
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [taxForm, setTaxForm] = useState({
    tax_regime: 'RESPONSABLE_DE_IVA',
    municipality: 'Medellín',
    iva_responsible: true,
    ica_rate: 7, // x 1.000
    fiscal_year: 2026,
  });
  const [savingTax, setSavingTax] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [taxRes, catRes] = await Promise.all([
      getCompanyTaxProfileAction(),
      getMovementCategoriesAction(false),
    ]);

    if (taxRes.success && taxRes.data) {
      setTaxProfile(taxRes.data);
      setTaxForm({
        tax_regime: taxRes.data.tax_regime,
        municipality: taxRes.data.municipality,
        iva_responsible: taxRes.data.iva_responsible,
        ica_rate: (Number(taxRes.data.ica_configuration?.rate || 0.007) * 1000),
        fiscal_year: taxRes.data.fiscal_year,
      });
    }

    if (catRes.success && catRes.data) {
      setCategories(catRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal to add category
  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      code: '',
      direction: 'EXPENSE',
      default_tax_relevance: 'TAXABLE',
      color: '#0098FF',
      description: '',
    });
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  // Open modal to edit category
  const handleOpenEditCategory = (cat: MovementCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      code: cat.code || '',
      direction: cat.direction,
      default_tax_relevance: cat.default_tax_relevance,
      color: cat.color || '#0098FF',
      description: cat.description || '',
    });
    setCategoryError(null);
    setIsCategoryModalOpen(true);
  };

  // Save category (create or update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryError('El nombre de la categoría es obligatorio.');
      return;
    }

    setSavingCategory(true);
    setCategoryError(null);

    let res;
    if (editingCategory) {
      res = await updateMovementCategoryAction(editingCategory.id, categoryForm);
    } else {
      res = await createMovementCategoryAction(categoryForm);
    }

    if (res.success) {
      setIsCategoryModalOpen(false);
      await loadData();
    } else {
      setCategoryError(res.error || 'Error al guardar categoría');
    }
    setSavingCategory(false);
  };

  // Deactivate category
  const handleDeactivateCategory = async (cat: MovementCategory) => {
    if (!confirm(`¿Desactivar la categoría "${cat.name}"? Los movimientos históricos conservarán esta categoría para fines de auditoría.`)) {
      return;
    }
    const res = await deactivateMovementCategoryAction(cat.id);
    if (res.success) {
      await loadData();
    } else {
      alert(res.error || 'Error al desactivar categoría');
    }
  };

  // Save Tax Profile
  const handleSaveTaxProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTax(true);

    const res = await updateCompanyTaxProfileAction({
      tax_regime: taxForm.tax_regime,
      municipality: taxForm.municipality,
      iva_responsible: taxForm.iva_responsible,
      fiscal_year: Number(taxForm.fiscal_year),
      ica_configuration: {
        municipality: taxForm.municipality,
        rate: Number(taxForm.ica_rate) / 1000,
        activity_code: taxProfile?.ica_configuration?.activity_code || '6201',
      },
    });

    if (res.success) {
      setIsTaxModalOpen(false);
      await loadData();
    } else {
      alert(res.error || 'Error actualizando perfil tributario');
    }
    setSavingTax(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header */}
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Configuración del Sistema</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
          Gestión de empresa, categorías financieras, perfil fiscal DIAN y auditoría
        </p>
      </div>

      {/* 3 Main Settings Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
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
                Control de acceso RBAC de 5 niveles, permisos por empresa e invitaciones.
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

      {/* CATEGORIES MANAGEMENT SECTION */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tags size={18} color="var(--paguro-blue)" />
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Categorías de Movimientos Financieros</h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Árbol de clasificación contable para ingresos, egresos y relevancia fiscal
            </p>
          </div>
          <Button variant="primary" onClick={handleOpenNewCategory} style={{ fontSize: '12px', padding: '6px 14px' }}>
            <Plus size={14} />
            <span>Nueva Categoría</span>
          </Button>
        </div>

        <div className="table-container">
          <table className="table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Código</th>
                <th>Flujo</th>
                <th>Relevancia Fiscal</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                    Cargando categorías...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>
                    No hay categorías activas configuradas.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: cat.color || 'var(--paguro-blue)',
                          }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{cat.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {cat.code || '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          cat.direction === 'INCOME'
                            ? 'badge-success'
                            : cat.direction === 'EXPENSE'
                            ? 'badge-danger'
                            : 'badge-brand-blue'
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {cat.direction === 'INCOME' ? 'Ingreso' : cat.direction === 'EXPENSE' ? 'Egreso' : 'Ambos'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          cat.default_tax_relevance === 'TAXABLE' ? 'badge-brand-pink' : 'badge-neutral'
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {cat.default_tax_relevance}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {cat.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          title="Editar categoría"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeactivateCategory(cat)}
                          title="Desactivar categoría (conserva histórico)"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            backgroundColor: 'transparent',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPANY TAX PROFILE SECTION */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Landmark size={18} color="var(--paguro-pink)" />
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Perfil Fiscal & Tributario (Colombia)</h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
              Parámetros de liquidación estimada para IVA, ICA y Retenciones
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              onClick={() => setIsTaxModalOpen(true)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Sliders size={13} />
              <span>Modificar Perfil</span>
            </Button>
            <Link href="/taxes" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <span>Ir a Operaciones</span>
              <ArrowRight size={13} />
            </Link>
          </div>
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

      {/* CATEGORY MODAL */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría de Movimiento'}
      >
        <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {categoryError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-danger)',
                fontSize: '12px',
              }}
            >
              <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
              {categoryError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nombre de la Categoría</label>
            <input
              type="text"
              className="form-input"
              required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder="Ej: Software & Subscripciones"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Dirección del Flujo</label>
              <select
                className="form-select"
                value={categoryForm.direction}
                onChange={(e) => setCategoryForm({ ...categoryForm, direction: e.target.value as any })}
              >
                <option value="EXPENSE">Egreso / Gasto (-)</option>
                <option value="INCOME">Ingreso / Venta (+)</option>
                <option value="BOTH">Ambos Flujos</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Relevancia Fiscal DIAN</label>
              <select
                className="form-select"
                value={categoryForm.default_tax_relevance}
                onChange={(e) => setCategoryForm({ ...categoryForm, default_tax_relevance: e.target.value as any })}
              >
                <option value="TAXABLE">Gravable (IVA / Renta)</option>
                <option value="EXEMPT">Exento (Tarifa 0%)</option>
                <option value="EXCLUDED">Excluido</option>
                <option value="NON_TAXABLE">No Gravable</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Código Contable (Opcional)</label>
              <input
                type="text"
                className="form-input"
                value={categoryForm.code || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                placeholder="Ej: 5135"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Color Distintivo</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={categoryForm.color || '#0098FF'}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  style={{ width: '38px', height: '38px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={categoryForm.color || '#0098FF'}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              type="text"
              className="form-input"
              value={categoryForm.description || ''}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              placeholder="Detalle o criterio contable de esta categoría"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)} disabled={savingCategory}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={savingCategory}>
              {savingCategory ? 'Guardando...' : editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* TAX PROFILE MODAL */}
      <Modal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        title="Modificar Perfil Fiscal & Tributario"
      >
        <form onSubmit={handleSaveTaxProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Régimen Tributario</label>
            <select
              className="form-select"
              value={taxForm.tax_regime}
              onChange={(e) => setTaxForm({ ...taxForm, tax_regime: e.target.value })}
            >
              <option value="RESPONSABLE_DE_IVA">Responsable de IVA (Común)</option>
              <option value="NO_RESPONSABLE_DE_IVA">No Responsable de IVA</option>
              <option value="REGIMEN_SIMPLE">Régimen Simple de Tributación (RST)</option>
              <option value="GRAN_CONTRIBUYENTE">Gran Contribuyente</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Municipio ICA</label>
              <input
                type="text"
                className="form-input"
                required
                value={taxForm.municipality}
                onChange={(e) => setTaxForm({ ...taxForm, municipality: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tarifa ICA (por 1.000)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                required
                value={taxForm.ica_rate}
                onChange={(e) => setTaxForm({ ...taxForm, ica_rate: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Año Fiscal</label>
              <input
                type="number"
                className="form-input"
                required
                value={taxForm.fiscal_year}
                onChange={(e) => setTaxForm({ ...taxForm, fiscal_year: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Responsabilidad de IVA</label>
              <select
                className="form-select"
                value={taxForm.iva_responsible ? 'true' : 'false'}
                onChange={(e) => setTaxForm({ ...taxForm, iva_responsible: e.target.value === 'true' })}
              >
                <option value="true">Sí (Tarifa General 19%)</option>
                <option value="false">No Sujeto</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsTaxModalOpen(false)} disabled={savingTax}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={savingTax}>
              {savingTax ? 'Guardando...' : 'Guardar Perfil'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

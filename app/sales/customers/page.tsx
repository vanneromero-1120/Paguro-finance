'use client';

// ============================================================================
// Paguro Finance - Customer Directory (Supabase-backed Master Data)
// Multi-company isolated, RLS-enforced, audit-logged
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Eye,
  Archive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  getCustomersAction,
  createCustomerAction,
  updateCustomerAction,
  toggleCustomerStatusAction,
} from '@/lib/actions/customers';

const IDENTIFICATION_TYPES = [
  { value: 'NIT', label: 'NIT (Colombia - Número de Identificación Tributaria)' },
  { value: 'CC', label: 'Cédula de Ciudadanía (CC)' },
  { value: 'CE', label: 'Cédula de Extranjería (CE)' },
  { value: 'PASSPORT', label: 'Pasaporte (Internacional)' },
  { value: 'RUT', label: 'RUT' },
  { value: 'VAT_ID', label: 'Tax ID / VAT ID (Extranjero)' },
  { value: 'OTHER', label: 'Otro Documento de Identificación' },
];

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Current user authorization
  const [userRole, setUserRole] = useState<string | null>(null);
  const canWrite = userRole ? WRITE_ROLES.includes(userRole) : false;

  // Form inputs
  const [formData, setFormData] = useState<CreateCustomerInput>({
    name: '',
    legal_name: '',
    identification_type: 'NIT',
    tax_id: '',
    email: '',
    phone: '',
    billing_address: '',
    city: 'Bogotá',
    country: 'Colombia',
    payment_terms_days: 30,
    notes: '',
    status: 'active',
  });

  // Resolve user role
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: membership } = await supabase
        .from('company_users')
        .select('role')
        .eq('user_id', user.id)
        .in('status', ['active', 'ACTIVE'])
        .single();
      if (membership) {
        setUserRole(membership.role);
      }
    });
  }, []);

  // Fetch customers from live server action
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await getCustomersAction(searchTerm, statusFilter);
      if (res.success && res.data) {
        setCustomers(res.data);
      } else {
        setFeedback({ type: 'error', message: res.error || 'No se pudieron cargar los clientes.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const resetForm = () => {
    setFormData({
      name: '',
      legal_name: '',
      identification_type: 'NIT',
      tax_id: '',
      email: '',
      phone: '',
      billing_address: '',
      city: 'Bogotá',
      country: 'Colombia',
      payment_terms_days: 30,
      notes: '',
      status: 'active',
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await createCustomerAction(formData);
      if (res.success && res.data) {
        setFeedback({ type: 'success', message: 'Cliente registrado exitosamente.' });
        setIsCreateOpen(false);
        resetForm();
        loadCustomers();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al crear cliente.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      legal_name: customer.legal_name || '',
      identification_type: customer.identification_type,
      tax_id: customer.tax_id,
      email: customer.email || '',
      phone: customer.phone || '',
      billing_address: customer.billing_address || '',
      city: customer.city || '',
      country: customer.country,
      payment_terms_days: customer.payment_terms_days,
      notes: customer.notes || '',
      status: customer.status,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await updateCustomerAction(editingCustomer.id, formData);
      if (res.success && res.data) {
        setFeedback({ type: 'success', message: 'Cliente actualizado exitosamente.' });
        setEditingCustomer(null);
        resetForm();
        loadCustomers();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al actualizar cliente.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    const nextStatus = customer.status === 'active' ? 'inactive' : 'active';
    const actionLabel = nextStatus === 'inactive' ? 'desactivar' : 'activar';
    if (!confirm(`¿Está seguro de que desea ${actionLabel} el cliente ${customer.name}?`)) {
      return;
    }

    try {
      const res = await toggleCustomerStatusAction(customer.id, nextStatus);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Estado actualizado.' });
        loadCustomers();
      } else {
        setFeedback({ type: 'error', message: res.error || 'No se pudo actualizar el estado.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al cambiar estado.' });
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Directorio de Clientes
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Base de datos corporativa de clientes, condiciones de crédito y facturación.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={() => loadCustomers()}
            title="Recargar datos"
          >
            Actualizar
          </Button>
          {canWrite && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
            >
              Nuevo Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Role Alert for Read-only Users */}
      {userRole && !canWrite && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            color: 'var(--accent-blue)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <ShieldAlert size={16} />
          <span>Modo Solo Lectura (Rol: {userRole}). Los permisos de creación y edición están reservados para Administradores y Finanzas.</span>
        </div>
      )}

      {/* Notifications / Feedback */}
      {feedback && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: feedback.type === 'success' ? 'var(--color-success)' : 'var(--accent-red)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', maxWidth: '420px', position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Buscar por razón social, NIT, email o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Filter Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: '8px',
            padding: '3px',
          }}
        >
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: statusFilter === filter ? 'var(--color-primary)' : 'transparent',
                color: statusFilter === filter ? '#fff' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {filter === 'all' ? 'Todos' : filter === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Empty State / Loading */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando directorio de clientes desde Supabase...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              marginBottom: '16px',
            }}
          >
            <Users size={28} />
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
            {searchTerm || statusFilter !== 'all' ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px' }}>
            {searchTerm || statusFilter !== 'all'
              ? 'Intente modificar los términos de búsqueda o el filtro de estado.'
              : 'La base de datos de producción se encuentra limpia. Registre su primer cliente corporativo para iniciar la emisión de facturas y gestión de cartera.'}
          </p>
          {canWrite && !searchTerm && statusFilter === 'all' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
            >
              Crear Primer Cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente / Razón Social</th>
                <th>Identificación</th>
                <th>Contacto</th>
                <th>Ubicación</th>
                <th>Plazo Pago</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{c.name}</div>
                    {c.legal_name && c.legal_name !== c.name && (
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{c.legal_name}</div>
                    )}
                  </td>
                  <td>
                    <div className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                      {c.tax_id}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                      {c.identification_type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                      {c.email ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                          <Mail size={12} /> {c.email}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Sin email</span>
                      )}
                      {c.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)' }}>
                          <Phone size={12} /> {c.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <MapPin size={12} /> {c.city ? `${c.city}, ${c.country}` : c.country}
                    </span>
                  </td>
                  <td>
                    <span className="num-mono" style={{ fontSize: '13px' }}>
                      {c.payment_terms_days} días
                    </span>
                  </td>
                  <td>
                    <Badge status={c.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        onClick={() => setViewingCustomer(c)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                        title="Ver detalles"
                      >
                        <Eye size={13} />
                      </button>
                      {canWrite && (
                        <>
                          <button
                            onClick={() => handleEditOpen(c)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                            }}
                            title="Editar cliente"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(c)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              padding: '5px 8px',
                              color: c.status === 'active' ? '#f87171' : 'var(--color-success)',
                              cursor: 'pointer',
                            }}
                            title={c.status === 'active' ? 'Desactivar cliente' : 'Activar cliente'}
                          >
                            <Archive size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Customer */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Nuevo Cliente Corporativo"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre Comercial / Nombre de Fantasía *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Almacenes Éxito"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Razón Social Legal (si aplica)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Almacenes Éxito S.A."
              value={formData.legal_name || ''}
              onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Identificación *</label>
              <select
                className="form-input"
                value={formData.identification_type}
                onChange={(e) => setFormData({ ...formData, identification_type: e.target.value })}
              >
                {IDENTIFICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Número de Identificación (NIT / Doc) *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. 890.900.608-9"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico de Facturación</label>
              <input
                type="email"
                className="form-input"
                placeholder="facturacion@cliente.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono de Contacto</label>
              <input
                type="text"
                className="form-input"
                placeholder="+57 (601) 316-0000"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Dirección Fiscal / Despacho</label>
              <input
                type="text"
                className="form-input"
                placeholder="Carrera 48 # 32B Sur - 139"
                value={formData.billing_address || ''}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input
                type="text"
                className="form-input"
                placeholder="Bogotá"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">País</label>
              <input
                type="text"
                className="form-input"
                value={formData.country || 'Colombia'}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Plazo de Pago (Días)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formData.payment_terms_days ?? 30}
                onChange={(e) => setFormData({ ...formData, payment_terms_days: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas Internas / Observaciones</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Condiciones comerciales especiales, persona de contacto, etc."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Guardar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Customer */}
      <Modal
        isOpen={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        title={`Editar Cliente: ${editingCustomer?.name || ''}`}
      >
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre Comercial *</label>
            <input
              type="text"
              required
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Razón Social Legal</label>
            <input
              type="text"
              className="form-input"
              value={formData.legal_name || ''}
              onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Identificación *</label>
              <select
                className="form-input"
                value={formData.identification_type}
                onChange={(e) => setFormData({ ...formData, identification_type: e.target.value })}
              >
                {IDENTIFICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">NIT / Número de Identificación *</label>
              <input
                type="text"
                required
                className="form-input"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                className="form-input"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Dirección Fiscal</label>
              <input
                type="text"
                className="form-input"
                value={formData.billing_address || ''}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input
                type="text"
                className="form-input"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Plazo de Pago (Días)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={formData.payment_terms_days ?? 30}
                onChange={(e) => setFormData({ ...formData, payment_terms_days: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select
                className="form-input"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setEditingCustomer(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Actualizar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Details */}
      <Modal
        isOpen={!!viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        title="Ficha Técnica del Cliente"
      >
        {viewingCustomer && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>{viewingCustomer.name}</h3>
                {viewingCustomer.legal_name && viewingCustomer.legal_name !== viewingCustomer.name && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{viewingCustomer.legal_name}</p>
                )}
              </div>
              <Badge status={viewingCustomer.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Identificación Tributaria</span>
                <span className="num-mono" style={{ fontWeight: 600 }}>{viewingCustomer.tax_id}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>({viewingCustomer.identification_type})</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Condición de Pago</span>
                <span>{viewingCustomer.payment_terms_days} días de crédito</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Correo de Contacto</span>
                <span>{viewingCustomer.email || 'No registrado'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Teléfono</span>
                <span>{viewingCustomer.phone || 'No registrado'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Ciudad / País</span>
                <span>{viewingCustomer.city || '-'}, {viewingCustomer.country}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block' }}>Dirección Fiscal</span>
                <span>{viewingCustomer.billing_address || 'No registrada'}</span>
              </div>
            </div>

            {viewingCustomer.notes && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Observaciones</span>
                <p style={{ color: 'var(--text-muted)' }}>{viewingCustomer.notes}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => setViewingCustomer(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

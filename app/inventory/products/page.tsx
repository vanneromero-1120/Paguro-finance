'use client';

// ============================================================================
// Paguro Finance - Products & Services Catalog (Supabase-backed Master Data)
// Multi-company isolated, RLS-enforced, stock-aware, audit-logged
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Archive,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  TrendingUp,
  Layers,
  Truck,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  ProductWithStock,
  CreateProductInput,
  UpdateProductInput,
  TaxRate,
  Supplier,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  getProductsAction,
  createProductAction,
  updateProductAction,
  toggleProductStatusAction,
  getTaxRatesAction,
  getSuppliersListAction,
} from '@/lib/actions/products';
import { formatCurrency } from '@/lib/utils/formatters';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // User Role
  const [userRole, setUserRole] = useState<string | null>(null);
  const canWrite = userRole ? WRITE_ROLES.includes(userRole) : false;

  // Form state
  const [formData, setFormData] = useState<CreateProductInput>({
    sku: '',
    name: '',
    description: '',
    category: 'Hardware',
    product_type: 'physical',
    supplier_id: '',
    cost: 0,
    sale_price: 0,
    tax_rate_id: '',
    stock_minimum: 10,
    is_inventory_item: true,
    status: 'active',
    barcode: '',
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

  // Fetch reference tax rates and suppliers
  useEffect(() => {
    getTaxRatesAction().then((res) => {
      if (res.success && res.data) {
        setTaxRates(res.data);
        if (res.data.length > 0) {
          const defaultTaxId = res.data[0].id;
          setFormData((prev) => (prev.tax_rate_id ? prev : { ...prev, tax_rate_id: defaultTaxId }));
        }
      }
    });
    getSuppliersListAction().then((res) => {
      if (res.success && res.data) {
        setSuppliers(res.data);
      }
    });
  }, []);

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await getProductsAction(searchTerm, categoryFilter, statusFilter, typeFilter);
      if (res.success && res.data) {
        setProducts(res.data);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al cargar productos.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter, statusFilter, typeFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      description: '',
      category: 'Hardware',
      product_type: 'physical',
      supplier_id: '',
      cost: 0,
      sale_price: 0,
      tax_rate_id: taxRates[0]?.id || '',
      stock_minimum: 10,
      is_inventory_item: true,
      status: 'active',
      barcode: '',
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await createProductAction(formData);
      if (res.success && res.data) {
        setFeedback({ type: 'success', message: 'Producto registrado exitosamente.' });
        setIsCreateOpen(false);
        resetForm();
        loadProducts();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al crear producto.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (product: ProductWithStock) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category || 'General',
      product_type: product.product_type,
      supplier_id: product.supplier_id || '',
      cost: product.cost,
      sale_price: product.sale_price,
      tax_rate_id: product.tax_rate_id,
      stock_minimum: product.stock_minimum,
      is_inventory_item: product.is_inventory_item,
      status: product.status,
      barcode: product.barcode || '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await updateProductAction(editingProduct.id, formData);
      if (res.success && res.data) {
        setFeedback({ type: 'success', message: 'Producto actualizado exitosamente.' });
        setEditingProduct(null);
        resetForm();
        loadProducts();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al actualizar producto.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: ProductWithStock) => {
    const nextStatus = product.status === 'active' ? 'inactive' : 'active';
    const confirmMsg = nextStatus === 'inactive'
      ? `¿Está seguro de desactivar el producto "${product.name}"?`
      : `¿Desea reactivar el producto "${product.name}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await toggleProductStatusAction(product.id, nextStatus);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'Estado actualizado.' });
        loadProducts();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al cambiar estado.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error de conexión.' });
    }
  };

  // Metrics calculation
  const totalValuation = products.reduce((acc, p) => acc + (p.inventory_value || 0), 0);
  const lowStockCount = products.filter((p) => p.is_inventory_item && p.current_stock <= p.stock_minimum).length;
  const physicalCount = products.filter((p) => p.is_inventory_item).length;

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)', margin: 0 }}>
            Catálogo de Productos & Inventario Base
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>
            Base de datos de producción Supabase. Maestro de referencias, control de stock y valoración.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} />}
            onClick={() => loadProducts()}
            disabled={loading}
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
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-dim)', marginBottom: '8px' }}>
            <Package size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Total SKUs Registrados</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
            {products.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {physicalCount} físicos · {products.length - physicalCount} servicios
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', marginBottom: '8px' }}>
            <DollarSign size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Valor Total de Inventario</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>
            {formatCurrency(totalValuation)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Costo ponderado de existencias
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: lowStockCount > 0 ? '#ef4444' : '#6b7280', marginBottom: '8px' }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Alertas Stock Bajo</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: lowStockCount > 0 ? '#ef4444' : 'var(--text-white)' }}>
            {lowStockCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {lowStockCount === 0 ? 'Niveles de stock saludables' : 'Requieren orden de compra'}
          </div>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: feedback.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '13px',
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1', minWidth: '280px', maxWidth: '420px', position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Buscar por SKU, nombre, categoría o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: '8px',
              padding: '3px',
            }}
          >
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: statusFilter === s ? 'var(--color-primary)' : 'transparent',
                  color: statusFilter === s ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Inactivos'}
              </button>
            ))}
          </div>

          {/* Type Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: '8px',
              padding: '3px',
            }}
          >
            {(['all', 'physical', 'service'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: typeFilter === t ? 'var(--color-primary)' : 'transparent',
                  color: typeFilter === t ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t === 'all' ? 'Tipo: Todos' : t === 'physical' ? 'Físicos' : 'Servicios'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / Loading / Clean Empty State */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando catálogo desde Supabase...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
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
            <Package size={28} />
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No se encontraron productos'
              : 'No hay productos registrados'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '440px', margin: '0 auto 20px' }}>
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Intente modificar los términos de búsqueda o los filtros aplicados.'
              : 'La base de datos de producción se encuentra limpia. Registre su primer producto o servicio para habilitar facturación y gestión de inventario.'}
          </p>
          {canWrite && !searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
            >
              Crear Primer Producto
            </Button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU / Referencia</th>
                <th>Producto / Categoría</th>
                <th>Costo</th>
                <th>Precio Venta</th>
                <th>Stock Actual</th>
                <th>Valor Inventario</th>
                <th>IVA</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isUnderMin = p.is_inventory_item && p.current_stock <= p.stock_minimum;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="num-mono" style={{ fontWeight: 700, color: 'var(--text-white)' }}>
                        {p.sku}
                      </div>
                      {p.barcode && (
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>BAR: {p.barcode}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.category || 'General'}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                          {p.product_type === 'physical' ? 'Físico' : 'Servicio'}
                        </span>
                        {p.supplier && (
                          <span style={{ fontSize: '10px', color: '#3b82f6' }}>
                            · {p.supplier.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="num-mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {formatCurrency(p.cost)}
                      </div>
                    </td>
                    <td>
                      <div className="num-mono" style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
                        {formatCurrency(p.sale_price)}
                      </div>
                    </td>
                    <td>
                      {p.is_inventory_item ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              className="num-mono"
                              style={{
                                fontWeight: 700,
                                fontSize: '13px',
                                color: isUnderMin ? '#ef4444' : 'var(--text-white)',
                              }}
                            >
                              {p.current_stock}
                            </span>
                            {isUnderMin && (
                              <Badge status="danger" label={`Bajo Min (${p.stock_minimum})`} />
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            Mínimo: {p.stock_minimum}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Exento (Servicio)</span>
                      )}
                    </td>
                    <td>
                      <div className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                        {formatCurrency(p.inventory_value)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {p.tax_rate ? `${p.tax_rate.code} (${(Number(p.tax_rate.rate) * 100).toFixed(0)}%)` : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <Badge status={p.status} label={p.status === 'active' ? 'Activo' : 'Inactivo'} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {canWrite && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Edit2 size={13} />}
                              onClick={() => handleEditOpen(p)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Archive size={13} />}
                              onClick={() => handleToggleStatus(p)}
                            >
                              {p.status === 'active' ? 'Desactivar' : 'Activar'}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Product */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Crear Nuevo Producto / Servicio"
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">SKU / Código *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="SKU-1001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="form-label">Nombre del Producto *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="ej. Servidor Dell PowerEdge R640"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Categoría</label>
              <input
                type="text"
                className="form-input"
                placeholder="Hardware, Software, Consultoría..."
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Tipo de Producto</label>
              <select
                className="form-input"
                value={formData.product_type}
                onChange={(e) => {
                  const val = e.target.value as 'physical' | 'service';
                  setFormData({
                    ...formData,
                    product_type: val,
                    is_inventory_item: val === 'physical',
                  });
                }}
              >
                <option value="physical">Físico (Gestiona Inventario)</option>
                <option value="service">Servicio (Exento de Stock)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Costo de Adquisición (COP) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                required
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="form-label">Precio de Venta Base (COP) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                required
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Tasa de Impuesto (IVA) *</label>
              <select
                className="form-input"
                required
                value={formData.tax_rate_id}
                onChange={(e) => setFormData({ ...formData, tax_rate_id: e.target.value })}
              >
                {taxRates.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name} ({tr.code} - {(Number(tr.rate) * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Proveedor Principal (Opcional)</label>
              <select
                className="form-input"
                value={formData.supplier_id || ''}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value || null })}
              >
                <option value="">-- Sin proveedor asignado --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.tax_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.product_type === 'physical' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Stock Mínimo (Alerta)</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={formData.stock_minimum}
                  onChange={(e) => setFormData({ ...formData, stock_minimum: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="form-label">Código de Barras (Opcional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="770..."
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Descripción</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Detalles técnicos o especificaciones..."
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Crear Producto'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Product */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`Editar Producto: ${editingProduct?.sku}`}
      >
        <form onSubmit={handleEditSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">SKU / Código *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="form-label">Nombre del Producto *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Categoría</label>
              <input
                type="text"
                className="form-input"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Tipo de Producto</label>
              <select
                className="form-input"
                value={formData.product_type}
                onChange={(e) => {
                  const val = e.target.value as 'physical' | 'service';
                  setFormData({
                    ...formData,
                    product_type: val,
                    is_inventory_item: val === 'physical',
                  });
                }}
              >
                <option value="physical">Físico (Gestiona Inventario)</option>
                <option value="service">Servicio (Exento de Stock)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Costo (COP) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                required
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="form-label">Precio de Venta (COP) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                required
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Tasa de Impuesto (IVA) *</label>
              <select
                className="form-input"
                required
                value={formData.tax_rate_id}
                onChange={(e) => setFormData({ ...formData, tax_rate_id: e.target.value })}
              >
                {taxRates.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name} ({tr.code} - {(Number(tr.rate) * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Proveedor</label>
              <select
                className="form-input"
                value={formData.supplier_id || ''}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value || null })}
              >
                <option value="">-- Sin proveedor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.tax_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.product_type === 'physical' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Stock Mínimo (Alerta)</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={formData.stock_minimum}
                  onChange={(e) => setFormData({ ...formData, stock_minimum: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="form-label">Código de Barras</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Descripción</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" type="button" onClick={() => setEditingProduct(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : 'Actualizar Producto'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

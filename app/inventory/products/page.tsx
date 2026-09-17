'use client';

import React, { useState } from 'react';
import { Plus, Search, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_PRODUCTS, INITIAL_MOVEMENTS, INITIAL_TAX_RATES } from '@/lib/supabase/mock-store';
import { Product } from '@/types/database';
import { deriveProductStock, isLowStock } from '@/lib/finance/inventory';
import { formatCurrency } from '@/lib/utils/formatters';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [productType, setProductType] = useState<'physical' | 'service'>('physical');
  const [cost, setCost] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [taxRateId, setTaxRateId] = useState(INITIAL_TAX_RATES[0]?.id || '');
  const [stockMinimum, setStockMinimum] = useState(10);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name) return;

    const newProduct: Product = {
      id: `p-${Date.now()}`,
      company_id: 'c1111111-1111-1111-1111-111111111111',
      sku,
      name,
      category,
      product_type: productType,
      cost: Number(cost),
      sale_price: Number(salePrice),
      tax_rate_id: taxRateId,
      stock_minimum: Number(stockMinimum),
      is_inventory_item: productType === 'physical',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setProducts([newProduct, ...products]);
    setIsCreateOpen(false);
    // Reset
    setSku('');
    setName('');
    setCost(0);
    setSalePrice(0);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Catálogo de Productos & Servicios
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Referencias para facturación, costos de adquisición y control de inventario físico.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsCreateOpen(true)}
        >
          Nuevo Producto
        </Button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
        <Search
          size={16}
          color="var(--text-dim)"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '38px' }}
          placeholder="Buscar por SKU, nombre o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU / Referencia</th>
              <th>Nombre & Categoría</th>
              <th>Tipo</th>
              <th>Costo Unitario</th>
              <th>Precio Venta</th>
              <th>Stock Actual</th>
              <th>Stock Mínimo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const movements = INITIAL_MOVEMENTS.filter((m) => m.product_id === p.id);
              const currentStock = p.is_inventory_item ? deriveProductStock(movements) : null;
              const hasLowStock = p.is_inventory_item && isLowStock(currentStock || 0, p.stock_minimum);

              return (
                <tr key={p.id}>
                  <td>
                    <span className="num-mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {p.sku}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.category || 'General'}</div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                      {p.product_type === 'physical' ? 'Físico' : 'Servicio'}
                    </span>
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {formatCurrency(p.cost)}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                    {formatCurrency(p.sale_price)}
                  </td>
                  <td>
                    {p.is_inventory_item ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className="num-mono"
                          style={{
                            fontWeight: 700,
                            color: hasLowStock ? '#fbbf24' : 'var(--text-white)',
                          }}
                        >
                          {currentStock}
                        </span>
                        {hasLowStock && (
                          <span title="Stock bajo el mínimo">
                            <AlertTriangle size={14} color="#fbbf24" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>N/A (Servicio)</span>
                    )}
                  </td>
                  <td className="num-mono" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {p.is_inventory_item ? p.stock_minimum : '-'}
                  </td>
                  <td>
                    <Badge status={p.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Product */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Crear Nueva Referencia"
      >
        <form onSubmit={handleCreateProduct}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">SKU / Código Único *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="PAG-PRD-001"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del Producto o Servicio *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Nombre descriptivo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <input
                type="text"
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Producto</label>
              <select
                className="form-select"
                value={productType}
                onChange={(e) => setProductType(e.target.value as 'physical' | 'service')}
              >
                <option value="physical">Físico (Inventariable)</option>
                <option value="service">Servicio / Intangible</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Costo de Adquisición (COP)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Precio de Venta Base (COP) *</label>
              <input
                type="number"
                min="0"
                required
                className="form-input"
                value={salePrice}
                onChange={(e) => setSalePrice(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tarifa de IVA Predeterminada</label>
              <select
                className="form-select"
                value={taxRateId}
                onChange={(e) => setTaxRateId(e.target.value)}
              >
                {INITIAL_TAX_RATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({(t.rate * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
            {productType === 'physical' && (
              <div className="form-group">
                <label className="form-label">Stock Mínimo de Alerta</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={stockMinimum}
                  onChange={(e) => setStockMinimum(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Referencia
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

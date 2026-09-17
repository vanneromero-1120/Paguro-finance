'use client';

import React, { useState } from 'react';
import { Plus, Search, Truck, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_SUPPLIERS, INITIAL_PURCHASES } from '@/lib/supabase/mock-store';
import { Supplier } from '@/types/database';
import { formatCurrency } from '@/lib/utils/formatters';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bogotá');
  const [terms, setTerms] = useState(30);

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !taxId) return;

    const newSupplier: Supplier = {
      id: `supp-${Date.now()}`,
      company_id: 'c1111111-1111-1111-1111-111111111111',
      name,
      legal_name: legalName || name,
      identification_type: 'NIT',
      tax_id: taxId,
      email,
      phone,
      city,
      country: 'Colombia',
      payment_terms_days: Number(terms),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSuppliers([newSupplier, ...suppliers]);
    setIsCreateOpen(false);
    // Reset
    setName('');
    setLegalName('');
    setTaxId('');
    setEmail('');
    setPhone('');
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.tax_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Directorio de Proveedores
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Proveedores de servicios, inventario, logística y compras operativas.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsCreateOpen(true)}
        >
          Nuevo Proveedor
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
          placeholder="Buscar proveedor o NIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>NIT / Identificación</th>
              <th>Contacto</th>
              <th>Ciudad</th>
              <th>Plazo de Pago</th>
              <th>Saldo CxP</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((s) => {
              const openBalance = INITIAL_PURCHASES
                .filter((p) => p.supplier_id === s.id && p.status !== 'void')
                .reduce((acc, p) => acc + p.balance_due, 0);

              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{s.name}</div>
                    {s.legal_name && s.legal_name !== s.name && (
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{s.legal_name}</div>
                    )}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {s.tax_id}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                      {s.email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                          <Mail size={12} /> {s.email}
                        </span>
                      )}
                      {s.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)' }}>
                          <Phone size={12} /> {s.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <MapPin size={12} /> {s.city || '-'}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {s.payment_terms_days} días
                  </td>
                  <td className="num-mono" style={{ fontWeight: 600, color: openBalance > 0 ? '#f87171' : 'var(--text-dim)' }}>
                    {formatCurrency(openBalance)}
                  </td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Supplier */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Nuevo Proveedor"
      >
        <form onSubmit={handleCreateSupplier}>
          <div className="form-group">
            <label className="form-label">Nombre Comercial *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Amazon Web Services Colombia"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Razón Social Legal</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. AWS Colombia S.A.S."
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">NIT / Número Fiscal *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. 901.324.912-3"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Plazo de Pago (Días)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={terms}
                onChange={(e) => setTerms(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Correo de Contacto</label>
              <input
                type="email"
                className="form-input"
                placeholder="proveedores@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input
              type="text"
              className="form-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Proveedor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

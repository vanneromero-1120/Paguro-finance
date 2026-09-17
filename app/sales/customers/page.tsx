'use client';

import React, { useState } from 'react';
import { Plus, Search, Users, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_CUSTOMERS, INITIAL_INVOICES } from '@/lib/supabase/mock-store';
import { Customer } from '@/types/database';
import { formatCurrency } from '@/lib/utils/formatters';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
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

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !taxId) return;

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
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

    setCustomers([newCustomer, ...customers]);
    setIsCreateOpen(false);
    // Reset
    setName('');
    setLegalName('');
    setTaxId('');
    setEmail('');
    setPhone('');
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tax_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Directorio de Clientes
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Base de datos de clientes corporativos, condiciones de pago y saldos por cobrar.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsCreateOpen(true)}
        >
          Nuevo Cliente
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
          placeholder="Buscar por razón social o NIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente / Razón Social</th>
              <th>NIT / Identificación</th>
              <th>Contacto</th>
              <th>Ciudad</th>
              <th>Plazo de Pago</th>
              <th>Saldo CxC</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => {
              // Calculate open balance for this customer
              const openBalance = INITIAL_INVOICES
                .filter((inv) => inv.customer_id === c.id && inv.status !== 'void')
                .reduce((acc, inv) => acc + inv.balance_due, 0);

              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{c.name}</div>
                    {c.legal_name && c.legal_name !== c.name && (
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{c.legal_name}</div>
                    )}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {c.tax_id}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                      {c.email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                          <Mail size={12} /> {c.email}
                        </span>
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
                      <MapPin size={12} /> {c.city || '-'}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {c.payment_terms_days} días
                  </td>
                  <td className="num-mono" style={{ fontWeight: 600, color: openBalance > 0 ? '#fbbf24' : 'var(--text-dim)' }}>
                    {formatCurrency(openBalance)}
                  </td>
                  <td>
                    <Badge status={c.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Customer */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Registrar Nuevo Cliente"
      >
        <form onSubmit={handleCreateCustomer}>
          <div className="form-group">
            <label className="form-label">Nombre Comercial / Fantasía *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Almacenes Éxito"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Razón Social Legal</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Almacenes Éxito S.A."
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
                placeholder="Ej. 890.900.608-9"
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
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                className="form-input"
                placeholder="facturacion@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                className="form-input"
                placeholder="+57 (1) 316-0000"
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
              Guardar Cliente
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

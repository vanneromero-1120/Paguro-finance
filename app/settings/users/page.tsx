'use client';

import React, { useState } from 'react';
import { UserCheck, Plus, Shield, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { UserRole } from '@/types/database';

interface UserMembershipView {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'active' | 'invited' | 'suspended';
  lastAccess: string;
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserMembershipView[]>([
    {
      id: 'u1',
      email: 'admin@pagurocorp.com',
      fullName: 'Carlos Mendoza',
      role: 'ADMIN',
      status: 'active',
      lastAccess: 'Hoy a las 10:14 AM',
    },
    {
      id: 'u2',
      email: 'finance@pagurocorp.com',
      fullName: 'Valeria Rios',
      role: 'FINANCE',
      status: 'active',
      lastAccess: 'Ayer a las 04:30 PM',
    },
    {
      id: 'u3',
      email: 'ops@pagurocorp.com',
      fullName: 'Mateo Gómez',
      role: 'OPERATIONS',
      status: 'active',
      lastAccess: 'Hace 3 días',
    },
    {
      id: 'u4',
      email: 'viewer@pagurocorp.com',
      fullName: 'Sofia Herrera',
      role: 'VIEWER',
      status: 'active',
      lastAccess: 'Hace 1 semana',
    },
  ]);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('FINANCE');

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;

    const newUser: UserMembershipView = {
      id: `u-${Date.now()}`,
      email,
      fullName,
      role,
      status: 'invited',
      lastAccess: 'Pendiente de aceptación',
    };

    setUsers([...users, newUser]);
    setIsInviteOpen(false);
    setEmail('');
    setFullName('');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Gestión de Usuarios & Control de Accesos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Roles y permisos asignados por empresa bajo el modelo RBAC estricto.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsInviteOpen(true)}
        >
          Invitar Usuario
        </Button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario / Nombre</th>
              <th>Correo Electrónico</th>
              <th>Rol Asignado</th>
              <th>Último Acceso</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-card-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                      }}
                    >
                      {u.fullName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{u.fullName}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {u.email}
                </td>
                <td>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--color-primary)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                    }}
                  >
                    <Shield size={12} /> {u.role}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  {u.lastAccess}
                </td>
                <td>
                  <Badge status={u.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Invite User */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invitar Usuario a la Empresa"
      >
        <form onSubmit={handleInviteUser}>
          <div className="form-group">
            <label className="form-label">Nombre Completo *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Andrés Morales"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Correo Electrónico Corporativo *</label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="andres@pagurocorp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Rol & Nivel de Permisos *</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="ADMIN">ADMIN - Administrador Financiero (Control Total Operativo)</option>
              <option value="FINANCE">FINANCE - Finanzas & Contabilidad (Facturas, Pagos, IVA)</option>
              <option value="OPERATIONS">OPERATIONS - Operaciones (Productos e Inventario)</option>
              <option value="VIEWER">VIEWER - Consulta & Dirección (Solo Lectura)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsInviteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Enviar Invitación
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

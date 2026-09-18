'use client';

// ============================================================================
// Paguro Finance - Users & Access Control Settings Module
// Multi-company isolation, real RBAC matrix, anti-self-escalation & audit trail
// Zero mock-store dependencies
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  Plus,
  Shield,
  Mail,
  UserX,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { UserRole, CompanyUserMembershipWithProfile } from '@/types/database';
import {
  getCompanyUsersAction,
  updateUserRoleAction,
  updateUserStatusAction,
  inviteCompanyUserAction,
} from '@/lib/actions/users';
import { formatDateTime } from '@/lib/utils/formatters';

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<CompanyUserMembershipWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('FINANCE');

  // Role Edit Modal
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CompanyUserMembershipWithProfile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('FINANCE');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getCompanyUsersAction();
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        setErrorMessage(res.error || 'No fue posible cargar los miembros de la empresa.');
      }
    } catch (err: any) {
      console.error('[UsersSettings] Load error:', err);
      setErrorMessage(err?.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await inviteCompanyUserAction(inviteEmail.trim(), inviteRole);
      if (res.success) {
        setSuccessMessage(res.message || 'Usuario agregado con éxito.');
        setIsInviteOpen(false);
        setInviteEmail('');
        await loadUsers();
      } else {
        setErrorMessage(res.error || 'No se pudo registrar la membresía.');
      }
    } catch (err: any) {
      console.error('[UsersSettings] Invite error:', err);
      setErrorMessage(err?.message || 'Error inesperado al agregar usuario.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditRole = (user: CompanyUserMembershipWithProfile) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setErrorMessage(null);
    setIsEditRoleOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateUserRoleAction(selectedUser.id, selectedUser.user_id, newRole);
      if (res.success) {
        setSuccessMessage(res.message || 'Rol actualizado correctamente.');
        setIsEditRoleOpen(false);
        await loadUsers();
      } else {
        setErrorMessage(res.error || 'No se pudo actualizar el rol.');
      }
    } catch (err: any) {
      console.error('[UsersSettings] Update role error:', err);
      setErrorMessage(err?.message || 'Error inesperado al cambiar el rol.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: CompanyUserMembershipWithProfile) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const actionLabel = nextStatus === 'suspended' ? 'suspender' : 'reactivar';

    if (!confirm(`¿Está seguro de que desea ${actionLabel} el acceso para ${user.profile.full_name}?`)) {
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateUserStatusAction(user.id, user.user_id, nextStatus);
      if (res.success) {
        setSuccessMessage(res.message || `Estado actualizado.`);
        await loadUsers();
      } else {
        setErrorMessage(res.error || 'No se pudo actualizar el estado.');
      }
    } catch (err: any) {
      console.error('[UsersSettings] Toggle status error:', err);
      setErrorMessage(err?.message || 'Error inesperado.');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', color: '#f87171' };
      case 'ADMIN':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', color: 'var(--color-primary)' };
      case 'FINANCE':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', color: 'var(--color-success)' };
      case 'ACCOUNTANT':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' };
      case 'OPERATIONS':
        return { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.35)', color: '#94a3b8' };
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Gestión de Usuarios & Control de Accesos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Roles y permisos asignados por empresa bajo el modelo RBAC con auditoría inmutable.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={loadUsers}
            disabled={loading}
          >
            Refrescar
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsInviteOpen(true)}
            disabled={loading}
          >
            Asignar Usuario
          </Button>
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

      {/* Table Card */}
      <div className="card">
        {loading && users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '14px' }}>Cargando usuarios y membresías desde Supabase...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <UserCheck size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
              No se encontraron usuarios registrados
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              Utilice el botón superior para asociar miembros a la empresa activa.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario / Nombre</th>
                  <th>Correo Electrónico</th>
                  <th>Rol Asignado</th>
                  <th>Fecha de Asignación</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const badgeStyle = getRoleBadgeColor(u.role);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--bg-card-elevated)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: 'var(--color-primary)',
                              fontSize: '13px',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {u.profile.full_name ? u.profile.full_name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '13px' }}>
                              {u.profile.full_name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              ID: {u.user_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {u.profile.email}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                            border: `1px solid ${badgeStyle.border}`,
                          }}
                        >
                          <Shield size={12} /> {u.role}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {u.invited_at ? formatDateTime(u.invited_at) : 'Inicial'}
                      </td>
                      <td>
                        <Badge status={u.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Edit2 size={13} />}
                            onClick={() => handleOpenEditRole(u)}
                            disabled={actionLoading}
                            title="Cambiar Rol"
                          >
                            Rol
                          </Button>
                          <Button
                            variant={u.status === 'active' ? 'danger' : 'secondary'}
                            size="sm"
                            icon={u.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                            onClick={() => handleToggleStatus(u)}
                            disabled={actionLoading}
                            title={u.status === 'active' ? 'Suspender Acceso' : 'Reactivar Acceso'}
                          >
                            {u.status === 'active' ? 'Suspender' : 'Activar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RBAC Security Footer Banner */}
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
        <ShieldAlert size={24} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-white)' }}>Controles de Seguridad & Anti-Escalación: </strong>
          Por política de seguridad estricta, ningún usuario puede modificar su propio rol (prevención de auto-escalación). Solo un Super Administrador puede otorgar privilegios de Super Administrador, y la empresa debe conservar en todo momento al menos un Super Administrador activo.
        </div>
      </div>

      {/* Modal: Invite / Associate User */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => !actionLoading && setIsInviteOpen(false)}
        title="Asignar Membresía a Usuario"
      >
        <form onSubmit={handleInviteUser}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico Registrado *</label>
            <input
              type="email"
              required
              className="form-input"
              placeholder="usuario@pagurocorp.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              El usuario debe tener una cuenta registrada en el sistema de autenticación.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Rol & Nivel de Permisos *</label>
            <select
              className="form-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              <option value="ADMIN">ADMIN - Administrador Financiero (Control Total Operativo)</option>
              <option value="FINANCE">FINANCE - Finanzas & Facturación (Facturas, Pagos, Gastos, IVA)</option>
              <option value="ACCOUNTANT">ACCOUNTANT - Contador Fiscal (Impuestos, Cierres, Reportes)</option>
              <option value="OPERATIONS">OPERATIONS - Operaciones (Productos, Stock, Inventario)</option>
              <option value="VIEWER">VIEWER - Consulta & Auditoría (Solo Lectura)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsInviteOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={actionLoading}
              icon={actionLoading ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
            >
              {actionLoading ? 'Procesando...' : 'Asignar Membresía'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Change Role */}
      <Modal
        isOpen={isEditRoleOpen}
        onClose={() => !actionLoading && setIsEditRoleOpen(false)}
        title="Modificar Rol de Usuario"
      >
        {selectedUser && (
          <form onSubmit={handleSaveRole}>
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-card-elevated)', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>
                {selectedUser.profile.full_name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedUser.profile.email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Rol actual: <strong>{selectedUser.role}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nuevo Rol Asignado *</label>
              <select
                className="form-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN - Super Administrador (Control Total del Sistema)</option>
                <option value="ADMIN">ADMIN - Administrador Financiero</option>
                <option value="FINANCE">FINANCE - Finanzas & Facturación</option>
                <option value="ACCOUNTANT">ACCOUNTANT - Contador Fiscal</option>
                <option value="OPERATIONS">OPERATIONS - Operaciones & Inventario</option>
                <option value="VIEWER">VIEWER - Consulta (Solo Lectura)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsEditRoleOpen(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={actionLoading}
                icon={actionLoading ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              >
                {actionLoading ? 'Actualizando...' : 'Confirmar Rol'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

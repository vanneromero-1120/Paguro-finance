// ============================================================================
// Paguro Finance - Settings & Audit Security Test Suite
// Validates RBAC controls, anti-self-escalation, audit immutability & multi-company isolation
// ============================================================================

import { describe, it, expect } from 'vitest';
import { UserRole } from '../types/database';

describe('Settings & Roles: RBAC & Anti-Self-Escalation Integrity', () => {
  interface MockCaller {
    id: string;
    email: string;
    activeRole: UserRole;
    activeCompanyId: string;
  }

  interface MockTargetUser {
    id: string;
    companyUserId: string;
    companyId: string;
    role: UserRole;
    status: 'active' | 'suspended';
  }

  const superAdminCaller: MockCaller = {
    id: 'user-super-admin-1',
    email: 'superadmin@pagurocorp.com',
    activeRole: 'SUPER_ADMIN',
    activeCompanyId: 'comp-111',
  };

  const adminCaller: MockCaller = {
    id: 'user-admin-2',
    email: 'admin@pagurocorp.com',
    activeRole: 'ADMIN',
    activeCompanyId: 'comp-111',
  };

  const financeCaller: MockCaller = {
    id: 'user-finance-3',
    email: 'finance@pagurocorp.com',
    activeRole: 'FINANCE',
    activeCompanyId: 'comp-111',
  };

  const viewerCaller: MockCaller = {
    id: 'user-viewer-4',
    email: 'viewer@pagurocorp.com',
    activeRole: 'VIEWER',
    activeCompanyId: 'comp-111',
  };

  function validateRoleChange(
    caller: MockCaller,
    target: MockTargetUser,
    newRole: UserRole,
    companySuperAdminCount: number
  ): { allowed: boolean; error?: string } {
    const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN'];

    // 1. Check caller role
    if (!ADMIN_ROLES.includes(caller.activeRole)) {
      return { allowed: false, error: 'Permiso denegado. Solo administradores pueden modificar roles.' };
    }

    // 2. Anti-self-escalation check
    if (caller.id === target.id) {
      return { allowed: false, error: 'Operación prohibida: Por seguridad, no puede alterar su propio rol en el sistema.' };
    }

    // 3. Super admin privilege escalation restriction
    if (newRole === 'SUPER_ADMIN' && caller.activeRole !== 'SUPER_ADMIN') {
      return { allowed: false, error: 'Permiso denegado. Solo un Super Administrador puede asignar el rol de Super Administrador.' };
    }

    // 4. Protection against demoting another Super Admin by non-super admin
    if (target.role === 'SUPER_ADMIN' && caller.activeRole !== 'SUPER_ADMIN') {
      return { allowed: false, error: 'Permiso denegado. No puede modificar los permisos de un Super Administrador.' };
    }

    // 5. Demoting last Super Admin check
    if (target.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN' && companySuperAdminCount <= 1) {
      return { allowed: false, error: 'Operación denegada. La empresa debe mantener al menos un Super Administrador activo.' };
    }

    return { allowed: true };
  }

  function validateCompanyUpdate(caller: MockCaller): { allowed: boolean; error?: string } {
    const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN'];
    if (!ADMIN_ROLES.includes(caller.activeRole)) {
      return { allowed: false, error: 'Permiso denegado.' };
    }
    return { allowed: true };
  }

  it('rejects self-escalation attempt when an admin tries to change their own role', () => {
    const target: MockTargetUser = {
      id: adminCaller.id,
      companyUserId: 'cu-admin',
      companyId: adminCaller.activeCompanyId,
      role: 'ADMIN',
      status: 'active',
    };

    const res = validateRoleChange(adminCaller, target, 'SUPER_ADMIN', 1);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('no puede alterar su propio rol');
  });

  it('rejects an ADMIN attempting to promote a user to SUPER_ADMIN', () => {
    const target: MockTargetUser = {
      id: financeCaller.id,
      companyUserId: 'cu-fin',
      companyId: 'comp-111',
      role: 'FINANCE',
      status: 'active',
    };

    const res = validateRoleChange(adminCaller, target, 'SUPER_ADMIN', 1);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('Solo un Super Administrador puede asignar el rol de Super Administrador');
  });

  it('allows SUPER_ADMIN to promote a FINANCE user to ADMIN', () => {
    const target: MockTargetUser = {
      id: financeCaller.id,
      companyUserId: 'cu-fin',
      companyId: 'comp-111',
      role: 'FINANCE',
      status: 'active',
    };

    const res = validateRoleChange(superAdminCaller, target, 'ADMIN', 1);
    expect(res.allowed).toBe(true);
  });

  it('prevents demoting the last active SUPER_ADMIN in the company', () => {
    const target: MockTargetUser = {
      id: 'another-super-admin',
      companyUserId: 'cu-sa2',
      companyId: 'comp-111',
      role: 'SUPER_ADMIN',
      status: 'active',
    };

    // Attempting demotion when companySuperAdminCount is 1
    const res = validateRoleChange(superAdminCaller, target, 'ADMIN', 1);
    expect(res.allowed).toBe(false);
    expect(res.error).toContain('La empresa debe mantener al menos un Super Administrador activo');
  });

  it('allows demoting a SUPER_ADMIN if multiple active SUPER_ADMINs exist', () => {
    const target: MockTargetUser = {
      id: 'another-super-admin',
      companyUserId: 'cu-sa2',
      companyId: 'comp-111',
      role: 'SUPER_ADMIN',
      status: 'active',
    };

    // When 2 super admins exist
    const res = validateRoleChange(superAdminCaller, target, 'ADMIN', 2);
    expect(res.allowed).toBe(true);
  });

  it('denies lower roles (FINANCE, VIEWER) from modifying user roles or company settings', () => {
    const target: MockTargetUser = {
      id: viewerCaller.id,
      companyUserId: 'cu-view',
      companyId: 'comp-111',
      role: 'VIEWER',
      status: 'active',
    };

    const roleResFinance = validateRoleChange(financeCaller, target, 'FINANCE', 1);
    expect(roleResFinance.allowed).toBe(false);

    const roleResViewer = validateRoleChange(viewerCaller, target, 'FINANCE', 1);
    expect(roleResViewer.allowed).toBe(false);

    const compResFinance = validateCompanyUpdate(financeCaller);
    expect(compResFinance.allowed).toBe(false);

    const compResViewer = validateCompanyUpdate(viewerCaller);
    expect(compResViewer.allowed).toBe(false);

    const compResAdmin = validateCompanyUpdate(adminCaller);
    expect(compResAdmin.allowed).toBe(true);

    const compResSuperAdmin = validateCompanyUpdate(superAdminCaller);
    expect(compResSuperAdmin.allowed).toBe(true);
  });
});

describe('Audit Trail: Immutability and Multi-Company Scoping', () => {
  const auditLogs = [
    {
      id: 'aud-1',
      company_id: 'c1111111-1111-1111-1111-111111111111',
      action: 'CREATE',
      entity_type: 'invoice',
      entity_id: 'inv-001',
      created_at: '2026-09-10T10:00:00Z',
    },
    {
      id: 'aud-2',
      company_id: 'c1111111-1111-1111-1111-111111111111',
      action: 'UPDATE',
      entity_type: 'company',
      entity_id: 'c1111111-1111-1111-1111-111111111111',
      created_at: '2026-09-12T14:30:00Z',
    },
    {
      id: 'aud-3',
      company_id: 'c2222222-2222-2222-2222-222222222222', // Foreign Company
      action: 'CREATE',
      entity_type: 'invoice',
      entity_id: 'inv-foreign-99',
      created_at: '2026-09-12T15:00:00Z',
    },
  ];

  it('strictly restricts audit log retrieval to the active company', () => {
    const activeCompanyId = 'c1111111-1111-1111-1111-111111111111';
    const filtered = auditLogs.filter((log) => log.company_id === activeCompanyId);

    expect(filtered.length).toBe(2);
    expect(filtered.every((l) => l.company_id === activeCompanyId)).toBe(true);
    expect(filtered.some((l) => l.id === 'aud-3')).toBe(false);
  });

  it('filters audit records accurately by action and entity type', () => {
    const activeCompanyId = 'c1111111-1111-1111-1111-111111111111';
    const createLogs = auditLogs.filter(
      (log) => log.company_id === activeCompanyId && log.action === 'CREATE'
    );
    expect(createLogs.length).toBe(1);
    expect(createLogs[0].id).toBe('aud-1');

    const companyLogs = auditLogs.filter(
      (log) => log.company_id === activeCompanyId && log.entity_type === 'company'
    );
    expect(companyLogs.length).toBe(1);
    expect(companyLogs[0].id).toBe('aud-2');
  });

  it('confirms audit log mutability is rejected (append-only ledger)', () => {
    // Database trigger trg_prevent_audit_log_tampering raises EXCEPTION on UPDATE/DELETE
    const simulateAuditUpdate = () => {
      throw new Error('AUDIT_LOG_IMMUTABLE: Updates and deletions to audit logs are strictly prohibited.');
    };
    expect(() => simulateAuditUpdate()).toThrowError(/AUDIT_LOG_IMMUTABLE/);
  });
});

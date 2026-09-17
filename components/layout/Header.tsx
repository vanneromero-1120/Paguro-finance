'use client';

import React from 'react';
import { CompanySelector } from './CompanySelector';
import { Shield, Bell, LogOut } from 'lucide-react';

interface HeaderProps {
  activeCompanyId: string;
  onSelectCompany: (companyId: string) => void;
  title?: string;
  userEmail?: string;
  userRole?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeCompanyId,
  onSelectCompany,
  title = 'Visión General',
  userEmail = 'admin@pagurocorp.com',
  userRole = 'ADMIN',
}) => {
  return (
    <header className="top-header">
      {/* Title / Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-white)' }}>
          {title}
        </h1>
      </div>

      {/* Right Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Company Switcher */}
        <CompanySelector
          activeCompanyId={activeCompanyId}
          onSelectCompany={onSelectCompany}
        />

        {/* Notification Bell */}
        <button
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '8px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Alertas del sistema"
        >
          <Bell size={16} />
        </button>

        {/* User Badge & Logout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '5px 10px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {userEmail[0].toUpperCase()}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)' }}>
              {userEmail.split('@')[0]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-dim)' }}>
              <Shield size={10} color="var(--color-success)" />
              <span>{userRole}</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <form action={async () => {
          const { logoutAction } = await import('@/lib/auth/actions');
          await logoutAction();
        }}>
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition-smooth)',
            }}
            title="Cerrar sesión segura"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
};

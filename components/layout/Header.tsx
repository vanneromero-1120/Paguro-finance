'use client';

import React, { useEffect, useState } from 'react';
import { CompanySelector } from './CompanySelector';
import { Shield, Bell, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
  const [userState, setUserState] = useState<{ email: string; role: string; name: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: membership } = await supabase
        .from('company_users')
        .select('role')
        .eq('user_id', user.id)
        .in('status', ['active', 'ACTIVE'])
        .single();

      setUserState({
        email: user.email || '',
        name: profile?.full_name || user.email?.split('@')[0] || 'Usuario',
        role: membership?.role || 'SUPER_ADMIN',
      });
    });
  }, []);

  const displayEmail = userState?.email || userEmail;
  const displayRole = userState?.role || userRole;
  const displayName = userState?.name || displayEmail.split('@')[0];
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
            {displayEmail ? displayEmail[0].toUpperCase() : 'U'}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)' }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-dim)' }}>
              <Shield size={10} color="var(--color-success)" />
              <span>{displayRole}</span>
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

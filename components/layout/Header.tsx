'use client';

import React, { useEffect, useState } from 'react';
import { CompanySelector } from './CompanySelector';
import { Shield, Bell, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getInAppSystemNotificationsAction,
  InAppSystemNotification,
} from '@/lib/actions/tax-operations';

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
  const [notifications, setNotifications] = useState<InAppSystemNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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

    getInAppSystemNotificationsAction().then((res) => {
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    });
  }, [activeCompanyId]);

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

        {/* Notification Bell & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{
              background: showNotifications ? 'rgba(0, 152, 255, 0.12)' : 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px',
              color: notifications.length > 0 ? 'var(--paguro-blue)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
            title="Alertas del sistema"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--color-danger)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
                }}
              >
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '360px',
                maxHeight: '440px',
                overflowY: 'auto',
                backgroundColor: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '8px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-white)' }}>
                  Notificaciones del Sistema
                </div>
                <span className="badge badge-brand-blue" style={{ fontSize: '10px' }}>
                  {notifications.length} activas
                </span>
              </div>

              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-dim)', fontSize: '12px' }}>
                  No hay alertas tributarias ni operativas pendientes.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map((n) => (
                    <a
                      key={n.id}
                      href={n.href}
                      onClick={() => setShowNotifications(false)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor:
                          n.type === 'DANGER'
                            ? 'rgba(239, 68, 68, 0.08)'
                            : n.type === 'WARNING'
                            ? 'rgba(245, 158, 11, 0.08)'
                            : 'rgba(59, 130, 246, 0.08)',
                        border: `1px solid ${
                          n.type === 'DANGER'
                            ? 'rgba(239, 68, 68, 0.25)'
                            : n.type === 'WARNING'
                            ? 'rgba(245, 158, 11, 0.25)'
                            : 'rgba(59, 130, 246, 0.25)'
                        }`,
                        display: 'block',
                        textDecoration: 'none',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color:
                            n.type === 'DANGER'
                              ? 'var(--color-danger)'
                              : n.type === 'WARNING'
                              ? 'var(--color-warning)'
                              : 'var(--paguro-blue)',
                          marginBottom: '3px',
                        }}
                      >
                        {n.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {n.message}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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

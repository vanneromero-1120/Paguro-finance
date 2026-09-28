'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderOpen,
  Percent,
  CalendarCheck,
  Network,
  Settings,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const v1NavItems: { label: string; href: string; icon: React.ReactNode; badge?: string }[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={19} /> },
    { label: 'Movimientos', href: '/movements', icon: <ArrowLeftRight size={19} /> },
    { label: 'Documentos', href: '/documents', icon: <FolderOpen size={19} /> },
    { label: 'Impuestos', href: '/taxes', icon: <Percent size={19} /> },
    { label: 'Obligaciones', href: '/obligations', icon: <CalendarCheck size={19} /> },
    { label: 'Integraciones', href: '/integrations', icon: <Network size={19} /> },
    { label: 'Configuración', href: '/settings', icon: <Settings size={19} /> },
  ];

  return (
    <aside className="sidebar">
      {/* Official Paguro Brand Header */}
      <div
        style={{
          padding: '20px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <Image
            src="/brand/paguro-icon.png"
            alt="Paguro Isotype"
            width={28}
            height={28}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-white)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>PAGURO</span>
            <span style={{ color: 'var(--paguro-blue)' }}>FINANCE</span>
          </div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Version 1.0 • Intelligence
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-dim)',
            letterSpacing: '0.08em',
            padding: '0 12px 8px',
            textTransform: 'uppercase',
          }}
        >
          Módulos Operativos V1
        </div>

        {v1NavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: '8px',
                marginBottom: '4px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-white)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--paguro-blue-light)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(0, 152, 255, 0.35)'
                  : '1px solid transparent',
                transition: 'var(--transition-smooth)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    color: isActive ? 'var(--paguro-blue)' : 'var(--text-dim)',
                    display: 'flex',
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className="badge badge-brand-pink"
                  style={{ fontSize: '9px', padding: '1px 6px' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* System Status Footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-success)',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
            }}
          />
          RLS Activo
        </span>
        <span className="badge badge-brand-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>
          COL • COP
        </span>
      </div>
    </aside>
  );
};

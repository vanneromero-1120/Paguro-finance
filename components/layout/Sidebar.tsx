'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Users,
  CreditCard,
  ShoppingBag,
  Truck,
  Package,
  ArrowUpDown,
  Percent,
  BarChart3,
  FolderOpen,
  Settings,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navGroups = [
    {
      title: 'OPERACIÓN',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
      ],
    },
    {
      title: 'VENTAS & CXC',
      items: [
        { label: 'Facturas de Venta', href: '/sales/invoices', icon: <Receipt size={18} /> },
        { label: 'Clientes', href: '/sales/customers', icon: <Users size={18} /> },
        { label: 'Cobros & Pagos', href: '/sales/payments', icon: <CreditCard size={18} /> },
      ],
    },
    {
      title: 'COMPRAS & CXP',
      items: [
        { label: 'Gastos & Compras', href: '/purchases/expenses', icon: <ShoppingBag size={18} /> },
        { label: 'Proveedores', href: '/purchases/suppliers', icon: <Truck size={18} /> },
      ],
    },
    {
      title: 'INVENTARIO',
      items: [
        { label: 'Productos', href: '/inventory/products', icon: <Package size={18} /> },
        { label: 'Movimientos', href: '/inventory/movements', icon: <ArrowUpDown size={18} /> },
      ],
    },
    {
      title: 'IMPUESTOS & REPORTES',
      items: [
        { label: 'IVA por Periodo', href: '/taxes/iva', icon: <Percent size={18} /> },
        { label: 'Reportes Financieros', href: '/reports', icon: <BarChart3 size={18} /> },
        { label: 'Documentos', href: '/documents', icon: <FolderOpen size={18} /> },
      ],
    },
    {
      title: 'CONFIGURACIÓN',
      items: [
        { label: 'Empresas', href: '/settings/company', icon: <Settings size={18} /> },
        { label: 'Usuarios y Roles', href: '/settings/users', icon: <UserCheck size={18} /> },
        { label: 'Auditoría', href: '/settings/audit', icon: <ShieldCheck size={18} /> },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '18px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          }}
        >
          P
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', letterSpacing: '-0.01em' }}>
            PAGURO FINANCE
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Operating Core v1.0
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
        {navGroups.map((group) => (
          <div key={group.title} style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: '0.08em',
                padding: '0 12px 6px',
              }}
            >
              {group.title}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    marginBottom: '2px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-white)' : 'var(--text-muted)',
                    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid transparent',
                    transition: 'var(--transition-smooth)',
                  }}
                >
                  <span style={{ color: isActive ? 'var(--color-primary)' : 'inherit', display: 'flex' }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
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
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
          RLS Activo
        </span>
        <span className="badge badge-neutral" style={{ fontSize: '10px', padding: '2px 6px' }}>
          COP
        </span>
      </div>
    </aside>
  );
};

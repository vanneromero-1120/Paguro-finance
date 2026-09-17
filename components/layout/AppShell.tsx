'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { usePathname } from 'next/navigation';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompanyId, setActiveCompanyId] = useState<string>('c1111111-1111-1111-1111-111111111111');
  const pathname = usePathname();

  // If on login page, don't show dashboard shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Determine title from pathname
  const getPageTitle = () => {
    if (!pathname || pathname === '/' || pathname === '/dashboard') return 'Panel Financiero General';
    if (pathname.startsWith('/sales/invoices')) return 'Facturas de Venta & CxC';
    if (pathname.startsWith('/sales/customers')) return 'Directorio de Clientes';
    if (pathname.startsWith('/sales/payments')) return 'Gestión de Cobros & Pagos';
    if (pathname.startsWith('/purchases/expenses')) return 'Gastos Operativos & Compras';
    if (pathname.startsWith('/purchases/suppliers')) return 'Directorio de Proveedores';
    if (pathname.startsWith('/inventory/products')) return 'Catálogo de Productos';
    if (pathname.startsWith('/inventory/movements')) return 'Ledger de Movimientos de Inventario';
    if (pathname.startsWith('/taxes/iva')) return 'Gestión de IVA por Periodo Fiscal';
    if (pathname.startsWith('/reports')) return 'Informes & Reportes Financieros';
    if (pathname.startsWith('/documents')) return 'Repositorio Central de Documentos';
    if (pathname.startsWith('/settings/company')) return 'Configuración de Empresas';
    if (pathname.startsWith('/settings/users')) return 'Gestión de Usuarios & Roles';
    if (pathname.startsWith('/settings/audit')) return 'Bitácora de Auditoría Inmutable';
    return 'Paguro Finance';
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header
          activeCompanyId={activeCompanyId}
          onSelectCompany={setActiveCompanyId}
          title={getPageTitle()}
        />
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
};

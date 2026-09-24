'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { usePathname } from 'next/navigation';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompanyId, setActiveCompanyId] = useState<string>('c1111111-1111-1111-1111-111111111111');
  const pathname = usePathname();

  React.useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)paguro_active_company=([^;]+)/);
    if (match && match[1]) {
      setActiveCompanyId(decodeURIComponent(match[1]));
    }
  }, []);

  // If on login or auth pages, render plain layout
  if (
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/unauthorized'
  ) {
    return <>{children}</>;
  }

  // Determine title from V1 pathname
  const getPageTitle = () => {
    if (!pathname || pathname === '/' || pathname === '/dashboard') return 'Dashboard Financiero V1';
    if (pathname.startsWith('/movements')) return 'Movimientos Financieros Normalizados';
    if (pathname.startsWith('/documents')) return 'Ingesta Contable & Extracción IA';
    if (pathname.startsWith('/taxes')) return 'Operaciones Tributarias & IVA';
    if (pathname.startsWith('/obligations')) return 'Obligaciones & Calendario Fiscal';
    if (pathname.startsWith('/ai-advisor')) return 'Asesor Financiero & Tributario IA';
    if (pathname.startsWith('/integrations')) return 'Integraciones & Conectores';
    if (pathname.startsWith('/settings')) return 'Configuración & Perfil Tributario';
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

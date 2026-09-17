import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'Paguro Finance - Centralized Financial Management System',
  description: 'Enterprise financial management, multi-company accounting prep, IVA, payments, inventory ledger, and executive reporting for Paguro Corp.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

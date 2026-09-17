'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { logoutAction } from '@/lib/auth/actions';

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const requiredRole = searchParams.get('required');
  const currentRole = searchParams.get('current');
  const permission = searchParams.get('permission');

  const getExplanation = () => {
    if (reason === 'no_membership') {
      return 'Su usuario no está registrado como miembro activo de la empresa seleccionada. Contacte al Administrador del Sistema para solicitar acceso a esta entidad legal.';
    }
    if (reason === 'insufficient_role') {
      return `Su rol actual (${currentRole || 'No asignado'}) no posee los privilegios requeridos para esta sección. Rol mínimo requerido: ${requiredRole}.`;
    }
    if (reason === 'permission_denied') {
      return `Permiso denegado: Se requiere la capacidad [${permission}] para ejecutar esta operación financiera o consultar estos registros.`;
    }
    return 'No tiene autorización suficiente para acceder al recurso solicitado dentro del entorno multiempresa de Paguro Finance.';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '40px 32px',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.7)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-red)',
            marginBottom: '20px',
          }}
        >
          <ShieldAlert size={34} />
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '8px' }}>
          Acceso No Autorizado (403)
        </h1>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
          {getExplanation()}
        </p>

        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-dim)',
            marginBottom: '28px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Aislamiento de Seguridad Multi-Tenant
          </div>
          Paguro Finance restringe estrictamente el acceso a datos financieros y operativos en base a las membresías explícitas de cada empresa y la matriz de roles RBAC.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button
            variant="primary"
            onClick={() => router.push('/dashboard')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ArrowLeft size={16} /> Volver al Tablero Principal
          </Button>

          <Button
            variant="secondary"
            onClick={() => router.push('/settings/company')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Building2 size={16} /> Cambiar de Empresa Activa
          </Button>

          <form action={logoutAction} style={{ width: '100%', marginTop: '6px' }}>
            <Button
              type="submit"
              variant="secondary"
              style={{ width: '100%', justifyContent: 'center', color: 'var(--accent-red)' }}
            >
              <LogOut size={16} /> Cerrar Sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-app)',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          Verificando credenciales de autorización...
        </div>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}


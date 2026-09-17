'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { loginAction } from '@/lib/auth/actions';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    urlError === 'auth_callback_failed' ? 'El enlace de autenticación ha caducado o es inválido.' : null
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('returnTo', returnTo);

    try {
      const res = await loginAction(formData);
      if (res && !res.success && res.error) {
        setErrorMessage(res.error);
        setLoading(false);
      } else if (res && res.success) {
        window.location.href = res.redirectTo || returnTo;
      }
    } catch (err: any) {
      console.error('[Login] Unexpected submission error:', err);
      setErrorMessage(err?.message || 'Error al procesar el inicio de sesión.');
      setLoading(false);
    }
  };

  const handlePreset = async (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('Password123!');
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('email', presetEmail);
    formData.append('password', 'Password123!');
    formData.append('returnTo', returnTo);

    try {
      await loginAction(formData);
    } catch (err: any) {
      if (err?.message && !err.message.includes('NEXT_REDIRECT')) {
        setErrorMessage(err.message);
        setLoading(false);
      }
    }
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
        padding: '24px 20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px 32px',
          border: '1px solid var(--border-card)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '24px',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.45)',
              marginBottom: '14px',
            }}
          >
            P
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)' }}>
            Paguro Finance
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Sistema Centralizado de Control Financiero Multiempresa
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--accent-red)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form method="POST" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico Corporativo</label>
            <input
              type="email"
              required
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@pagurocorp.com"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Contraseña</label>
              <Link
                href="/forgot-password"
                style={{ fontSize: '11px', color: 'var(--accent-blue)', textDecoration: 'none' }}
              >
                ¿Olvidó su contraseña?
              </Link>
            </div>
            <input
              type="password"
              required
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{ marginTop: '6px' }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Iniciando Sesión...' : 'Ingresar al Sistema'}
          </Button>
        </form>

        {/* Quick Role Switcher Presets */}
        <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            Perfiles de Demostración & Auditoría
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Super Admin', email: 'superadmin@pagurocorp.com', desc: 'Control Total' },
              { label: 'Admin Financiero', email: 'admin@pagurocorp.com', desc: 'Gestión Completa' },
              { label: 'Finanzas / IVA', email: 'finance@pagurocorp.com', desc: 'Operación & Facturas' },
              { label: 'Contador Fiscal', email: 'accountant@pagurocorp.com', desc: 'Impuestos & Cierres' },
              { label: 'Operaciones', email: 'ops@pagurocorp.com', desc: 'Inventario & Stock' },
              { label: 'Auditor / Viewer', email: 'viewer@pagurocorp.com', desc: 'Solo Lectura' },
            ].map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => handlePreset(p.email)}
                disabled={loading}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: email === p.email ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: email === p.email ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                  color: email === p.email ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'var(--transition-smooth)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{p.label}</span>
                <span style={{ fontSize: '9.5px', color: 'var(--text-dim)' }}>{p.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
          Cargando portal de acceso...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}


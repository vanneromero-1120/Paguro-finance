'use client';

// ============================================================================
// Paguro Finance - Production Authentication Portal
// Secure Supabase Session Handling, Multi-Company Isolation & Enterprise Security
// ============================================================================

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
          maxWidth: '440px',
          padding: '40px 32px',
          border: '1px solid var(--border-card)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
        }}
      >
        {/* Brand Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.3)',
              marginBottom: '16px',
            }}
          >
            <Shield size={28} />
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-white)', letterSpacing: '-0.02em' }}>
            Paguro Finance
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Plataforma Integral de Gestión y Control Financiero
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: 'var(--color-danger)',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico Corporativo</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
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
              autoComplete="current-password"
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
            style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Iniciando Sesión...' : 'Ingresar al Sistema'}
          </Button>
        </form>

        {/* Security Assurance Footer */}
        <div
          style={{
            marginTop: '32px',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '16px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-dim)',
          }}
        >
          <span>Acceso cifrado de grado bancario (TLS 1.3 + JWT Supabase)</span>
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

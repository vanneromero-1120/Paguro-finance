'use client';

// ============================================================================
// Paguro Finance V1 - Official Production Authentication Portal
// Strict Paguro Brand Identity: Official Logo, Palette, Typography & Security
// ============================================================================

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, AlertCircle, ShieldCheck, Lock } from 'lucide-react';
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
      console.error('[Login] Submission error:', err);
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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle Background Brand Radial Glows */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 152, 255, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(231, 33, 117, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '430px',
          padding: '42px 34px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.75)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Official Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 18px',
              borderRadius: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '16px',
            }}
          >
            <Image
              src="/brand/paguro-icon.png"
              alt="Paguro Logo"
              width={54}
              height={54}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--text-white)',
              letterSpacing: '-0.02em',
            }}
          >
            PAGURO <span style={{ color: 'var(--paguro-blue)' }}>FINANCE</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Financial Intelligence & Tax Operations • V1.0
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
              placeholder="admin@pagurocorp.com"
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Contraseña</label>
              <Link
                href="/forgot-password"
                style={{ fontSize: '11px', color: 'var(--paguro-blue)', textDecoration: 'none' }}
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
            style={{
              width: '100%',
              marginTop: '8px',
              justifyContent: 'center',
              backgroundColor: 'var(--paguro-blue)',
              boxShadow: '0 4px 16px rgba(0, 152, 255, 0.35)',
              padding: '11px 16px',
            }}
            disabled={loading}
          >
            {loading ? 'Accediendo al Sistema...' : 'Ingresar a Paguro Finance'}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ShieldCheck size={14} color="var(--color-success)" />
          <span>Acceso seguro con aislamiento empresarial y RLS activo</span>
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
          Cargando portal de acceso Paguro Finance...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

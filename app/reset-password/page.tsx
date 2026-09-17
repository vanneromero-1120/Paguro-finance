'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { resetPasswordAction } from '@/lib/auth/actions';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError('La contraseña debe contener al menos 8 caracteres.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('password', password);
    formData.append('confirmPassword', confirmPassword);

    try {
      const res = await resetPasswordAction(formData);
      if (res.success) {
        setMessage(res.message || 'Contraseña actualizada con éxito.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(res.error || 'No se pudo actualizar la contraseña.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de comunicación.');
    } finally {
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
        padding: '20px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 32px',
          border: '1px solid var(--border-card)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-green)',
              marginBottom: '14px',
            }}
          >
            <Lock size={24} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Establecer Nueva Contraseña
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Defina una nueva clave de acceso segura para su cuenta en Paguro Finance.
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--accent-green)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '18px',
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{message} Redirigiendo al login...</span>
          </div>
        )}

        {error && (
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
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nueva Contraseña (mínimo 8 caracteres)</label>
            <input
              type="password"
              required
              minLength={8}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Guardando nueva clave...' : 'Actualizar Contraseña'}
          </Button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link
            href="/login"
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
            }}
          >
            Volver a Iniciar Sesión <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

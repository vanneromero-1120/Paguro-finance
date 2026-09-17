'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { forgotPasswordAction } from '@/lib/auth/actions';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('email', email);

    try {
      const res = await forgotPasswordAction(formData);
      if (res.success) {
        setMessage(res.message || 'Se ha enviado un enlace seguro para restablecer su contraseña.');
      } else {
        setError(res.error || 'Ocurrió un error al procesar la solicitud.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error de comunicación con el servicio de autenticación.');
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
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
              marginBottom: '14px',
            }}
          >
            <KeyRound size={24} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Recuperar Contraseña
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Ingrese su correo electrónico corporativo registrado para recibir el enlace de restablecimiento seguro.
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
            <span>{message}</span>
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
            <label className="form-label">Correo Electrónico Corporativo</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                placeholder="usuario@pagurocorp.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Enviando enlace...' : 'Enviar Enlace de Recuperación'}
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
            <ArrowLeft size={14} /> Volver al Inicio de Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

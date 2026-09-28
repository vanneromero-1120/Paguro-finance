'use client';

// ============================================================================
// Paguro Finance V1 - Integrations & Continuous Sync Engine Architecture
// Google Drive Continuous Sync, Status Management, Incremental Audit & Provenance
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Landmark,
  CreditCard,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Clock,
  RotateCcw,
  Zap,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  getIntegrationsAction,
  triggerSyncAction,
  triggerContinuousSyncAction,
  toggleAutoSyncAction,
  getSyncLogsAction,
} from '@/lib/actions/integrations';
import { IntegrationConnection, SyncLog, IntegrationStatus } from '@/types/v1-financial';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PROVIDERS' | 'SYNC_LOGS'>('PROVIDERS');
  const [togglingAutoSync, setTogglingAutoSync] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [intRes, logRes] = await Promise.all([
      getIntegrationsAction(),
      getSyncLogsAction(),
    ]);

    if (intRes.success && intRes.data) setIntegrations(intRes.data);
    if (logRes.success && logRes.data) setSyncLogs(logRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async (provider: string) => {
    setSyncingProvider(provider);
    const res = await triggerSyncAction(provider);
    if (res.message) {
      alert(res.message);
    }
    setSyncingProvider(null);
    loadData();
  };

  const handleSimulateContinuousSync = async () => {
    setSyncingProvider('GOOGLE_DRIVE_CONTINUOUS');
    const res = await triggerContinuousSyncAction('GOOGLE_DRIVE', {
      mode: 'AUTOMATIC_INCREMENTAL',
    });
    if (res.message) {
      alert(`[Sync Continuo Ejecutado]\n${res.message}`);
    }
    setSyncingProvider(null);
    loadData();
  };

  const handleToggleAutoSync = async (conn: IntegrationConnection) => {
    setTogglingAutoSync(true);
    const currentEnabled = conn.config?.auto_sync_enabled !== false;
    const res = await toggleAutoSyncAction(conn.provider, !currentEnabled, conn.config?.sync_interval_minutes || 15);
    if (res.message) {
      alert(res.message);
    }
    setTogglingAutoSync(false);
    loadData();
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case 'CONNECTED':
        return <span className="badge badge-success">Conectado</span>;
      case 'NEEDS_ATTENTION':
        return <span className="badge badge-warning">Requiere Atención</span>;
      case 'DISCONNECTED':
        return <span className="badge badge-danger">Desconectado</span>;
      case 'NOT_CONFIGURED':
      default:
        return <span className="badge badge-neutral">No Configurado</span>;
    }
  };

  const getProviderIcon = (category: string) => {
    switch (category) {
      case 'DOCUMENT_STORAGE':
        return <FolderOpen size={20} color="var(--paguro-blue)" />;
      case 'BANK':
        return <Landmark size={20} color="var(--color-warning)" />;
      case 'PAYMENT_PLATFORM':
        return <CreditCard size={20} color="var(--paguro-pink)" />;
      case 'NOTIFICATION':
      default:
        return <Bell size={20} color="var(--color-success)" />;
    }
  };

  const driveConnection = integrations.find((i) => i.provider === 'GOOGLE_DRIVE');
  const otherIntegrations = integrations.filter(
    (i) => i.provider !== 'GOOGLE_DRIVE' && i.provider !== 'AI_PROVIDER' && i.category !== 'AI'
  );

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Integraciones & Conectores de Datos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Sincronización continua de Google Drive, conciliación bancaria y fuentes autorizadas
          </p>
        </div>

        <Button variant="secondary" onClick={loadData}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar Estados</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'PROVIDERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('PROVIDERS')}
        >
          Proveedores & Conectores
        </button>
        <button
          className={`tab-btn ${activeTab === 'SYNC_LOGS' ? 'active' : ''}`}
          onClick={() => setActiveTab('SYNC_LOGS')}
        >
          Registro de Sincronizaciones (Auditoría)
        </button>
      </div>

      {activeTab === 'PROVIDERS' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SPECIAL CONTINUOUS GOOGLE DRIVE HERO CARD */}
          {driveConnection && (
            <div
              className="card"
              style={{
                border:
                  driveConnection.status === 'NEEDS_ATTENTION'
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(59, 130, 246, 0.3)',
                background:
                  driveConnection.status === 'NEEDS_ATTENTION'
                    ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(20, 24, 33, 0.95) 100%)'
                    : 'linear-gradient(180deg, rgba(59, 130, 246, 0.05) 0%, rgba(20, 24, 33, 0.95) 100%)',
                padding: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FolderOpen size={24} color="var(--paguro-blue)" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)' }}>
                        Google Drive • Carpeta Contable Paguro
                      </h2>
                      {getStatusBadge(driveConnection.status)}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Fuente documental primaria: Ingesta automática continua cada 15 minutos (Cambios API + Monitoreo Incremental).
                    </p>
                  </div>
                </div>

                {/* Automatic Sync State Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sincronización Automática:</span>
                  {driveConnection.config?.auto_sync_enabled !== false ? (
                    <span
                      className="badge badge-success"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px' }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-success)',
                          boxShadow: '0 0 8px var(--color-success)',
                        }}
                      />
                      <span>ACTIVA (Cada 15 min)</span>
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ padding: '5px 10px' }}>
                      PAUSADA
                    </span>
                  )}
                </div>
              </div>

              {/* Needs Attention Alert if OAuth Expired */}
              {driveConnection.status === 'NEEDS_ATTENTION' && (
                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={18} color="var(--color-warning)" />
                    <span style={{ fontSize: '12px', color: 'var(--color-warning)' }}>
                      {driveConnection.error_summary ||
                        'La autorización de Google Drive ha expirado. Reconecte para reanudar la ingesta automática.'}
                    </span>
                  </div>
                  <a
                    href="/api/auth/google"
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 12px', color: 'var(--color-warning)' }}
                  >
                    <RotateCcw size={13} />
                    <span>Reconectar Google Drive</span>
                  </a>
                </div>
              )}

              {/* Stat Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Archivos Descubiertos</div>
                  <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginTop: '4px' }}>
                    {driveConnection.config?.last_sync_stats?.filesDiscovered ?? '—'}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Archivos Actualizados</div>
                  <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--paguro-blue)', marginTop: '4px' }}>
                    {driveConnection.config?.last_sync_stats?.filesUpdated ?? '—'}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Requieren Revisión / Conflicto</div>
                  <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-warning)', marginTop: '4px' }}>
                    {driveConnection.config?.last_sync_stats?.filesRequiringReview ?? '—'}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Errores de Sincronización</div>
                  <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-danger)', marginTop: '4px' }}>
                    {driveConnection.config?.last_sync_stats?.syncErrors ?? 0}
                  </div>
                </div>
              </div>

              {/* Timing Metadata & Operational Controls */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)', marginRight: '6px' }}>Última Sincronización Exitosa:</span>
                    <strong style={{ color: 'var(--text-white)' }}>
                      {driveConnection.config?.last_successful_sync_at
                        ? new Date(driveConnection.config.last_successful_sync_at).toLocaleString('es-CO')
                        : driveConnection.last_sync_at
                        ? new Date(driveConnection.last_sync_at).toLocaleString('es-CO')
                        : 'Nunca'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-dim)', marginRight: '6px' }}>Próxima Sincronización Programada:</span>
                    <strong style={{ color: 'var(--paguro-blue)' }}>
                      {driveConnection.config?.auto_sync_enabled === false
                        ? 'En pausa'
                        : driveConnection.config?.next_scheduled_sync_at
                        ? new Date(driveConnection.config.next_scheduled_sync_at).toLocaleTimeString('es-CO')
                        : 'En ~15 min'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-dim)', marginRight: '6px' }}>Carpeta Monitoreada:</span>
                    <span style={{ color: 'var(--text-white)' }}>{driveConnection.config?.folder_name || 'Contabilidad'}</span>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    onClick={() => handleToggleAutoSync(driveConnection)}
                    disabled={togglingAutoSync}
                    style={{ fontSize: '12px' }}
                  >
                    {driveConnection.config?.auto_sync_enabled !== false ? (
                      <>
                        <Pause size={13} color="var(--color-warning)" />
                        <span>Pausar Auto-Sync</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} color="var(--color-success)" />
                        <span>Reanudar Auto-Sync</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleSimulateContinuousSync}
                    disabled={syncingProvider !== null}
                    style={{ fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                    title="Simular ejecución de sincronización continua sin esperar 15 minutos"
                  >
                    <Zap size={13} color="var(--paguro-blue)" />
                    <span>Simular Sync Continuo (Dev)</span>
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => handleSync(driveConnection.provider)}
                    disabled={syncingProvider !== null}
                    style={{ fontSize: '12px', backgroundColor: 'var(--paguro-blue)' }}
                  >
                    <RefreshCw
                      size={13}
                      className={syncingProvider === driveConnection.provider ? 'animate-spin' : ''}
                    />
                    <span>
                      {syncingProvider === driveConnection.provider
                        ? 'Sincronizando...'
                        : 'Ejecutar Sincronización'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* OTHER CONNECTORS GRID */}
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '10px' }}>
            Otros Canales de Ingesta & Pasarelas
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {otherIntegrations.map((item) => {
              const isSyncing = syncingProvider === item.provider;

              return (
                <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getProviderIcon(item.category)}
                      </div>
                      {getStatusBadge(item.status)}
                    </div>

                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)' }}>{item.name}</h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      {item.category} • {item.provider}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {item.provider === 'BANCOLOMBIA' &&
                        'Conexión bancaria API empresarial para extracción de extractos y movimientos.'}
                      {item.provider === 'STRIPE' &&
                        'Conciliación de cobros internacionales y cargos en USD/COP.'}
                      {item.provider === 'PAYPAL' &&
                        'Ingesta de pagos y transferencias internacionales de clientes.'}
                      {item.provider === 'MERCADO_PAGO' &&
                        'Pasarela de cobros por PSE y tarjetas de crédito locales.'}
                      {item.provider === 'WOMPI' &&
                        'Integración de pagos Bancolombia / Wompi para facturación.'}
                      {item.provider === 'NOTIFICATIONS_EMAIL' &&
                        'Alertas tempranas de vencimiento de obligaciones tributarias.'}
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px' }}>
                      <span>Última sinc:</span>
                      <span>
                        {item.last_sync_at
                          ? new Date(item.last_sync_at).toLocaleString('es-CO')
                          : 'Nunca sincronizado'}
                      </span>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => handleSync(item.provider)}
                      disabled={isSyncing}
                      style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                    >
                      <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                      <span>{isSyncing ? 'Sincronizando...' : 'Ejecutar Sincronización'}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SYNC LOGS TABLE */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Registros Analizados</th>
                  <th>Creados</th>
                  <th>Actualizados</th>
                  <th>Estado</th>
                  <th>Resumen / Error</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                      No hay registros de sincronización recientes.
                    </td>
                  </tr>
                ) : (
                  syncLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-white)' }}>{log.provider}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(log.sync_started_at).toLocaleTimeString('es-CO')}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {log.sync_finished_at
                          ? new Date(log.sync_finished_at).toLocaleTimeString('es-CO')
                          : 'En proceso'}
                      </td>
                      <td className="num-mono">{log.records_found}</td>
                      <td className="num-mono" style={{ color: 'var(--color-success)' }}>
                        +{log.records_created}
                      </td>
                      <td className="num-mono" style={{ color: 'var(--paguro-blue)' }}>
                        {log.records_updated}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            log.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'
                          }`}
                          style={{ fontSize: '9px' }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '280px' }}>
                        {log.error_summary || 'Ejecución exitosa sin errores.'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

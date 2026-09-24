'use client';

// ============================================================================
// Paguro Finance V1 - Integrations & Sync Engine Architecture
// Provider Abstractions, Real Connection States, Idempotent Sync & Audit Trail
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Network,
  FolderOpen,
  Landmark,
  CreditCard,
  BotMessageSquare,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  getIntegrationsAction,
  triggerSyncAction,
  getSyncLogsAction,
} from '@/lib/actions/integrations';
import { IntegrationConnection, SyncLog, IntegrationStatus } from '@/types/v1-financial';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PROVIDERS' | 'SYNC_LOGS'>('PROVIDERS');

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
      case 'AI':
        return <BotMessageSquare size={20} color="var(--paguro-blue)" />;
      case 'NOTIFICATION':
      default:
        return <Bell size={20} color="var(--color-success)" />;
    }
  };

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
            Fuentes de ingesta contable, pasarelas de pago, bancos y canales de notificación
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {integrations.map((item) => {
            const isSyncing = syncingProvider === item.provider;

            return (
              <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
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

                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>{item.name}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {item.category} • {item.provider}
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {item.provider === 'GOOGLE_DRIVE' &&
                      'Carpeta Contable Paguro: Ingesta incremental de facturas y documentos (Sep 2025 en adelante).'}
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
                    {item.provider === 'AI_PROVIDER' &&
                      'Motor de análisis semántico, extracción documental y Asesor IA.'}
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
                        {log.records_created}
                      </td>
                      <td className="num-mono" style={{ color: 'var(--paguro-blue)' }}>
                        {log.records_updated}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            log.status === 'COMPLETED'
                              ? 'badge-success'
                              : log.status === 'RUNNING'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                          style={{ fontSize: '9px' }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-dim)', maxWidth: '280px' }}>
                        {log.error_summary || 'Ejecución completada sin errores'}
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

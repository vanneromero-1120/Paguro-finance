'use client';

// ============================================================================
// Paguro Finance - Immutable Audit Trail Viewer
// Live Supabase audit_logs, multi-company isolated, append-only, read-only
// Zero mock-store dependencies
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Lock,
  RefreshCw,
  Eye,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getAuditLogsAction, EnrichedAuditLog } from '@/lib/actions/audit';
import { formatDateTime } from '@/lib/utils/formatters';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<EnrichedAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState<EnrichedAuditLog | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await getAuditLogsAction({
        search: searchTerm,
        action: actionFilter,
        entityType: entityFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 100,
      });

      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setErrorMessage(res.error || 'No fue posible cargar los registros de auditoría.');
      }
    } catch (err: any) {
      console.error('[AuditLogsPage] Fetch error:', err);
      setErrorMessage(err?.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAuditLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadAuditLogs]);

  const handleInspectDiff = (log: EnrichedAuditLog) => {
    setSelectedLog(log);
    setIsDiffModalOpen(true);
  };

  const getActionBadgeStyle = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'UPDATE':
      case 'ROLE_CHANGE':
      case 'STATUS_CHANGE':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'PAYMENT':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--color-primary)', border: 'rgba(59, 130, 246, 0.3)' };
      case 'DELETE':
      case 'VOID':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Bitácora de Auditoría Inmutable
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Registro criptográfico append-only de modificaciones financieras, pagos, roles, inventario y cierres fiscales.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '12px' }}>
            <Lock size={15} />
            <span style={{ fontWeight: 600 }}>Ledger Protegido RLS</span>
          </div>

          <Button
            variant="secondary"
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={loadAuditLogs}
            disabled={loading}
          >
            Refrescar
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: 'var(--color-danger)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={15}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', fontSize: '13px' }}
            placeholder="Buscar acción o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Action Filter */}
        <div>
          <select
            className="form-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ fontSize: '13px' }}
          >
            <option value="all">Todas las acciones</option>
            <option value="CREATE">CREATE (Creación)</option>
            <option value="UPDATE">UPDATE (Actualización)</option>
            <option value="PAYMENT">PAYMENT (Pago aplicado)</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE (Cambio de rol)</option>
            <option value="STATUS_CHANGE">STATUS_CHANGE (Estado)</option>
            <option value="CLOSE_PERIOD">CLOSE_PERIOD (Cierre fiscal)</option>
          </select>
        </div>

        {/* Entity Filter */}
        <div>
          <select
            className="form-select"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={{ fontSize: '13px' }}
          >
            <option value="all">Todas las entidades</option>
            <option value="invoice">Facturas de Venta</option>
            <option value="payment">Recibos de Pago</option>
            <option value="customer">Clientes</option>
            <option value="supplier">Proveedores</option>
            <option value="product">Productos</option>
            <option value="inventory">Movimientos de Stock</option>
            <option value="purchase">Compras</option>
            <option value="expense">Gastos</option>
            <option value="tax_period">Periodos Fiscales / IVA</option>
            <option value="company">Empresa / Parámetros</option>
            <option value="company_user">Membresías & Roles</option>
            <option value="document">Documentos & Archivos</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <input
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ fontSize: '13px' }}
            title="Fecha Desde"
          />
        </div>

        {/* Date To */}
        <div>
          <input
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ fontSize: '13px' }}
            title="Fecha Hasta"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading && logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '14px' }}>Cargando bitácora de auditoría autorizada...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <ShieldCheck size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
              No se encontraron registros de auditoría
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
              Los eventos y mutaciones financieras del sistema se registrarán de forma automática e inalterable.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha & Hora</th>
                  <th>Actor / Usuario</th>
                  <th>Acción</th>
                  <th>Entidad Afectada</th>
                  <th>ID de Registro</th>
                  <th style={{ textAlign: 'right' }}>Diferencial</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const badge = getActionBadgeStyle(log.action);
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={14} style={{ color: 'var(--text-dim)' }} />
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)' }}>
                              {log.user_name}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                              {log.user_email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-white)' }}>
                        {log.entity_type}
                      </td>
                      <td className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {log.entity_id ? `${log.entity_id.slice(0, 13)}...` : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye size={13} />}
                          onClick={() => handleInspectDiff(log)}
                        >
                          Ver Diff
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Diff Inspection */}
      <Modal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        title="Detalle Criptográfico de Auditoría"
      >
        {selectedLog && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'var(--bg-card-elevated)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Acción: </span>
                <strong style={{ color: 'var(--text-white)' }}>{selectedLog.action}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Entidad: </span>
                <strong style={{ color: 'var(--text-white)' }}>{selectedLog.entity_type}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Actor: </span>
                <strong style={{ color: 'var(--text-white)' }}>{selectedLog.user_name}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Fecha: </span>
                <span style={{ color: 'var(--text-muted)' }}>{formatDateTime(selectedLog.created_at)}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-dim)' }}>ID Registro: </span>
                <span className="num-mono" style={{ color: 'var(--text-white)' }}>{selectedLog.entity_id}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedLog.before_json ? '1fr 1fr' : '1fr', gap: '12px' }}>
              {selectedLog.before_json && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-danger)', marginBottom: '6px' }}>
                    ESTADO ANTERIOR (BEFORE)
                  </div>
                  <pre
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      padding: '10px',
                      borderRadius: '6px',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      color: '#fca5a5',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    {JSON.stringify(selectedLog.before_json, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-success)', marginBottom: '6px' }}>
                  ESTADO RESULTANTE (AFTER)
                </div>
                <pre
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    padding: '10px',
                    borderRadius: '6px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    color: '#86efac',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                >
                  {JSON.stringify(selectedLog.after_json, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Button variant="secondary" onClick={() => setIsDiffModalOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_AUDIT_LOGS } from '@/lib/supabase/mock-store';
import { formatDateTime } from '@/lib/utils/formatters';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState(INITIAL_AUDIT_LOGS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Bitácora de Auditoría Inmutable
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Registro cronológico append-only de modificaciones financieras, pagos, roles y cierres fiscales.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '12px' }}>
          <Lock size={16} />
          <span>Ledger Protegido contra Escritura</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', maxWidth: '360px', position: 'relative' }}>
        <Search
          size={16}
          color="var(--text-dim)"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '38px' }}
          placeholder="Buscar por acción o entidad..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha & Hora</th>
              <th>Acción Ejecutada</th>
              <th>Entidad Afectada</th>
              <th>ID del Registro</th>
              <th>Contexto / IP</th>
              <th>Diferencial de Estado (JSON)</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {formatDateTime(log.created_at)}
                </td>
                <td>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor:
                        log.action === 'CREATE'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : log.action === 'PAYMENT'
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        log.action === 'CREATE'
                          ? 'var(--color-success)'
                          : log.action === 'PAYMENT'
                          ? 'var(--color-primary)'
                          : '#fbbf24',
                    }}
                  >
                    {log.action}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{log.entity_type}</td>
                <td className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {log.entity_id}
                </td>
                <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {log.ip_or_context || 'Next.js Server Action'}
                </td>
                <td>
                  <pre
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      maxWidth: '350px',
                      overflowX: 'auto',
                      color: '#a7f3d0',
                    }}
                  >
                    {JSON.stringify(log.after_json || log.before_json, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { FolderOpen, FileText, Upload, Download, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_DOCUMENTS } from '@/lib/supabase/mock-store';
import { DocumentAttachment } from '@/types/database';
import { formatDateTime } from '@/lib/utils/formatters';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentAttachment[]>(INITIAL_DOCUMENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Form state
  const [fileName, setFileName] = useState('');
  const [entityType, setEntityType] = useState('sales_invoice');

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName) return;

    const newDoc: DocumentAttachment = {
      id: `doc-${Date.now()}`,
      company_id: 'c1111111-1111-1111-1111-111111111111',
      entity_type: entityType,
      entity_id: `ent-${Date.now()}`,
      storage_path: `c1111111-1111-1111-1111-111111111111/${entityType}/${fileName}`,
      file_name: fileName,
      mime_type: 'application/pdf',
      file_size_bytes: 204800,
      version: 1,
      status: 'active',
      uploaded_at: new Date().toISOString(),
    };

    setDocuments([newDoc, ...documents]);
    setIsUploadOpen(false);
    setFileName('');
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch = d.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter === 'all') return true;
    return d.entity_type === typeFilter;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Repositorio Central de Documentos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Archivos protegidos en Supabase Storage (PDFs de facturas, soportes de pago y certificados tributarios).
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Upload size={16} />}
          onClick={() => setIsUploadOpen(true)}
        >
          Cargar Soporte
        </Button>
      </div>

      {/* Security Storage Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '12px',
          color: '#34d399',
        }}
      >
        <ShieldCheck size={18} />
        <span>
          <strong>Almacenamiento Seguro:</strong> Los archivos residen en el bucket privado <code>financial-documents</code> y se acceden exclusivamente mediante URLs firmadas con vencimiento temporal.
        </span>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '360px' }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Buscar por nombre de archivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'sales_invoice', label: 'Facturas de Venta' },
            { id: 'purchase_document', label: 'Soportes de Compra' },
            { id: 'payment', label: 'Comprobantes de Pago' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setTypeFilter(pill.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: typeFilter === pill.id ? 600 : 400,
                backgroundColor: typeFilter === pill.id ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                color: typeFilter === pill.id ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre de Archivo</th>
              <th>Módulo Asociado</th>
              <th>Tamaño</th>
              <th>Versión</th>
              <th>Fecha de Carga</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={18} color="var(--color-primary)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {doc.file_name}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                    {doc.entity_type}
                  </span>
                </td>
                <td className="num-mono" style={{ fontSize: '12px' }}>
                  {(doc.file_size_bytes / 1024).toFixed(0)} KB
                </td>
                <td className="num-mono" style={{ fontSize: '12px' }}>
                  v{doc.version}
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {formatDateTime(doc.uploaded_at)}
                </td>
                <td>
                  <Badge status={doc.status} />
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={() => alert(`Generando URL firmada para ${doc.file_name}...`)}
                  >
                    Descargar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Upload Document */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Subir Nuevo Soporte Digital"
      >
        <form onSubmit={handleUpload}>
          <div className="form-group">
            <label className="form-label">Tipo de Entidad Asociada *</label>
            <select
              className="form-select"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="sales_invoice">Factura de Venta</option>
              <option value="purchase_document">Soporte de Compra / Gasto</option>
              <option value="payment">Comprobante de Pago</option>
              <option value="tax_period">Certificado de Retención / Tributario</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre del Archivo *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. Factura_Proveedor_001.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </div>

          <div
            style={{
              padding: '30px',
              border: '2px dashed var(--border-card)',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: 'rgba(255,255,255,0.01)',
              marginBottom: '20px',
            }}
          >
            <Upload size={32} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Arrastre y suelte su archivo PDF, PNG o JPG aquí
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Tamaño máximo por archivo: 25 MB
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsUploadOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar en Storage
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

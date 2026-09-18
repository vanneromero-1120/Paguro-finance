// ============================================================================
// Paguro Finance - Central Documents Repository
// Real Supabase data, Private Storage, Signed URLs, Role-aware, Zero mock-store
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Download,
  Search,
  ShieldCheck,
  Archive,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  Tag,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  DocumentAttachment,
  DocumentEntityType,
  AttachableEntity,
} from '@/types/database';
import { formatDateTime } from '@/lib/utils/formatters';
import {
  getDocumentsAction,
  uploadDocumentAction,
  getDocumentDownloadUrlAction,
  archiveDocumentAction,
  getAttachableEntitiesAction,
} from '@/lib/actions/documents';
import { createClient } from '@/lib/supabase/client';

export default function DocumentsPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const canUpload = userRole ? ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(userRole) : false;

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: membership } = await supabase
        .from('company_users')
        .select('role')
        .eq('user_id', user.id)
        .in('status', ['active', 'ACTIVE'])
        .maybeSingle();
      if (membership) {
        setUserRole(membership.role);
      }
    });
  }, []);

  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<DocumentEntityType>('sales_invoice');
  const [entityId, setEntityId] = useState('');
  const [notes, setNotes] = useState('');
  const [attachableEntities, setAttachableEntities] = useState<AttachableEntity[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Archive Modal State
  const [docToArchive, setDocToArchive] = useState<DocumentAttachment | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fetch documents
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDocumentsAction({
        entity_type: entityTypeFilter,
        status: statusFilter,
        search: searchTerm,
      });
      if (res.success && res.data) {
        setDocuments(res.data);
      } else {
        setError(res.error || 'Error al cargar documentos.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al cargar documentos.');
    } finally {
      setLoading(false);
    }
  }, [entityTypeFilter, statusFilter, searchTerm]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load attachable entities when modal opens or entityType changes
  useEffect(() => {
    if (!isUploadOpen) return;
    let isCancelled = false;
    setLoadingEntities(true);
    setEntityId('');

    getAttachableEntitiesAction(entityType)
      .then((res) => {
        if (!isCancelled && res.success && res.data) {
          setAttachableEntities(res.data);
          if (res.data.length > 0) {
            setEntityId(res.data[0].id);
          }
        }
      })
      .finally(() => {
        if (!isCancelled) setLoadingEntities(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isUploadOpen, entityType]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setUploadError(`Tipo de archivo (${file.type}) no permitido. Utilice PDF, JPG o PNG.`);
        setSelectedFile(null);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setUploadError(`El archivo supera los 15 MB permitidos (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
        setSelectedFile(null);
        return;
      }
      setUploadError(null);
      setSelectedFile(file);
    }
  };

  // Submit upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Debe seleccionar un archivo para cargar.');
      return;
    }
    if (!entityId) {
      setUploadError('Debe asociar el documento a un registro.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('notes', notes);

    try {
      const res = await uploadDocumentAction(formData);
      if (res.success) {
        setUploadSuccess('Documento resguardado exitosamente.');
        setTimeout(() => {
          setIsUploadOpen(false);
          setSelectedFile(null);
          setNotes('');
          setUploadSuccess(null);
          loadDocuments();
        }, 1200);
      } else {
        setUploadError(res.error || 'Error al cargar el documento.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error inesperado durante la carga.');
    } finally {
      setUploading(false);
    }
  };

  // Download / View file via signed URL
  const handleDownload = async (doc: DocumentAttachment) => {
    setDownloadingId(doc.id);
    try {
      const res = await getDocumentDownloadUrlAction(doc.id);
      if (res.success && res.data?.signed_url) {
        window.open(res.data.signed_url, '_blank', 'noopener,noreferrer');
      } else {
        alert(res.error || 'Error al obtener enlace seguro.');
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Archive document
  const handleArchiveConfirm = async () => {
    if (!docToArchive) return;
    setArchiving(true);
    try {
      const res = await archiveDocumentAction(docToArchive.id);
      if (res.success) {
        setDocToArchive(null);
        loadDocuments();
      } else {
        alert(res.error || 'Error al archivar documento.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al archivar documento.');
    } finally {
      setArchiving(false);
    }
  };

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'sales_invoice':
        return <Badge variant="info">Factura Venta</Badge>;
      case 'purchase_document':
      case 'expense':
        return <Badge variant="warning">Factura Gasto</Badge>;
      case 'payment':
        return <Badge variant="success">Soporte Pago</Badge>;
      case 'customer':
        return <Badge variant="neutral">Cliente</Badge>;
      case 'supplier':
        return <Badge variant="neutral">Proveedor</Badge>;
      case 'tax_period':
        return <Badge variant="info">Cert. Tributario</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText size={20} color="#ef4444" />;
    if (mime.includes('image')) return <ImageIcon size={20} color="#3b82f6" />;
    return <FileSpreadsheet size={20} color="#10b981" />;
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)' }}>
            Repositorio Central de Documentos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Archivos protegidos en Supabase Storage (PDFs de facturas, soportes de pago y certificados tributarios).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" icon={<RefreshCw size={15} />} onClick={loadDocuments} disabled={loading}>
            Actualizar
          </Button>

          {canUpload && (
            <Button
              variant="primary"
              icon={<Upload size={16} />}
              onClick={() => {
                setUploadError(null);
                setUploadSuccess(null);
                setSelectedFile(null);
                setNotes('');
                setIsUploadOpen(true);
              }}
            >
              Cargar Soporte
            </Button>
          )}
        </div>
      </div>

      {/* Security Storage Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#34d399',
        }}
      >
        <ShieldCheck size={20} style={{ flexShrink: 0 }} />
        <span>
          <strong>Almacenamiento Privado y Cifrado:</strong> Los archivos residen en el bucket privado <code>financial-documents</code> bajo políticas estrictas de RLS por empresa. El acceso se realiza exclusivamente mediante URLs firmadas temporales con expiración de 60 segundos.
        </span>
      </div>

      {/* Search & Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', width: '340px' }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o nota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-white)',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-white)',
              fontSize: '13px',
            }}
          >
            <option value="all">Todas las Entidades</option>
            <option value="sales_invoice">Facturas de Venta</option>
            <option value="purchase_document">Facturas de Gasto</option>
            <option value="payment">Soportes de Pago</option>
            <option value="customer">Clientes</option>
            <option value="supplier">Proveedores</option>
            <option value="tax_period">Certificados IVA</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-white)',
              fontSize: '13px',
            }}
          >
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
            <option value="all">Todos los Estados</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Documents Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Documento</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Asociado a</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Tamaño</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Fecha de Carga</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Cargado por</th>
              <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                  <p>Cargando documentos de almacenamiento privado...</p>
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Paperclip size={36} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '15px' }}>
                    No se encontraron documentos
                  </p>
                  <p style={{ fontSize: '13px', marginTop: '4px' }}>
                    {canUpload
                      ? 'Haga clic en "Cargar Soporte" para adjuntar archivos seguros a sus transacciones.'
                      : 'No hay documentos disponibles para los filtros seleccionados.'}
                  </p>
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr
                  key={doc.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Name & Note */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getFileIcon(doc.mime_type)}
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                          {doc.file_name}
                        </div>
                        {doc.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {doc.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Associated Entity */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {getEntityBadge(doc.entity_type)}
                    </div>
                  </td>

                  {/* File Size */}
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                    {doc.file_size_bytes < 1024 * 1024
                      ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB`
                      : `${(doc.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`}
                  </td>

                  {/* Date */}
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                    {formatDateTime(doc.uploaded_at)}
                  </td>

                  {/* Uploader */}
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                    {doc.uploader_name || 'Sistema'}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Download size={14} />}
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                      >
                        {downloadingId === doc.id ? 'Descargando...' : 'Ver / Descargar'}
                      </Button>

                      {canUpload && doc.status === 'active' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Archive size={14} />}
                          onClick={() => setDocToArchive(doc)}
                          title="Archivar soporte"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Upload Document */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => {
          if (!uploading) setIsUploadOpen(false);
        }}
        title="Cargar Soporte Financiero a Supabase Storage"
      >
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {uploadError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f87171',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#34d399',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {/* Entity Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Tipo de Registro a Vincular
            </label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as DocumentEntityType)}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-white)',
                fontSize: '13px',
              }}
            >
              <option value="sales_invoice">Factura de Venta</option>
              <option value="purchase_document">Factura de Gasto / Proveedor</option>
              <option value="payment">Soporte de Pago</option>
              <option value="customer">Expediente de Cliente</option>
              <option value="supplier">Expediente de Proveedor</option>
              <option value="tax_period">Certificado de Periodo Tributario</option>
            </select>
          </div>

          {/* Target Entity Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Registro Específico
            </label>
            {loadingEntities ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                Consultando registros disponibles...
              </div>
            ) : attachableEntities.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#fbbf24', padding: '8px 0' }}>
                No hay registros disponibles de este tipo para asociar.
              </div>
            ) : (
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-white)',
                  fontSize: '13px',
                }}
              >
                {attachableEntities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.label} {ent.sublabel ? `— ${ent.sublabel}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* File Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Archivo (PDF, JPG, PNG - Máx. 15 MB)
            </label>
            <div
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <Upload size={28} color="var(--text-dim)" style={{ marginBottom: '8px' }} />
              {selectedFile ? (
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--brand-primary)', fontSize: '13px' }}>
                    {selectedFile.name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-white)', fontWeight: 500 }}>
                    Haga clic aquí para seleccionar el archivo
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Formatos seguros: PDF, JPEG, PNG
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Notas u Observaciones (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploading}
              rows={2}
              placeholder="Ej: Factura electrónica firmada con CUFE..."
              style={{
                width: '100%',
                padding: '9px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-white)',
                fontSize: '13px',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsUploadOpen(false)}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={uploading || !selectedFile || !entityId}
              icon={uploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
            >
              {uploading ? 'Cargando a Storage...' : 'Subir Archivo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Archive */}
      <Modal
        isOpen={!!docToArchive}
        onClose={() => {
          if (!archiving) setDocToArchive(null);
        }}
        title="Confirmar Archivo de Soporte"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            ¿Está seguro de que desea archivar el documento{' '}
            <strong style={{ color: 'var(--text-white)' }}>{docToArchive?.file_name}</strong>?
            El archivo permanecerá resguardado en el bucket privado pero no aparecerá en la lista activa estándar.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDocToArchive(null)}
              disabled={archiving}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={handleArchiveConfirm}
              disabled={archiving}
            >
              {archiving ? 'Archivando...' : 'Archivar Documento'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

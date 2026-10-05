'use client';

// ============================================================================
// Paguro Finance V1 - Documents Intelligence & Google Drive Pipeline Page
// Pipeline Statuses, AI Extraction, Human Review Queue, Link/Unlink to Movements
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  FileText,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Link as LinkIcon,
  Unlink,
  Eye,
  RefreshCw,
  Clock,
  Layers,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  getAccountingDocumentsAction,
  extractDocumentDataAction,
  reviewAndCorrectDocumentAction,
  linkDocumentToMovementAction,
  unlinkDocumentFromMovementAction,
  resolveDocumentConflictAction,
  getDocumentPreviewUrlAction,
  getCurrentUserDocumentPermissionsAction,
} from '@/lib/actions/documents-v1';
import { getFinancialMovementsAction } from '@/lib/actions/movements';
import {
  AccountingDocument,
  DocumentPipelineStatus,
  AccountingDocumentType,
  FinancialMovement,
} from '@/types/v1-financial';

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'REVIEW_QUEUE' | 'MATCHED'>('ALL');
  const [documents, setDocuments] = useState<AccountingDocument[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Review Modal State
  const [selectedDoc, setSelectedDoc] = useState<AccountingDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Document Preview State
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // User Permissions
  const [canValidate, setCanValidate] = useState(true);
  const [userRole, setUserRole] = useState<string>('ADMIN');

  // Link Movement Modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [targetDocId, setTargetDocId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string>('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const filterStatus =
      activeTab === 'REVIEW_QUEUE'
        ? 'REQUIRES_REVIEW'
        : activeTab === 'MATCHED'
        ? 'MATCHED'
        : statusFilter !== 'ALL'
        ? (statusFilter as DocumentPipelineStatus)
        : undefined;

    const res = await getAccountingDocumentsAction({
      pipeline_status: filterStatus,
      search: search || undefined,
    });

    if (res.success && res.data) {
      setDocuments(res.data);
    }
    setLoading(false);
  }, [activeTab, statusFilter, search]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    getCurrentUserDocumentPermissionsAction().then((res) => {
      if (res.success && res.data) {
        setCanValidate(res.data.canValidate);
        setUserRole(res.data.role);
      }
    });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDocuments();
  };

  const handleViewDocument = async (doc: AccountingDocument) => {
    setPreviewError(null);
    setPreviewLoadingId(doc.id);
    try {
      const res = await getDocumentPreviewUrlAction(doc.id);
      if (!res.success || !res.data?.url) {
        setPreviewError(res.error || 'No se pudo generar la vista previa del documento.');
        return;
      }
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setPreviewError(err.message || 'Error al abrir el documento.');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleOpenReview = (doc: AccountingDocument) => {
    setSelectedDoc(doc);
    setEditingDoc({
      document_type: doc.document_type || 'SUPPLIER_INVOICE',
      invoice_number: doc.invoice_number || '',
      document_date: doc.document_date || new Date().toISOString().split('T')[0],
      counterparty_name: doc.counterparty_name || '',
      counterparty_tax_id: doc.counterparty_tax_id || '',
      subtotal: doc.subtotal || 0,
      tax_iva: doc.tax_iva || 0,
      tax_withholding: doc.tax_withholding || 0,
      total_amount: doc.total_amount || 0,
      review_notes: doc.review_notes || '',
    });
  };

  const handleExtractWithAi = async () => {
    if (!selectedDoc) return;
    setExtracting(true);
    const res = await extractDocumentDataAction(selectedDoc.id);
    if (res.success && res.data) {
      setSelectedDoc(res.data);
      setEditingDoc({
        document_type: res.data.document_type,
        invoice_number: res.data.invoice_number || '',
        document_date: res.data.document_date || '',
        counterparty_name: res.data.counterparty_name || '',
        counterparty_tax_id: res.data.counterparty_tax_id || '',
        subtotal: res.data.subtotal || 0,
        tax_iva: res.data.tax_iva || 0,
        tax_withholding: res.data.tax_withholding || 0,
        total_amount: res.data.total_amount || 0,
        review_notes: res.data.review_notes || '',
      });
      loadDocuments();
    }
    setExtracting(false);
  };

  const handleSaveCorrection = async () => {
    if (!selectedDoc || !editingDoc) return;
    setSavingReview(true);
    const res = await reviewAndCorrectDocumentAction(selectedDoc.id, {
      ...editingDoc,
      pipeline_status: 'ACCEPTED',
    });
    if (res.success) {
      setSelectedDoc(null);
      loadDocuments();
    } else {
      alert(res.error || 'Error al guardar revisión.');
    }
    setSavingReview(false);
  };

  const handleResolveConflict = async (resolution: 'KEEP_HUMAN_VERIFIED' | 'ACCEPT_DRIVE_SOURCE') => {
    if (!selectedDoc) return;
    setSavingReview(true);
    const res = await resolveDocumentConflictAction(selectedDoc.id, resolution);
    if (res.success && res.data) {
      setSelectedDoc(res.data);
      loadDocuments();
      alert(res.message);
    } else {
      alert(res.error || 'Error al resolver el conflicto.');
    }
    setSavingReview(false);
  };

  const handleOpenLinkModal = async (docId: string) => {
    setTargetDocId(docId);
    setIsLinkModalOpen(true);
    const movRes = await getFinancialMovementsAction({ limit: 30 });
    if (movRes.success && movRes.data) {
      setMovements(movRes.data);
    }
  };

  const handleConfirmLink = async () => {
    if (!targetDocId || !selectedMovementId) return;
    await linkDocumentToMovementAction(targetDocId, selectedMovementId);
    setIsLinkModalOpen(false);
    setTargetDocId(null);
    setSelectedMovementId('');
    loadDocuments();
  };

  const handleUnlink = async (docId: string) => {
    if (!confirm('¿Desea desvincular este documento del movimiento financiero?')) return;
    await unlinkDocumentFromMovementAction(docId);
    loadDocuments();
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
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Ingesta Documental & Extracción IA</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Pipeline contable: Google Drive → Clasificación → Extracción IA → Validación Humana → Movimiento
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            onClick={loadDocuments}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refrescar</span>
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          Todos los Documentos
        </button>
        <button
          className={`tab-btn ${activeTab === 'REVIEW_QUEUE' ? 'active' : ''}`}
          onClick={() => setActiveTab('REVIEW_QUEUE')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>Cola de Revisión Humana</span>
          <span className="badge badge-brand-pink" style={{ fontSize: '9px' }}>
            Requiere Atención
          </span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'MATCHED' ? 'active' : ''}`}
          onClick={() => setActiveTab('MATCHED')}
        >
          Vinculados a Movimientos
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 240px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nombre de archivo, NIT o emisor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" type="submit">
            <Search size={16} />
          </Button>
        </form>

        <div style={{ width: '200px' }}>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Cualquier Estado Pipeline</option>
            <option value="DISCOVERED">Descubierto (Drive)</option>
            <option value="EXTRACTED">Extraído por IA</option>
            <option value="REQUIRES_REVIEW">Requiere Revisión</option>
            <option value="MATCHED">Vinculado</option>
            <option value="ACCEPTED">Aceptado</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Archivo / Soporte</th>
                <th>Tipo Documental</th>
                <th>Fecha</th>
                <th>Emisor / Proveedor</th>
                <th>Confianza IA</th>
                <th>Estado Pipeline</th>
                <th style={{ textAlign: 'right' }}>Total (COP)</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Cargando documentos contables...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No se encontraron documentos contables con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="var(--paguro-blue)" />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{doc.file_name}</span>
                            {doc.conflict_details && (
                              <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                Conflicto Drive
                              </span>
                            )}
                            {doc.source_status === 'SOURCE_MISSING' && (
                              <span className="badge badge-danger" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                Retirado de Drive
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            {doc.invoice_number && <span>No: {doc.invoice_number}</span>}
                            {doc.drive_folder_path && <span>📁 {doc.drive_folder_path}</span>}
                            <span style={{ color: doc.provenance === 'USER_VERIFIED' ? 'var(--color-success)' : 'var(--text-dim)' }}>
                              {doc.provenance === 'USER_VERIFIED' ? '✓ Verificado' : '• Google Drive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        {doc.document_type || 'SOPORTE'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {doc.document_date || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-white)' }}>
                      {doc.counterparty_name || '—'}
                      {doc.counterparty_tax_id && (
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>NIT: {doc.counterparty_tax_id}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className="num-mono"
                        style={{
                          fontWeight: 700,
                          fontSize: '12px',
                          color:
                            doc.confidence_score >= 0.85
                              ? 'var(--color-success)'
                              : doc.confidence_score >= 0.6
                              ? 'var(--color-warning)'
                              : 'var(--text-dim)',
                        }}
                      >
                        {doc.confidence_score ? `${(doc.confidence_score * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          doc.pipeline_status === 'MATCHED'
                            ? 'badge-success'
                            : doc.pipeline_status === 'REQUIRES_REVIEW'
                            ? 'badge-warning'
                            : doc.pipeline_status === 'EXTRACTED'
                            ? 'badge-brand-blue'
                            : 'badge-neutral'
                        }`}
                        style={{ fontSize: '9px' }}
                      >
                        {doc.pipeline_status}
                      </span>
                    </td>
                    <td className="num-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                      {doc.total_amount ? `$${doc.total_amount.toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {/* A) Ver Documento Original */}
                        <button
                          onClick={() => handleViewDocument(doc)}
                          disabled={previewLoadingId === doc.id}
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Ver documento original (PDF/soporte)"
                        >
                          <ExternalLink size={12} color="var(--paguro-blue)" />
                          <span>{previewLoadingId === doc.id ? 'Abriendo...' : 'Ver documento'}</span>
                        </button>

                        {/* B) Revisar y Validar Metadatos */}
                        <button
                          onClick={() => handleOpenReview(doc)}
                          className="btn btn-secondary"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Abrir modal de validación humana"
                        >
                          <Eye size={12} />
                          <span>Revisar</span>
                        </button>

                        {doc.financial_movement_id ? (
                          <button
                            onClick={() => handleUnlink(doc.id)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)' }}
                            title="Desvincular movimiento"
                          >
                            <Unlink size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenLinkModal(doc.id)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--paguro-blue)' }}
                            title="Vincular a movimiento financiero"
                          >
                            <LinkIcon size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVIEW & CORRECTION MODAL */}
      {selectedDoc && editingDoc && (
        <Modal
          isOpen={!!selectedDoc}
          onClose={() => {
            setSelectedDoc(null);
            setPreviewError(null);
          }}
          title={`Validación Humana • ${selectedDoc.file_name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Top Bar: Ver Documento Original */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--paguro-blue)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-white)' }}>
                    {selectedDoc.file_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {selectedDoc.drive_folder_path
                      ? `📁 ${selectedDoc.drive_folder_path}`
                      : 'Soporte Contable Registrado'}
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={() => handleViewDocument(selectedDoc)}
                disabled={previewLoadingId === selectedDoc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  borderColor: 'rgba(59, 130, 246, 0.4)',
                }}
              >
                <ExternalLink size={13} color="var(--paguro-blue)" />
                <span>
                  {previewLoadingId === selectedDoc.id ? 'Abriendo...' : 'Ver documento original'}
                </span>
              </Button>
            </div>

            {/* Preview Error Banner if any */}
            {previewError && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--color-danger)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={14} />
                <span>{previewError}</span>
              </div>
            )}

            {/* Read-Only Notice for VIEWER role */}
            {!canValidate && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: 'var(--paguro-blue)',
                  fontSize: '12px',
                }}
              >
                <strong>Modo Solo Lectura (VIEWER):</strong> Su rol tiene permiso para visualizar el documento original y sus valores extraídos, pero no está autorizado para validar o modificar registros contables.
              </div>
            )}
            {/* Conflict Detection Banner: SOURCE_CHANGED_AFTER_VERIFICATION */}
            {selectedDoc.conflict_details && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  color: 'var(--text-white)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <AlertTriangle size={16} color="var(--color-danger)" />
                  <strong style={{ fontSize: '13px', color: 'var(--color-danger)' }}>
                    Conflicto Detectado: SOURCE_CHANGED_AFTER_VERIFICATION
                  </strong>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Este documento fue modificado en Google Drive tras haber sido verificado manualmente. Por seguridad contable, los datos verificados no se sobreescribieron. Seleccione una acción de resolución:
                </p>

                <div
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '12px',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1fr',
                      gap: '8px',
                      fontWeight: 600,
                      color: 'var(--text-dim)',
                      marginBottom: '6px',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>Campo</span>
                    <span>Valor Verificado Anterior</span>
                    <span style={{ color: 'var(--paguro-blue)' }}>Nuevo Valor en Drive</span>
                  </div>
                  {selectedDoc.conflict_details.changed_fields?.map((field: string) => (
                    <div
                      key={field}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1fr 1fr',
                        gap: '8px',
                        padding: '5px 0',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>{field}</span>
                      <span style={{ color: 'var(--color-success)' }}>
                        {String(selectedDoc.conflict_details?.previous_values?.[field] ?? '—')}
                      </span>
                      <span style={{ color: 'var(--paguro-blue)', fontWeight: 600 }}>
                        {String(selectedDoc.conflict_details?.new_extracted_values?.[field] ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <Button
                    variant="secondary"
                    onClick={() => handleResolveConflict('KEEP_HUMAN_VERIFIED')}
                    disabled={savingReview}
                    style={{ fontSize: '12px' }}
                  >
                    <span>Conservar Valor Verificado</span>
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleResolveConflict('ACCEPT_DRIVE_SOURCE')}
                    disabled={savingReview}
                    style={{ fontSize: '12px', backgroundColor: 'var(--paguro-blue)' }}
                  >
                    <span>Aceptar Nuevo Valor de Drive</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Source Missing Notice */}
            {selectedDoc.source_status === 'SOURCE_MISSING' && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: 'var(--color-danger)',
                  fontSize: '12px',
                }}
              >
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                <strong>Aviso de Trazabilidad:</strong> El archivo original fue eliminado o retirado de Google Drive. Por normativa tributaria y auditoría, el registro documental y los movimientos financieros vinculados se conservan intactos.
              </div>
            )}

            {selectedDoc.pipeline_status === 'REQUIRES_REVIEW' && !selectedDoc.conflict_details && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--color-warning)',
                  fontSize: '12px',
                }}
              >
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {selectedDoc.review_notes || 'Extracción con confianza moderada. Confirme los valores fiscales.'}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Confianza IA Actual: {(selectedDoc.confidence_score * 100).toFixed(0)}%
              </div>
              <Button
                variant="secondary"
                onClick={handleExtractWithAi}
                disabled={extracting}
                style={{ fontSize: '12px', padding: '5px 10px' }}
              >
                <Sparkles size={13} color="var(--paguro-pink)" />
                <span>{extracting ? 'Analizando...' : 'Re-extraer con IA'}</span>
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Tipo Documental</label>
                <select
                  className="form-select"
                  value={editingDoc.document_type}
                  onChange={(e) => setEditingDoc({ ...editingDoc, document_type: e.target.value as any })}
                >
                  <option value="ELECTRONIC_INVOICE">Factura Electrónica</option>
                  <option value="COMMERCIAL_INVOICE">Factura Comercial</option>
                  <option value="SUPPLIER_INVOICE">Factura de Proveedor</option>
                  <option value="SWIFT_CONFIRMATION">Confirmación SWIFT</option>
                  <option value="PAYMENT_RECEIPT">Comprobante de Pago</option>
                  <option value="PACKING_LIST">Packing List</option>
                  <option value="BILL_OF_LADING">Bill of Lading</option>
                  <option value="IMPORT_DOCUMENT">Documento de Importación</option>
                  <option value="TAX_DOCUMENT">Documento Tributario / DIAN</option>
                  <option value="OTHER_SUPPORT">Otro Soporte</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Número de Factura / Ref</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingDoc.invoice_number}
                  onChange={(e) => setEditingDoc({ ...editingDoc, invoice_number: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Emisor / Proveedor</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingDoc.counterparty_name}
                  onChange={(e) => setEditingDoc({ ...editingDoc, counterparty_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">NIT / RUT</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingDoc.counterparty_tax_id}
                  onChange={(e) => setEditingDoc({ ...editingDoc, counterparty_tax_id: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">Subtotal</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={editingDoc.subtotal}
                  onChange={(e) => {
                    const sub = Number(e.target.value);
                    const iva = Math.round(sub * 0.19);
                    setEditingDoc({
                      ...editingDoc,
                      subtotal: sub,
                      tax_iva: iva,
                      total_amount: sub + iva - (editingDoc.tax_withholding || 0),
                    });
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">IVA (19%)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={editingDoc.tax_iva}
                  onChange={(e) => setEditingDoc({ ...editingDoc, tax_iva: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total (COP)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={editingDoc.total_amount}
                  onChange={(e) => setEditingDoc({ ...editingDoc, total_amount: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notas de Auditoría / Justificación</label>
              <input
                type="text"
                className="form-input"
                placeholder="Observaciones de validación..."
                value={editingDoc.review_notes}
                onChange={(e) => setEditingDoc({ ...editingDoc, review_notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="secondary" onClick={() => setSelectedDoc(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveCorrection}
                disabled={savingReview || !canValidate}
                style={{
                  backgroundColor: canValidate ? 'var(--paguro-blue)' : 'var(--border-color)',
                  opacity: canValidate ? 1 : 0.6,
                }}
              >
                {savingReview
                  ? 'Validando...'
                  : canValidate
                  ? 'Aceptar & Validar Documento'
                  : 'Solo Lectura (VIEWER)'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* LINK TO MOVEMENT MODAL */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Vincular Documento a Movimiento Financiero"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Seleccione el movimiento del ledger contable que corresponde a este soporte documental:
          </p>

          <div className="form-group">
            <label className="form-label">Movimiento Financiero</label>
            <select
              className="form-select"
              value={selectedMovementId}
              onChange={(e) => setSelectedMovementId(e.target.value)}
            >
              <option value="">Seleccione un movimiento...</option>
              {movements.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.movement_date} • {m.description} (${m.amount_cop.toLocaleString('es-CO')} COP)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsLinkModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmLink}
              disabled={!selectedMovementId}
              style={{ backgroundColor: 'var(--paguro-blue)' }}
            >
              Confirmar Vinculación
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

'use client';

// ============================================================================
// Paguro Finance V1 - Asesor IA (Financial & Tax AI Advisor)
// Dedicated Module, Interactive Time Windows, Calculation Traceability Cards & Tax Safety
// ============================================================================

import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  BotMessageSquare,
  ShieldAlert,
  Clock,
  Database,
  Layers,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  HelpCircle,
  FileText,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { queryAiAdvisorAction } from '@/lib/actions/ai-advisor';
import { AiAdvisorTimeWindow, AiAdvisorResponse } from '@/types/v1-financial';

export default function AiAdvisorPage() {
  const [timeWindow, setTimeWindow] = useState<AiAdvisorTimeWindow>('CURRENT_MONTH');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiAdvisorResponse | null>(null);

  const prebuiltPrompts = [
    '¿En qué gastamos más este mes?',
    '¿Qué obligaciones tributarias se acercan?',
    '¿Cuánto IVA estimamos haber generado vs descontable?',
    '¿Qué pagos bancarios no están conciliados?',
    '¿Qué gastos no tienen documento soporte adjunto?',
    'Resumen general de ingresos, egresos y flujo neto',
  ];

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    setQuestion(queryText);
    const res = await queryAiAdvisorAction(queryText, timeWindow);
    if (res.success && res.data) {
      setResponse(res.data);
    } else {
      alert(res.error || 'Error al consultar el Asesor IA.');
    }
    setLoading(false);
  };

  const timeWindowOptions: { key: AiAdvisorTimeWindow; label: string }[] = [
    { key: '7D', label: '7 Días' },
    { key: '30D', label: '30 Días' },
    { key: 'CURRENT_MONTH', label: 'Mes Actual' },
    { key: 'PREVIOUS_MONTH', label: 'Mes Anterior' },
    { key: 'CURRENT_QUARTER', label: 'Trimestre Actual' },
    { key: 'PREVIOUS_QUARTER', label: 'Trimestre Anterior' },
    { key: '12M', label: 'Últimos 12 Meses' },
    { key: 'CURRENT_YEAR', label: 'Año en Curso' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Asesor Financiero & Tributario IA</h1>
            <span className="badge badge-brand-pink" style={{ fontSize: '10px' }}>
              PAGURO INTELLIGENCE
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Análisis semántico determinístico sobre datos reales autorizados de la empresa
          </p>
        </div>
      </div>

      {/* Tax Safety Disclaimer */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(231, 33, 117, 0.06)',
          border: '1px solid rgba(231, 33, 117, 0.25)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
        }}
      >
        <ShieldAlert size={18} color="var(--paguro-pink)" style={{ flexShrink: 0 }} />
        <span style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-white)' }}>Guardarraíl de Seguridad Fiscal:</strong> El Asesor IA
          distingue observaciones financieras determinísticas de estimaciones tributarias referenciales. Para
          decisiones fiscales de alto impacto, confirme siempre con el Contador Oficial o Revisor Fiscal.
        </span>
      </div>

      {/* Time Window Selector */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginRight: '6px' }}>
          Ventana Temporal:
        </span>
        {timeWindowOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              setTimeWindow(opt.key);
              if (question) handleQuery(question);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: timeWindow === opt.key ? '1px solid var(--paguro-blue)' : '1px solid transparent',
              backgroundColor: timeWindow === opt.key ? 'var(--paguro-blue-light)' : 'rgba(255, 255, 255, 0.03)',
              color: timeWindow === opt.key ? 'var(--text-white)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: timeWindow === opt.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Suggested Prompt Chips */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
          Preguntas Rápidas Sugeridas:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {prebuiltPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleQuery(p)}
              disabled={loading}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'var(--transition-smooth)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuery(question);
          }}
          style={{ display: 'flex', gap: '10px' }}
        >
          <input
            type="text"
            className="form-input"
            placeholder="Pregunte sobre ingresos, gastos, conciliación bancaria, IVA o impuestos..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={loading || !question.trim()}
            style={{
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--paguro-blue)',
            }}
          >
            <Sparkles size={16} />
            <span>{loading ? 'Analizando...' : 'Consultar'}</span>
          </Button>
        </form>
      </div>

      {/* ADVISOR RESPONSE & TRACEABILITY */}
      {response && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Main Answer Card */}
          <div className="card card-glow-blue" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--paguro-blue-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--paguro-blue)',
                }}
              >
                <BotMessageSquare size={16} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-white)' }}>
                Dictamen del Asesor IA Paguro
              </span>
              <span className="badge badge-brand-blue" style={{ fontSize: '9px', marginLeft: 'auto' }}>
                Datos Autorizados Verificados
              </span>
            </div>

            {/* Formatted Markdown-like Response */}
            <div
              style={{
                fontSize: '14px',
                lineHeight: 1.7,
                color: 'var(--text-main)',
                whiteSpace: 'pre-line',
              }}
            >
              {response.answer}
            </div>

            {/* Followup suggestions */}
            {response.suggested_followups && response.suggested_followups.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Preguntas de Seguimiento:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {response.suggested_followups.map((f, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuery(f)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0, 152, 255, 0.08)',
                        border: '1px solid rgba(0, 152, 255, 0.2)',
                        color: 'var(--paguro-blue)',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {f} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CALCULATION TRACEABILITY CARD */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Database size={16} color="var(--color-success)" />
              <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Trazabilidad & Base del Cálculo</h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                fontSize: '12px',
              }}
            >
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <span style={{ color: 'var(--text-dim)' }}>Periodo Analizado:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  {response.traceability.period_analyzed} ({response.traceability.date_from} a{' '}
                  {response.traceability.date_to})
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <span style={{ color: 'var(--text-dim)' }}>Transacciones Auditadas:</span>
                <div className="num-mono" style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  {response.traceability.transactions_count} registros autorizados
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <span style={{ color: 'var(--text-dim)' }}>Soportes Contables:</span>
                <div className="num-mono" style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  {response.traceability.source_documents_count} documentos vinculados
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <span style={{ color: 'var(--text-dim)' }}>Herramientas Invocadas:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  {response.tools_invoked.join(', ')}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-dim)',
              }}
            >
              {response.traceability.safety_disclaimer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

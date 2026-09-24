import React from 'react';

interface StatCardProps {
  title?: string;
  label?: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  } | 'up' | 'down' | 'neutral';
  highlightColor?: 'primary' | 'success' | 'warning' | 'danger' | 'purple' | 'pink';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  label,
  value,
  subtitle,
  icon,
  trend,
  highlightColor = 'primary',
  onClick,
}) => {
  const displayTitle = title || label || '';

  const colorMap = {
    primary: 'var(--paguro-blue)',
    pink: 'var(--paguro-pink)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    purple: 'var(--color-purple)',
  };

  const isObjectTrend = trend && typeof trend === 'object';
  const isStringTrend = trend && typeof trend === 'string';

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '3px',
          height: '100%',
          backgroundColor: colorMap[highlightColor],
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {displayTitle}
        </span>
        {icon && (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colorMap[highlightColor],
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="num-mono" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '6px' }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
        {subtitle && <span style={{ color: 'var(--text-dim)' }}>{subtitle}</span>}
        {isObjectTrend && (
          <span
            style={{
              color: trend.isPositive ? 'var(--color-success)' : 'var(--color-danger)',
              fontWeight: 600,
            }}
          >
            {trend.value}
          </span>
        )}
        {isStringTrend && (
          <span
            style={{
              color: trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-danger)' : 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {trend === 'up' ? '↑ Positivo' : trend === 'down' ? '↓ Negativo' : '—'}
          </span>
        )}
      </div>
    </div>
  );
};

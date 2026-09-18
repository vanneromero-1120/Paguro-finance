import React from 'react';

interface BadgeProps {
  status?: string;
  label?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, variant: explicitVariant, children }) => {
  let computedVariant = explicitVariant || 'neutral';

  if (status && !explicitVariant) {
    const normalized = status.toLowerCase();
    if (['paid', 'completed', 'active', 'reviewed'].includes(normalized)) {
      computedVariant = 'success';
    } else if (['partial', 'open', 'draft', 'pending', 'reopened'].includes(normalized)) {
      computedVariant = 'warning';
    } else if (['void', 'overdue', 'inactive', 'suspended', 'damaged'].includes(normalized)) {
      computedVariant = 'danger';
    } else if (['closed', 'issued'].includes(normalized)) {
      computedVariant = 'purple';
    }
  }

  const displayContent = children || label || (status ? status.toUpperCase() : '');

  return <span className={`badge badge-${computedVariant}`}>{displayContent}</span>;
};

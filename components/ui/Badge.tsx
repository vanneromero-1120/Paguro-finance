import React from 'react';

interface BadgeProps {
  status: string;
  label?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label }) => {
  const normalized = status.toLowerCase();
  let variant = 'neutral';

  if (['paid', 'completed', 'active', 'reviewed'].includes(normalized)) {
    variant = 'success';
  } else if (['partial', 'open', 'draft', 'pending', 'reopened'].includes(normalized)) {
    variant = 'warning';
  } else if (['void', 'overdue', 'inactive', 'suspended', 'damaged'].includes(normalized)) {
    variant = 'danger';
  } else if (['closed', 'issued'].includes(normalized)) {
    variant = 'purple';
  }

  const displayLabel = label || status.toUpperCase();

  return <span className={`badge badge-${variant}`}>{displayLabel}</span>;
};

// Status indicator component with neobrutalism design
import React from 'react';
import '../../styles/status-indicator.scss';

export type StatusType =
  | 'recording'
  | 'paused'
  | 'ready'
  | 'error'
  | 'warning'
  | 'info'
  | 'connecting'
  | 'disconnected'
  | 'uploading'
  | 'success';

export interface StatusIndicatorProps {
  status: StatusType;
  message: string;
  pulse?: boolean;
  icon?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  pulse = false,
  icon,
  className = '',
}) => {
  const getStatusIcon = (status: StatusType): string => {
    if (icon) return icon;

    switch (status) {
      case 'recording':
        return '●';
      case 'paused':
        return '⏸';
      case 'ready':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      case 'connecting':
        return '⟳';
      case 'disconnected':
        return '⚡';
      case 'uploading':
        return '↑';
      case 'success':
        return '✓';
      default:
        return '●';
    }
  };

  const statusClasses = [
    'neo-status-indicator',
    `neo-status-indicator--${status}`,
    pulse ? 'neo-status-indicator--pulse' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={statusClasses}>
      <span className="neo-status-indicator__icon">
        {getStatusIcon(status)}
      </span>
      <span className="neo-status-indicator__message">
        {message}
      </span>
    </div>
  );
};

export default StatusIndicator;

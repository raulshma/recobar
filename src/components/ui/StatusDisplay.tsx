// Comprehensive status display component
import React from 'react';
import StatusIndicator, { StatusType } from './StatusIndicator';
import '../../styles/status-display.scss';

export interface StatusItem {
  id: string;
  status: StatusType;
  message: string;
  pulse?: boolean;
  icon?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface StatusDisplayProps {
  items: StatusItem[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  size?: 'small' | 'medium' | 'large';
  showTimestamp?: boolean;
  maxItems?: number;
  className?: string;
  onStatusClick?: (item: StatusItem) => void;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({
  items,
  layout = 'horizontal',
  size = 'medium',
  showTimestamp = false,
  maxItems = 10,
  className = '',
  onStatusClick,
}) => {
  // Sort items by priority and timestamp
  const sortedItems = React.useMemo(() => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };

    return items
      .slice(0, maxItems)
      .sort((a, b) => {
        const aPriority = priorityOrder[a.priority || 'medium'];
        const bPriority = priorityOrder[b.priority || 'medium'];

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }

        return 0; // Maintain original order for same priority
      });
  }, [items, maxItems]);

  const handleStatusClick = (item: StatusItem) => {
    if (onStatusClick) {
      onStatusClick(item);
    }
  };

  if (sortedItems.length === 0) {
    return null;
  }

  const containerClasses = [
    'neo-status-display',
    `neo-status-display--${layout}`,
    `neo-status-display--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {sortedItems.map((item) => (
        <div
          key={item.id}
          className={`neo-status-display__item ${
            onStatusClick ? 'neo-status-display__item--clickable' : ''
          }`}
          onClick={() => handleStatusClick(item)}
        >
          <StatusIndicator
            status={item.status}
            message={item.message}
            pulse={item.pulse}
            icon={item.icon}
            className={`neo-status-display__indicator neo-status-display__indicator--${size}`}
          />
          {showTimestamp && (
            <div className="neo-status-display__timestamp">
              {new Date().toLocaleTimeString()}
            </div>
          )}
          {item.priority === 'high' && (
            <div className="neo-status-display__priority-badge">
              !
            </div>
          )}
        </div>
      ))}

      {items.length > maxItems && (
        <div className="neo-status-display__overflow">
          <StatusIndicator
            status="info"
            message={`+${items.length - maxItems} more`}
            className={`neo-status-display__indicator neo-status-display__indicator--${size}`}
          />
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;

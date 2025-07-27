import React from 'react';
import clsx from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="neo-modal__backdrop" onClick={onClose} />
      <div className={clsx('neo-modal', className)}>
        {title && <div className="neo-modal__header">{title}</div>}
        {children}
      </div>
    </>
  );
};

export default Modal;

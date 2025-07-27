import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input: React.FC<InputProps> = ({ label, className, id, ...props }) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="neo-form__group">
      {label && (
        <label htmlFor={inputId} className="neo-form__label">
          {label}
        </label>
      )}
      <input id={inputId} className={clsx('neo-input', className)} {...props} />
    </div>
  );
};

export default Input;

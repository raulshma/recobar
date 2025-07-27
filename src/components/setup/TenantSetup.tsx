import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { RendererConfigService } from '../../services/RendererConfigService';

interface TenantSetupProps {
  onComplete: (tenantId: string) => void;
  onSkip?: () => void;
}

const TenantSetup: React.FC<TenantSetupProps> = ({ onComplete, onSkip }) => {
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const configService = new RendererConfigService();

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    try {
      const isFirstTimeSetup = await configService.isFirstTimeSetup();
      const existingTenantId = await configService.getTenantId();

      setIsFirstTime(isFirstTimeSetup);

      if (!isFirstTimeSetup && existingTenantId && onSkip) {
        // Skip setup if already configured
        onSkip();
        return;
      }

      if (existingTenantId) {
        setTenantId(existingTenantId);
      }
    } catch (error) {
      console.error('Error checking existing setup:', error);
      // Continue with setup on error
    }
  };

  const validateTenantId = (value: string): string => {
    if (!value.trim()) {
      return 'Tenant ID is required';
    }

    if (value.length < 3) {
      return 'Tenant ID must be at least 3 characters long';
    }

    if (value.length > 50) {
      return 'Tenant ID must be less than 50 characters';
    }

    // Allow alphanumeric, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(value)) {
      return 'Tenant ID can only contain letters, numbers, hyphens, and underscores';
    }

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateTenantId(tenantId);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await configService.setTenantId(tenantId.trim());
      onComplete(tenantId.trim());
    } catch (error) {
      console.error('Error saving tenant ID:', error);
      setError('Failed to save tenant ID. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setTenantId(value);

    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  return (
    <div className="neo-container">
      <div className="neo-card">
        <div className="neo-text--center">
          <h1 className="neo-text--xl neo-text--uppercase">
            {isFirstTime ? 'Welcome!' : 'Tenant Setup'}
          </h1>
          <p className="neo-text--large" style={{ marginBottom: '32px' }}>
            {isFirstTime
              ? "Let's get you set up. First, we need your tenant ID."
              : 'Configure your tenant ID to continue.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="neo-form">
          <Input
            label="Tenant ID"
            type="text"
            value={tenantId}
            onChange={handleInputChange}
            placeholder="Enter your tenant ID"
            disabled={isLoading}
            required
            autoFocus
          />

          {error && (
            <div
              className="neo-status neo-status--error"
              style={{ marginBottom: '16px' }}
            >
              {error}
            </div>
          )}

          <div className="neo-text--center">
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !tenantId.trim()}
            >
              {isLoading ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        </form>

        <div
          className="neo-text--center"
          style={{ marginTop: '24px', fontSize: '14px' }}
        >
          <p>
            Your tenant ID helps identify your organization and ensures your
            recordings are properly associated with your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TenantSetup;

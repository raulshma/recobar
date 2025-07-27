import React, { useState, useEffect, useCallback } from 'react';
import TenantSetup from './TenantSetup';
import WebcamSetup from './WebcamSetup';
import { RendererConfigService } from '../../services/RendererConfigService';

interface SetupWizardProps {
  onComplete: () => void;
}

type SetupStep = 'tenant' | 'webcam' | 'complete';

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('tenant');
  const [tenantId, setTenantId] = useState<string>('');
  const [webcamId, setWebcamId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const configService = new RendererConfigService();

  const checkExistingSetup = useCallback(async () => {
    try {
      setIsLoading(true);

      const isFirstTime = await configService.isFirstTimeSetup();

      if (!isFirstTime) {
        // Setup already completed, skip wizard
        onComplete();
        return;
      }

      // Check what's already configured
      const existingTenantId = await configService.getTenantId();
      const existingWebcamId = await configService.getWebcamId();

      if (existingTenantId) {
        setTenantId(existingTenantId);
        if (existingWebcamId) {
          setWebcamId(existingWebcamId);
          // Both configured, complete setup
          onComplete();
        } else {
          // Tenant configured, go to webcam setup
          setCurrentStep('webcam');
        }
      } else {
        // Start from tenant setup
        setCurrentStep('tenant');
      }
    } catch (error) {
      console.error('Error checking existing setup:', error);
      // Start from beginning on error
      setCurrentStep('tenant');
    } finally {
      setIsLoading(false);
    }
  }, [configService, onComplete]);

  useEffect(() => {
    checkExistingSetup();
  }, [checkExistingSetup]);

  const handleTenantComplete = (completedTenantId: string) => {
    setTenantId(completedTenantId);
    setCurrentStep('webcam');
  };

  const handleTenantSkip = () => {
    // This should only be called if setup is already complete
    onComplete();
  };

  const handleWebcamComplete = (completedWebcamId: string) => {
    setWebcamId(completedWebcamId);
    setCurrentStep('complete');

    // Complete the setup process
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  const handleWebcamBack = () => {
    setCurrentStep('tenant');
  };

  const getStepNumber = (step: SetupStep): number => {
    switch (step) {
      case 'tenant':
        return 1;
      case 'webcam':
        return 2;
      case 'complete':
        return 3;
      default:
        return 1;
    }
  };

  const getStepTitle = (step: SetupStep): string => {
    switch (step) {
      case 'tenant':
        return 'Tenant Setup';
      case 'webcam':
        return 'Camera Setup';
      case 'complete':
        return 'Setup Complete';
      default:
        return 'Setup';
    }
  };

  if (isLoading) {
    return (
      <div className="neo-container">
        <div className="neo-card neo-text--center">
          <h1 className="neo-text--xl neo-text--uppercase">
            Initializing Setup...
          </h1>
          <p>Please wait while we check your configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-wizard">
      {/* Progress Indicator */}
      <div className="neo-container" style={{ paddingBottom: '0' }}>
        <div className="neo-card" style={{ marginBottom: '24px' }}>
          <div className="setup-wizard__progress">
            <div className="neo-flex neo-flex--center" style={{ gap: '24px' }}>
              {(['tenant', 'webcam', 'complete'] as SetupStep[]).map(
                (step, index) => {
                  const stepNumber = index + 1;
                  const isActive = currentStep === step;
                  const isCompleted = getStepNumber(currentStep) > stepNumber;

                  return (
                    <div
                      key={step}
                      className="neo-flex neo-flex--center"
                      style={{ gap: '8px' }}
                    >
                      <div
                        className={`setup-wizard__step-indicator ${
                          isActive ? 'setup-wizard__step-indicator--active' : ''
                        } ${
                          isCompleted
                            ? 'setup-wizard__step-indicator--completed'
                            : ''
                        }`}
                      >
                        {stepNumber}
                      </div>
                      <span
                        className={`neo-text--uppercase ${isActive ? 'setup-wizard__step-text--active' : ''}`}
                      >
                        {getStepTitle(step)}
                      </span>
                      {index < 2 && (
                        <div className="setup-wizard__step-separator">→</div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="setup-wizard__content">
        {currentStep === 'tenant' && (
          <TenantSetup
            onComplete={handleTenantComplete}
            onSkip={handleTenantSkip}
          />
        )}

        {currentStep === 'webcam' && (
          <WebcamSetup
            onComplete={handleWebcamComplete}
            onBack={handleWebcamBack}
          />
        )}

        {currentStep === 'complete' && (
          <div className="neo-container">
            <div className="neo-card neo-text--center">
              <h1 className="neo-text--xl neo-text--uppercase">
                Setup Complete!
              </h1>
              <p className="neo-text--large" style={{ marginBottom: '32px' }}>
                Your barcode video recorder is ready to use.
              </p>

              <div
                className="neo-status neo-status--ready"
                style={{ marginBottom: '24px' }}
              >
                Configuration Saved Successfully
              </div>

              <div
                style={{
                  textAlign: 'left',
                  maxWidth: '400px',
                  margin: '0 auto',
                }}
              >
                <p>
                  <strong>Tenant ID:</strong> {tenantId}
                </p>
                <p>
                  <strong>Camera:</strong> Configured
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .setup-wizard__step-indicator {
          width: 40px;
          height: 40px;
          border: 3px solid var(--neo-black);
          background: var(--neo-white);
          color: var(--neo-black);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 18px;
          box-shadow: var(--neo-shadow-md);
        }

        .setup-wizard__step-indicator--active {
          background: var(--neo-yellow);
          box-shadow: var(--neo-shadow-lg);
        }

        .setup-wizard__step-indicator--completed {
          background: var(--neo-green);
        }

        .setup-wizard__step-text--active {
          font-weight: 900;
          color: var(--neo-black);
        }

        .setup-wizard__step-separator {
          font-size: 24px;
          font-weight: 900;
          color: var(--neo-black);
          margin: 0 8px;
        }

        .setup-wizard__progress {
          padding: 16px 0;
        }

        .setup-wizard__content {
          min-height: 400px;
        }
      `}</style>
    </div>
  );
};

export default SetupWizard;

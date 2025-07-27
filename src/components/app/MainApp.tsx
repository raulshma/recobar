import React, { useState, useEffect } from 'react';
import { SettingsModal } from '../settings';
import Button from '../ui/Button';
import { RendererConfigService } from '../../services/RendererConfigService';
import '../../styles/neobrutalism.scss';
import '../../styles/settings.scss';

interface MainAppState {
  showSettings: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  config: {
    tenantId: string | null;
    webcamId: string | null;
  };
}

const MainApp: React.FC = () => {
  const [state, setState] = useState<MainAppState>({
    showSettings: false,
    isConfigured: false,
    isLoading: true,
    error: null,
    config: {
      tenantId: null,
      webcamId: null,
    },
  });

  const configService = new RendererConfigService();

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [tenantId, webcamId] = await Promise.all([
        configService.getTenantId(),
        configService.getWebcamId(),
      ]);

      const isConfigured = !!(tenantId && webcamId);

      setState((prev) => ({
        ...prev,
        config: { tenantId, webcamId },
        isConfigured,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error checking configuration:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load configuration. Please check your settings.',
        isLoading: false,
      }));
    }
  };

  const handleOpenSettings = () => {
    setState((prev) => ({ ...prev, showSettings: true }));
  };

  const handleCloseSettings = async () => {
    setState((prev) => ({ ...prev, showSettings: false }));
    // Refresh configuration after settings are closed
    await checkConfiguration();
  };

  const handleRetryConfiguration = () => {
    checkConfiguration();
  };

  if (state.isLoading) {
    return (
      <div className="main-app">
        <div className="main-app__loading">
          <div className="loading-spinner"></div>
          <h2 className="loading-text">Loading Application...</h2>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="main-app">
        <div className="main-app__error">
          <div className="error-content">
            <h2 className="error-title">Configuration Error</h2>
            <p className="error-message">{state.error}</p>
            <div className="error-actions">
              <Button variant="primary" onClick={handleOpenSettings}>
                Open Settings
              </Button>
              <Button variant="info" onClick={handleRetryConfiguration}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!state.isConfigured) {
    return (
      <div className="main-app">
        <div className="main-app__setup">
          <div className="setup-content">
            <h1 className="setup-title">Welcome to Barcode Video Recorder</h1>
            <p className="setup-message">
              Please configure your settings to get started.
            </p>
            <div className="setup-requirements">
              <h3>Required Configuration:</h3>
              <ul>
                <li className={state.config.tenantId ? 'configured' : 'missing'}>
                  {state.config.tenantId ? '✓' : '✗'} Tenant ID
                </li>
                <li className={state.config.webcamId ? 'configured' : 'missing'}>
                  {state.config.webcamId ? '✓' : '✗'} Webcam Selection
                </li>
              </ul>
            </div>
            <Button variant="primary" onClick={handleOpenSettings}>
              Configure Settings
            </Button>
          </div>
        </div>

        <SettingsModal
          isOpen={state.showSettings}
          onClose={handleCloseSettings}
        />
      </div>
    );
  }

  return (
    <div className="main-app">
      {/* Settings Button */}
      <div className="main-app__header">
        <Button
          variant="info"
          onClick={handleOpenSettings}
          className="settings-button"
        >
          Settings
        </Button>
      </div>

      {/* Main Content */}
      <div className="main-app__content">
        <div className="main-app__placeholder">
          <h2>Barcode Video Recorder</h2>
          <p>Tenant ID: {state.config.tenantId}</p>
          <p>Webcam ID: {state.config.webcamId}</p>
          <p>Application is configured and ready to use.</p>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={state.showSettings}
        onClose={handleCloseSettings}
      />
    </div>
  );
};

export default MainApp;

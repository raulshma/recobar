import React, { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { RendererConfigService } from '../../services/RendererConfigService';
import { VideoStreamManager } from '../../services/VideoStreamManager';
import '../../styles/neobrutalism.scss';
import '../../styles/settings.scss';

interface GeneralSettingsState {
  tenantId: string;
  webcamId: string;
  availableWebcams: MediaDeviceInfo[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
}

const GeneralSettings: React.FC = () => {
  const [state, setState] = useState<GeneralSettingsState>({
    tenantId: '',
    webcamId: '',
    availableWebcams: [],
    isLoading: true,
    isSaving: false,
    error: null,
    successMessage: null,
  });

  const configService = new RendererConfigService();
  const videoManager = new VideoStreamManager();

  useEffect(() => {
    loadSettings();
    return () => {
      videoManager.dispose();
    };
  }, []);

  const loadSettings = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const [tenantId, webcamId, devices] = await Promise.all([
        configService.getTenantId(),
        configService.getWebcamId(),
        videoManager.getAvailableDevices(),
      ]);

      setState((prev) => ({
        ...prev,
        tenantId: tenantId || '',
        webcamId: webcamId || '',
        availableWebcams: devices,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading general settings:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load settings. Please try again.',
        isLoading: false,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setState((prev) => ({ ...prev, isSaving: true, error: null, successMessage: null }));

      // Validate inputs
      if (!state.tenantId.trim()) {
        throw new Error('Tenant ID is required');
      }

      if (!state.webcamId.trim()) {
        throw new Error('Please select a webcam');
      }

      // Save settings
      await Promise.all([
        configService.setTenantId(state.tenantId.trim()),
        configService.setWebcamId(state.webcamId),
      ]);

      setState((prev) => ({
        ...prev,
        isSaving: false,
        successMessage: 'Settings saved successfully!',
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setState((prev) => ({ ...prev, successMessage: null }));
      }, 3000);
    } catch (error) {
      console.error('Error saving general settings:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save settings',
        isSaving: false,
      }));
    }
  };

  const handleTenantIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, tenantId: e.target.value }));
  };

  const handleWebcamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState((prev) => ({ ...prev, webcamId: e.target.value }));
  };

  if (state.isLoading) {
    return (
      <div className="general-settings">
        <div className="general-settings__loading">
          <div className="neo-text--center">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="general-settings">
      <div className="general-settings__section">
        <h3 className="general-settings__section-title">Organization</h3>

        <Input
          label="Tenant ID"
          type="text"
          value={state.tenantId}
          onChange={handleTenantIdChange}
          placeholder="Enter your organization's tenant ID"
          disabled={state.isSaving}
        />
      </div>

      <div className="general-settings__section">
        <h3 className="general-settings__section-title">Camera</h3>

        <div className="neo-form__group">
          <label className="neo-form__label" htmlFor="webcam-select">
            Webcam Device
          </label>
          <select
            id="webcam-select"
            className="neo-form__select neo-input"
            value={state.webcamId}
            onChange={handleWebcamChange}
            disabled={state.isSaving}
          >
            <option value="">Select a webcam...</option>
            {state.availableWebcams.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="general-settings__error neo-card">
          <div className="neo-status neo-status--error">
            {state.error}
          </div>
        </div>
      )}

      {/* Success Message */}
      {state.successMessage && (
        <div className="general-settings__success neo-card">
          <div className="neo-status neo-status--ready">
            {state.successMessage}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="general-settings__actions">
        <Button
          variant="success"
          onClick={handleSave}
          disabled={state.isSaving}
        >
          {state.isSaving ? 'Saving...' : 'Save Settings'}
        </Button>

        <Button
          variant="info"
          onClick={loadSettings}
          disabled={state.isSaving}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default GeneralSettings;

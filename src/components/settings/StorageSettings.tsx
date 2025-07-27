import React, { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { RendererConfigService } from '../../services/RendererConfigService';
import { StorageSettings as IStorageSettings } from '../../types/config';
import '../../styles/neobrutalism.scss';
import '../../styles/settings.scss';

interface StorageSettingsState {
  localEnabled: boolean;
  localPath: string;
  s3Enabled: boolean;
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
}

const StorageSettings: React.FC = () => {
  const [state, setState] = useState<StorageSettingsState>({
    localEnabled: true,
    localPath: '',
    s3Enabled: false,
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    isLoading: true,
    isSaving: false,
    error: null,
    successMessage: null,
  });

  const configService = new RendererConfigService();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const storageSettings = await configService.getStorageSettings();

      setState((prev) => ({
        ...prev,
        localEnabled: !!storageSettings.localPath,
        localPath: storageSettings.localPath || '',
        s3Enabled: !!storageSettings.s3Config,
        s3Bucket: storageSettings.s3Config?.bucket || '',
        s3Region: storageSettings.s3Config?.region || 'us-east-1',
        s3AccessKeyId: storageSettings.s3Config?.accessKeyId || '',
        s3SecretAccessKey: storageSettings.s3Config?.secretAccessKey || '',
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading storage settings:', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to load storage settings. Please try again.',
        isLoading: false,
      }));
    }
  };

  const handleSave = async () => {
    try {
      setState((prev) => ({ ...prev, isSaving: true, error: null, successMessage: null }));

      // Validate settings
      if (!state.localEnabled && !state.s3Enabled) {
        throw new Error('At least one storage option must be enabled');
      }

      if (state.localEnabled && !state.localPath.trim()) {
        throw new Error('Local storage path is required when local storage is enabled');
      }

      if (state.s3Enabled) {
        if (!state.s3Bucket.trim()) {
          throw new Error('S3 bucket name is required when S3 storage is enabled');
        }
        if (!state.s3Region.trim()) {
          throw new Error('S3 region is required when S3 storage is enabled');
        }
        if (!state.s3AccessKeyId.trim()) {
          throw new Error('S3 access key ID is required when S3 storage is enabled');
        }
        if (!state.s3SecretAccessKey.trim()) {
          throw new Error('S3 secret access key is required when S3 storage is enabled');
        }
      }

      // Build storage settings object
      const storageSettings: IStorageSettings = {};

      if (state.localEnabled) {
        storageSettings.localPath = state.localPath.trim();
      }

      if (state.s3Enabled) {
        storageSettings.s3Config = {
          bucket: state.s3Bucket.trim(),
          region: state.s3Region.trim(),
          accessKeyId: state.s3AccessKeyId.trim(),
          secretAccessKey: state.s3SecretAccessKey.trim(),
        };
      }

      // Save settings
      await configService.setStorageSettings(storageSettings);

      setState((prev) => ({
        ...prev,
        isSaving: false,
        successMessage: 'Storage settings saved successfully!',
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setState((prev) => ({ ...prev, successMessage: null }));
      }, 3000);
    } catch (error) {
      console.error('Error saving storage settings:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save storage settings',
        isSaving: false,
      }));
    }
  };

  const handleLocalEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, localEnabled: e.target.checked }));
  };

  const handleS3EnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, s3Enabled: e.target.checked }));
  };

  if (state.isLoading) {
    return (
      <div className="storage-settings">
        <div className="storage-settings__loading">
          <div className="neo-text--center">Loading storage settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="storage-settings">
      {/* Local Storage Section */}
      <div className="storage-settings__section neo-card">
        <div className="storage-settings__section-header">
          <h3 className="storage-settings__section-title">Local Storage</h3>
          <label className="storage-settings__checkbox">
            <input
              type="checkbox"
              checked={state.localEnabled}
              onChange={handleLocalEnabledChange}
              disabled={state.isSaving}
            />
            <span className="storage-settings__checkbox-label">Enable Local Storage</span>
          </label>
        </div>

        {state.localEnabled && (
          <div className="storage-settings__section-content">
            <Input
              label="Storage Path"
              type="text"
              value={state.localPath}
              onChange={(e) => setState((prev) => ({ ...prev, localPath: e.target.value }))}
              placeholder="C:\recordings or /home/user/recordings"
              disabled={state.isSaving}
            />
            <p className="storage-settings__help-text">
              Specify the directory where recordings will be saved locally.
            </p>
          </div>
        )}
      </div>

      {/* S3 Storage Section */}
      <div className="storage-settings__section neo-card">
        <div className="storage-settings__section-header">
          <h3 className="storage-settings__section-title">Amazon S3 Storage</h3>
          <label className="storage-settings__checkbox">
            <input
              type="checkbox"
              checked={state.s3Enabled}
              onChange={handleS3EnabledChange}
              disabled={state.isSaving}
            />
            <span className="storage-settings__checkbox-label">Enable S3 Storage</span>
          </label>
        </div>

        {state.s3Enabled && (
          <div className="storage-settings__section-content">
            <div className="neo-grid neo-grid--2">
              <Input
                label="Bucket Name"
                type="text"
                value={state.s3Bucket}
                onChange={(e) => setState((prev) => ({ ...prev, s3Bucket: e.target.value }))}
                placeholder="my-recordings-bucket"
                disabled={state.isSaving}
              />

              <div className="neo-form__group">
                <label className="neo-form__label" htmlFor="s3-region">
                  Region
                </label>
                <select
                  id="s3-region"
                  className="neo-form__select neo-input"
                  value={state.s3Region}
                  onChange={(e) => setState((prev) => ({ ...prev, s3Region: e.target.value }))}
                  disabled={state.isSaving}
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-east-2">US East (Ohio)</option>
                  <option value="us-west-1">US West (N. California)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">Europe (Ireland)</option>
                  <option value="eu-west-2">Europe (London)</option>
                  <option value="eu-central-1">Europe (Frankfurt)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                </select>
              </div>
            </div>

            <Input
              label="Access Key ID"
              type="text"
              value={state.s3AccessKeyId}
              onChange={(e) => setState((prev) => ({ ...prev, s3AccessKeyId: e.target.value }))}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              disabled={state.isSaving}
            />

            <Input
              label="Secret Access Key"
              type="password"
              value={state.s3SecretAccessKey}
              onChange={(e) => setState((prev) => ({ ...prev, s3SecretAccessKey: e.target.value }))}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              disabled={state.isSaving}
            />

            <p className="storage-settings__help-text">
              Configure your AWS credentials to enable automatic upload to S3.
              Make sure your credentials have permissions to write to the specified bucket.
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="storage-settings__error neo-card">
          <div className="neo-status neo-status--error">
            {state.error}
          </div>
        </div>
      )}

      {/* Success Message */}
      {state.successMessage && (
        <div className="storage-settings__success neo-card">
          <div className="neo-status neo-status--ready">
            {state.successMessage}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="storage-settings__actions">
        <Button
          variant="success"
          onClick={handleSave}
          disabled={state.isSaving}
        >
          {state.isSaving ? 'Saving...' : 'Save Storage Settings'}
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

export default StorageSettings;

import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import GeneralSettings from './GeneralSettings';
import StorageSettings from './StorageSettings';
import '../../styles/neobrutalism.scss';
import '../../styles/settings.scss';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'storage';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'storage' as const, label: 'Storage' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      className="settings-modal"
    >
      <div className="settings-modal__content">
        {/* Tab Navigation */}
        <div className="settings-modal__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-modal__tab ${
                activeTab === tab.id ? 'settings-modal__tab--active' : ''
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="settings-modal__tab-content">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'storage' && <StorageSettings />}
        </div>

        {/* Modal Actions */}
        <div className="settings-modal__actions">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;

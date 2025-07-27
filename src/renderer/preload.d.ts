import { ElectronAPI } from '../types/preload';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronAPI;
  }
}

export {};

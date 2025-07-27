// Type definitions for QuaggaJS library
declare module 'quagga' {
  interface QuaggaConfig {
    inputStream: {
      name: string;
      type: string;
      target: HTMLVideoElement | HTMLCanvasElement | string;
      constraints?: {
        width?: number;
        height?: number;
        facingMode?: string;
      };
    };
    locator?: {
      patchSize?: string;
      halfSample?: boolean;
    };
    numOfWorkers?: number;
    frequency?: number;
    decoder: {
      readers: string[];
    };
    locate?: boolean;
  }

  interface BarcodeResult {
    codeResult: {
      code: string;
      confidence: number;
      format: string;
    };
    line?: any;
    angle?: number;
    pattern?: any;
    box?: any;
  }

  interface Quagga {
    init(config: QuaggaConfig, callback?: (err?: Error) => void): void;
    start(): void;
    stop(): void;
    onDetected(callback: (result: BarcodeResult) => void): void;
    offDetected(callback: (result: BarcodeResult) => void): void;
    onProcessed(callback: (result: any) => void): void;
    offProcessed(callback: (result: any) => void): void;
  }

  const Quagga: Quagga;
  export default Quagga;
}

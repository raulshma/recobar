// Service for managing blob processing with Web Workers
export interface BlobProcessingOptions {
  useWorker?: boolean;
  maxWorkerCount?: number;
}

export class BlobProcessorService {
  private workers: Worker[] = [];
  private maxWorkers: number;
  private currentWorkerIndex: number = 0;

  constructor(options: BlobProcessingOptions = {}) {
    this.maxWorkers = options.maxWorkerCount || 2;
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    try {
      for (let i = 0; i < this.maxWorkers; i++) {
        // Use a different approach for Web Worker initialization
        const workerCode = `
          self.onmessage = async (event) => {
            if (event.data.type === 'processBlob') {
              const startTime = performance.now();
              
              try {
                const blob = new Blob([event.data.blobData], { type: event.data.mimeType });
                const processingTime = performance.now() - startTime;
                
                self.postMessage({
                  type: 'blobProcessed',
                  blobSize: blob.size,
                  processingTime,
                });
              } catch (error) {
                self.postMessage({
                  type: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        this.workers.push(worker);
      }
    } catch (error) {
      console.warn('Failed to initialize Web Workers, falling back to main thread processing:', error);
    }
  }

  async processBlob(blob: Blob, mimeType: string): Promise<{ blob: Blob; processingTime: number }> {
    if (this.workers.length === 0) {
      // Fallback to main thread processing
      return this.processBlobInMainThread(blob, mimeType);
    }

    return new Promise((resolve, reject) => {
      const worker = this.getNextWorker();
      const startTime = performance.now();

      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'blobProcessed') {
          const processingTime = performance.now() - startTime;
          worker.removeEventListener('message', handleMessage);
          resolve({ blob, processingTime });
        } else if (event.data.type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      worker.addEventListener('message', handleMessage);

      // Convert blob to ArrayBuffer and send to worker
      blob.arrayBuffer().then(arrayBuffer => {
        worker.postMessage({
          type: 'processBlob',
          blobData: arrayBuffer,
          mimeType,
        });
      }).catch(reject);
    });
  }

  private async processBlobInMainThread(blob: Blob, mimeType: string): Promise<{ blob: Blob; processingTime: number }> {
    const startTime = performance.now();
    
    // Use requestIdleCallback to avoid blocking UI
    return new Promise((resolve) => {
      const processBlob = () => {
        const processingTime = performance.now() - startTime;
        resolve({ blob, processingTime });
      };

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processBlob);
      } else {
        setTimeout(processBlob, 0);
      }
    });
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.currentWorkerIndex];
    this.currentWorkerIndex = (this.currentWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  dispose(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
  }
} 
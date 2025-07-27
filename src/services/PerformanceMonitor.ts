// Performance monitoring service for recording operations
export interface PerformanceMetrics {
  recordingStartTime: number;
  recordingDuration: number;
  blobSize: number;
  processingTime: number;
  memoryUsage: number;
  frameRate: number;
  bitrate: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring: boolean = false;
  private startTime: number = 0;
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMemoryMonitoring();
  }

  startRecording(): void {
    this.isMonitoring = true;
    this.startTime = performance.now();
    console.log('Performance monitoring started');
  }

  stopRecording(blobSize: number, processingTime: number): PerformanceMetrics {
    if (!this.isMonitoring) {
      throw new Error('Performance monitoring not started');
    }

    const recordingDuration = performance.now() - this.startTime;
    const memoryUsage = this.getMemoryUsage();
    const frameRate = this.calculateFrameRate();
    const bitrate = this.calculateBitrate(blobSize, recordingDuration);

    const metrics: PerformanceMetrics = {
      recordingStartTime: this.startTime,
      recordingDuration,
      blobSize,
      processingTime,
      memoryUsage,
      frameRate,
      bitrate,
    };

    this.metrics.push(metrics);
    this.isMonitoring = false;

    console.log('Performance metrics:', metrics);
    return metrics;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private calculateFrameRate(): number {
    // Estimate frame rate based on typical webcam performance
    return 24; // Default to 24 fps
  }

  private calculateBitrate(blobSize: number, duration: number): number {
    if (duration === 0) return 0;
    return (blobSize * 8) / (duration / 1000); // bits per second
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      if (memoryUsage > 100) { // Warning at 100MB
        console.warn(`High memory usage detected: ${memoryUsage.toFixed(2)}MB`);
      }
    }, 5000); // Check every 5 seconds
  }

  getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) {
      return {};
    }

    const avg = this.metrics.reduce((acc, metric) => ({
      recordingDuration: acc.recordingDuration + metric.recordingDuration,
      blobSize: acc.blobSize + metric.blobSize,
      processingTime: acc.processingTime + metric.processingTime,
      memoryUsage: acc.memoryUsage + metric.memoryUsage,
      frameRate: acc.frameRate + metric.frameRate,
      bitrate: acc.bitrate + metric.bitrate,
    }), {
      recordingDuration: 0,
      blobSize: 0,
      processingTime: 0,
      memoryUsage: 0,
      frameRate: 0,
      bitrate: 0,
    });

    const count = this.metrics.length;
    return {
      recordingDuration: avg.recordingDuration / count,
      blobSize: avg.blobSize / count,
      processingTime: avg.processingTime / count,
      memoryUsage: avg.memoryUsage / count,
      frameRate: avg.frameRate / count,
      bitrate: avg.bitrate / count,
    };
  }

  getRecentMetrics(count: number = 5): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  dispose(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    this.isMonitoring = false;
  }
} 
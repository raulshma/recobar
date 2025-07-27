// Comprehensive unit tests for BarcodeDetectionService
import { BarcodeDetectionService } from '../services/BarcodeDetectionService';

// Get the mocked module
const mockQuagga = require('quagga');

describe('BarcodeDetectionService', () => {
  let barcodeDetectionService: BarcodeDetectionService;
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock video element
    mockVideoElement = {
      videoWidth: 640,
      videoHeight: 480,
    } as HTMLVideoElement;

    // Create new instance
    barcodeDetectionService = new BarcodeDetectionService();
  });

  describe('Detection lifecycle', () => {
    it('should start detection successfully', () => {
      mockQuagga.init.mockImplementation((config: any, callback: any) => {
        callback(null); // Success
      });

      barcodeDetectionService.startDetection(mockVideoElement);

      expect(mockQuagga.init).toHaveBeenCalledWith(
        {
          inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: mockVideoElement,
            constraints: {
              width: 640,
              height: 480,
              facingMode: 'environment',
            },
          },
          locator: {
            patchSize: 'medium',
            halfSample: true,
          },
          numOfWorkers: 2,
          frequency: 10,
          decoder: {
            readers: [
              'code_128_reader',
              'ean_reader',
              'ean_8_reader',
              'code_39_reader',
              'code_39_vin_reader',
              'codabar_reader',
              'upc_reader',
              'upc_e_reader',
              'i2of5_reader',
            ],
          },
          locate: true,
        },
        expect.any(Function)
      );

      expect(mockQuagga.start).toHaveBeenCalled();
      expect(mockQuagga.onDetected).toHaveBeenCalledWith(expect.any(Function));
      expect(barcodeDetectionService.isActive()).toBe(true);
    });

    it('should use default dimensions when video element has no dimensions', () => {
      const videoElementNoDimensions = {} as HTMLVideoElement;
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(videoElementNoDimensions);

      const initCall = mockQuagga.init.mock.calls[0][0];
      expect(initCall.inputStream.constraints).toEqual({
        width: 640,
        height: 480,
        facingMode: 'environment',
      });
    });

    it('should handle Quagga initialization error', () => {
      const initError = new Error('Quagga init failed');
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(initError);
      });

      barcodeDetectionService.startDetection(mockVideoElement);

      expect(mockQuagga.start).not.toHaveBeenCalled();
      expect(barcodeDetectionService.isActive()).toBe(false);
    });

    it('should stop existing detection before starting new one', () => {
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      // Start first detection
      barcodeDetectionService.startDetection(mockVideoElement);

      // Start second detection
      barcodeDetectionService.startDetection(mockVideoElement);

      expect(mockQuagga.stop).toHaveBeenCalled();
      expect(mockQuagga.offDetected).toHaveBeenCalled();
    });

    it('should stop detection successfully', () => {
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(mockVideoElement);
      barcodeDetectionService.stopDetection();

      expect(mockQuagga.offDetected).toHaveBeenCalledWith(expect.any(Function));
      expect(mockQuagga.stop).toHaveBeenCalled();
      expect(barcodeDetectionService.isActive()).toBe(false);
    });

    it('should handle stopping when detection is not active', () => {
      expect(() => barcodeDetectionService.stopDetection()).not.toThrow();
      expect(mockQuagga.stop).not.toHaveBeenCalled();
    });

    it('should return correct active state', () => {
      expect(barcodeDetectionService.isActive()).toBe(false);

      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(mockVideoElement);
      expect(barcodeDetectionService.isActive()).toBe(true);

      barcodeDetectionService.stopDetection();
      expect(barcodeDetectionService.isActive()).toBe(false);
    });
  });

  describe('Barcode detection callbacks', () => {
    beforeEach(() => {
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });
    });

    it('should register barcode detection callbacks', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);

      expect((barcodeDetectionService as any).detectionCallbacks).toContain(callback);
    });

    it('should call callbacks when barcode is detected with high confidence', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback1);
      barcodeDetectionService.onBarcodeDetected(callback2);

      barcodeDetectionService.startDetection(mockVideoElement);

      // Get the detection handler
      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Simulate barcode detection with high confidence
      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 80,
          format: 'code_128',
        },
      };

      detectionHandler(mockResult);

      expect(callback1).toHaveBeenCalledWith('TEST123');
      expect(callback2).toHaveBeenCalledWith('TEST123');
    });

    it('should not call callbacks when barcode confidence is too low', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Simulate barcode detection with low confidence
      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 50, // Below threshold of 75
          format: 'code_128',
        },
      };

      detectionHandler(mockResult);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle detection results without confidence', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Simulate barcode detection without confidence
      const mockResult = {
        codeResult: {
          code: 'TEST123',
          format: 'code_128',
        },
      };

      detectionHandler(mockResult);

      expect(callback).not.toHaveBeenCalled(); // Should not call due to 0 confidence
    });

    it('should handle invalid detection results', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Test various invalid results
      const invalidResults = [
        null,
        undefined,
        {},
        { codeResult: null },
        { codeResult: undefined },
        { codeResult: {} },
        { codeResult: { code: null } },
        { codeResult: { code: undefined } },
      ];

      invalidResults.forEach((result) => {
        detectionHandler(result);
        expect(callback).not.toHaveBeenCalled();
      });
    });

    it('should not call callbacks when detection is not active', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);
      barcodeDetectionService.stopDetection();

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 80,
          format: 'code_128',
        },
      };

      detectionHandler(mockResult);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(errorCallback);
      barcodeDetectionService.onBarcodeDetected(normalCallback);

      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 80,
          format: 'code_128',
        },
      };

      // Should not throw despite callback error
      expect(() => detectionHandler(mockResult)).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should remove specific callback', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback1);
      barcodeDetectionService.onBarcodeDetected(callback2);

      barcodeDetectionService.removeCallback(callback1);

      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 80,
          format: 'code_128',
        },
      };

      detectionHandler(mockResult);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('TEST123');
    });

    it('should handle removing non-existent callback', () => {
      const callback = jest.fn();

      expect(() => {
        barcodeDetectionService.removeCallback(callback);
      }).not.toThrow();
    });

    it('should clear all callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback1);
      barcodeDetectionService.onBarcodeDetected(callback2);

      barcodeDetectionService.clearCallbacks();

      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 80,
          format: 'code_128',
        },
      };

      detectionHandler(mockResult);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should use correct Quagga configuration', () => {
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(mockVideoElement);

      const config = mockQuagga.init.mock.calls[0][0];

      expect(config).toEqual({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: mockVideoElement,
          constraints: {
            width: 640,
            height: 480,
            facingMode: 'environment',
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        numOfWorkers: 2,
        frequency: 10,
        decoder: {
          readers: [
            'code_128_reader',
            'ean_reader',
            'ean_8_reader',
            'code_39_reader',
            'code_39_vin_reader',
            'codabar_reader',
            'upc_reader',
            'upc_e_reader',
            'i2of5_reader',
          ],
        },
        locate: true,
      });
    });

    it('should support different video element dimensions', () => {
      const largeVideoElement = {
        videoWidth: 1920,
        videoHeight: 1080,
      } as HTMLVideoElement;

      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(largeVideoElement);

      const config = mockQuagga.init.mock.calls[0][0];
      expect(config.inputStream.constraints).toEqual({
        width: 1920,
        height: 1080,
        facingMode: 'environment',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple start calls', () => {
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(mockVideoElement);
      barcodeDetectionService.startDetection(mockVideoElement);
      barcodeDetectionService.startDetection(mockVideoElement);

      // Should stop previous detection before starting new one
      expect(mockQuagga.stop).toHaveBeenCalledTimes(2);
      expect(mockQuagga.start).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple stop calls', () => {
      mockQuagga.init.mockImplementation((_config: any, callback: any) => {
        callback(null);
      });

      barcodeDetectionService.startDetection(mockVideoElement);
      barcodeDetectionService.stopDetection();
      barcodeDetectionService.stopDetection();
      barcodeDetectionService.stopDetection();

      // Should only stop once
      expect(mockQuagga.stop).toHaveBeenCalledTimes(1);
    });

    it('should handle detection with exact confidence threshold', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      // Test with exact threshold (75)
      const mockResult = {
        codeResult: {
          code: 'TEST123',
          confidence: 75,
        },
      };

      detectionHandler(mockResult);

      expect(callback).not.toHaveBeenCalled(); // Should not call (needs > 75)

      // Test with just above threshold
      mockResult.codeResult.confidence = 76;
      detectionHandler(mockResult);

      expect(callback).toHaveBeenCalledWith('TEST123');
    });

    it('should handle empty barcode codes', () => {
      const callback = jest.fn();

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: '',
          confidence: 80,
        },
      };

      detectionHandler(mockResult);

      expect(callback).toHaveBeenCalledWith('');
    });

    it('should handle very long barcode codes', () => {
      const callback = jest.fn();
      const longCode = 'A'.repeat(1000);

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: longCode,
          confidence: 80,
        },
      };

      detectionHandler(mockResult);

      expect(callback).toHaveBeenCalledWith(longCode);
    });

    it('should handle special characters in barcode codes', () => {
      const callback = jest.fn();
      const specialCode = 'TEST-123_ABC@#$%^&*()';

      barcodeDetectionService.onBarcodeDetected(callback);
      barcodeDetectionService.startDetection(mockVideoElement);

      const detectionHandler = mockQuagga.onDetected.mock.calls[0][0];

      const mockResult = {
        codeResult: {
          code: specialCode,
          confidence: 80,
        },
      };

      detectionHandler(mockResult);

      expect(callback).toHaveBeenCalledWith(specialCode);
    });
  });
});

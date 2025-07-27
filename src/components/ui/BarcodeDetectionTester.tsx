import React, { useState, useRef } from 'react';
import { BarcodeDetectionService } from '../../services/BarcodeDetectionService';
import Button from './Button';

interface BarcodeDetectionTesterProps {
  videoElement?: HTMLVideoElement | null;
}

export const BarcodeDetectionTester: React.FC<BarcodeDetectionTesterProps> = ({
  videoElement
}) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedBarcodes, setDetectedBarcodes] = useState<Array<{barcode: string, confidence: number, timestamp: string}>>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const detectionServiceRef = useRef<BarcodeDetectionService | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-9), logMessage]); // Keep last 10 logs
    console.log(logMessage);
  };

  const startTestDetection = () => {
    if (!videoElement) {
      addLog('❌ No video element provided');
      return;
    }

    addLog('🎯 Starting barcode detection test...');
    
    if (!detectionServiceRef.current) {
      detectionServiceRef.current = new BarcodeDetectionService();
    }

    const service = detectionServiceRef.current;

    // Set up test callback
    const handleBarcodeDetected = (barcode: string) => {
      const timestamp = new Date().toLocaleTimeString();
      addLog(`✅ Barcode detected: "${barcode}"`);
      setDetectedBarcodes(prev => [...prev, { barcode, confidence: 0, timestamp }]);
    };

    service.onBarcodeDetected(handleBarcodeDetected);
    service.startDetection(videoElement);
    setIsDetecting(true);
    addLog('🚀 Detection test started');
  };

  const stopTestDetection = () => {
    if (detectionServiceRef.current) {
      detectionServiceRef.current.stopDetection();
      detectionServiceRef.current.clearCallbacks();
      setIsDetecting(false);
      addLog('🛑 Detection test stopped');
    }
  };

  const clearResults = () => {
    setDetectedBarcodes([]);
    setLogs([]);
    addLog('🧹 Results cleared');
  };

  const runDiagnostics = () => {
    addLog('🔍 Running diagnostics...');
    
    if (!videoElement) {
      addLog('❌ No video element');
      return;
    }

    addLog(`📹 Video ready state: ${videoElement.readyState}`);
    addLog(`📐 Video dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    addLog(`▶️ Video paused: ${videoElement.paused}`);
    addLog(`🎬 Has src object: ${!!videoElement.srcObject}`);
    addLog(`🔊 Video volume: ${videoElement.volume}`);
    addLog(`⏰ Current time: ${videoElement.currentTime}`);
    
    if (videoElement.readyState < 2) {
      addLog('⚠️ Video not ready for playback');
    }
    
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      addLog('⚠️ Video has no dimensions - this will prevent barcode detection');
    }
    
    if (videoElement.paused) {
      addLog('⚠️ Video is paused - barcode detection needs playing video');
    }
    
    if (!videoElement.srcObject) {
      addLog('⚠️ Video has no source stream');
    }
  };

  return (
    <div className="barcode-tester" style={{ 
      padding: '20px', 
      border: '2px solid #333', 
      borderRadius: '8px',
      backgroundColor: '#f5f5f5',
      fontFamily: 'monospace'
    }}>
      <h3>🔍 Barcode Detection Tester</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <Button 
          onClick={startTestDetection} 
          disabled={isDetecting || !videoElement}
          className="neo-button neo-button--success"
        >
          🚀 Start Test Detection
        </Button>
        
        <Button 
          onClick={stopTestDetection} 
          disabled={!isDetecting}
          className="neo-button neo-button--danger"
          style={{ marginLeft: '10px' }}
        >
          🛑 Stop Detection
        </Button>
        
        <Button 
          onClick={runDiagnostics}
          className="neo-button neo-button--info"
          style={{ marginLeft: '10px' }}
        >
          🔍 Run Diagnostics
        </Button>
        
        <Button 
          onClick={clearResults}
          className="neo-button neo-button--secondary"
          style={{ marginLeft: '10px' }}
        >
          🧹 Clear
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <h4>📊 Detected Barcodes ({detectedBarcodes.length})</h4>
          <div style={{ 
            maxHeight: '150px', 
            overflowY: 'auto', 
            border: '1px solid #ccc', 
            padding: '10px',
            backgroundColor: '#fff'
          }}>
            {detectedBarcodes.length === 0 ? (
              <div style={{ color: '#666' }}>No barcodes detected yet...</div>
            ) : (
              detectedBarcodes.map((item, index) => (
                <div key={index} style={{ 
                  padding: '5px', 
                  borderBottom: '1px solid #eee',
                  fontSize: '12px'
                }}>
                  <strong>{item.barcode}</strong> at {item.timestamp}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h4>📝 Debug Logs</h4>
          <div style={{ 
            maxHeight: '150px', 
            overflowY: 'auto', 
            border: '1px solid #ccc', 
            padding: '10px',
            backgroundColor: '#fff',
            fontSize: '11px'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#666' }}>No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={{ 
                  padding: '2px 0',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <strong>💡 Testing Tips:</strong>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>Point camera at a clear barcode (Code 128, EAN, UPC, etc.)</li>
          <li>Ensure good lighting and stable camera position</li>
          <li>Try different distances from the barcode</li>
          <li>Confidence threshold is temporarily lowered to 50% for testing</li>
          <li>Check browser console for detailed Quagga logs</li>
        </ul>
      </div>
    </div>
  );
}; 
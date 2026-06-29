import React, { useEffect, useRef, useState, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';
import { useCameraPermission } from '@/hooks/useCameraPermission';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  /** Called with the raw scanned value (employee ID) when a QR code is read. */
  onScanSuccess: (employeeId: string) => void;
  onScanError?: (error: string) => void;
  className?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  onScanError,
  className
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const [isScanning, setIsScanning] = useState(false);
  const { permissionState, isLoading, error, requestPermission, reset } = useCameraPermission();

  const stopScanning = useCallback(() => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
    isScanningRef.current = false;
  }, []);

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (permissionState === 'prompt' || permissionState === 'unknown') {
        const granted = await requestPermission();
        if (!granted) return;
      }

      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          const now = Date.now();
          if (now - lastScanTimeRef.current < 2000) return;
          lastScanTimeRef.current = now;

          const scanned = result.data.trim().toUpperCase();
          if (!scanned) {
            onScanError?.('Could not read QR code. Please try again.');
            return;
          }
          // Hand the employee ID to the parent — same as typing it manually
          onScanSuccess(scanned);
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      await qrScannerRef.current.start();
      setIsScanning(true);
      isScanningRef.current = true;
    } catch {
      onScanError?.('Failed to start camera. Please check permissions.');
    }
  }, [permissionState, requestPermission, onScanSuccess, onScanError]);

  const toggleScanning = useCallback(() => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  }, [isScanning, startScanning, stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanning(); };
  }, [stopScanning]);

  // Stop if permission revoked while scanning
  useEffect(() => {
    if (permissionState === 'denied' && isScanning) stopScanning();
  }, [permissionState, isScanning, stopScanning]);

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-0">
        {/* Camera View — fixed height so the kiosk never overflows the viewport */}
        <div className="relative h-52 bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline />

          {/* Scanning overlay */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-green-400 animate-pulse" />
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-green-400" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-green-400" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-green-400" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-green-400" />
            </div>
          )}

          {/* Permission / idle overlay */}
          {!isScanning && (
            <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center">
              <div className="text-center text-white p-6">
                {permissionState === 'denied' || error ? (
                  <>
                    <CameraOff className="w-16 h-16 mx-auto mb-4 text-red-400" />
                    <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      {error || 'Please enable camera access to scan QR codes'}
                    </p>
                    <Button
                      onClick={reset}
                      variant="outline"
                      className="text-white border-white hover:bg-white hover:text-gray-900"
                    >
                      Try Again
                    </Button>
                  </>
                ) : (
                  <>
                    <Camera className="w-16 h-16 mx-auto mb-4 text-blue-400" />
                    <h3 className="text-lg font-semibold mb-2">Ready to Scan</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Click the button below to start scanning QR codes
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex items-center justify-between">
            <Badge variant={isScanning ? "default" : "secondary"}>
              {isScanning ? "Scanning" : "Inactive"}
            </Badge>

            <Button
              onClick={toggleScanning}
              disabled={permissionState === 'denied' || isLoading}
              variant={isScanning ? "destructive" : "default"}
            >
              {isScanning ? (
                <><CameraOff className="w-4 h-4 mr-2" /> Stop</>
              ) : (
                <><Camera className="w-4 h-4 mr-2" /> Start Scanning</>
              )}
            </Button>
          </div>

          {error && (
            <Alert className="mt-3" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

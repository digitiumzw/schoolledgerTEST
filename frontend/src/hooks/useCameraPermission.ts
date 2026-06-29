import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

export interface UseCameraPermissionReturn {
  permissionState: PermissionState;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  reset: () => void;
}

export function useCameraPermission(): UseCameraPermissionReturn {
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPermission = useCallback(async () => {
    try {
      // Check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API is not supported in this browser');
        setPermissionState('denied');
        return;
      }

      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setPermissionState(result.state as PermissionState);

      // Listen for permission changes
      result.addEventListener('change', () => {
        setPermissionState(result.state as PermissionState);
      });
    } catch (err) {
      // Some browsers don't support permissions API for camera
      // We'll handle this during requestPermission
      setPermissionState('unknown');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // If we get here, permission was granted
      setPermissionState('granted');
      
      // Stop the stream immediately since we're just checking permission
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setError('Camera permission denied. Please enable camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
        setPermissionState('denied');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application.');
        setPermissionState('denied');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}`);
        setPermissionState('denied');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPermissionState('unknown');
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    permissionState,
    isLoading,
    error,
    requestPermission,
    reset
  };
}

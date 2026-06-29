/**
 * QR Code Component
 * 
 * Generates a QR code for a given URL and provides download functionality.
 * Uses the qrcode library to generate QR codes as PNG images.
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "./button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeProps {
  value: string;
  filename?: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({ 
  value, 
  filename = "qrcode.png", 
  size = 200,
  className = "" 
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!value || !canvasRef.current) return;

    const generateQR = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await QRCode.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error generating QR code:', err);
        setError('Failed to generate QR code');
        setIsLoading(false);
      }
    };

    generateQR();
  }, [value, size]);

  const handleDownload = async () => {
    if (!canvasRef.current) return;

    try {
      canvasRef.current.toBlob((blob) => {
        if (!blob) {
          toast({
            title: "Error",
            description: "Failed to generate image",
            variant: "destructive"
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Success",
          description: "QR code downloaded successfully",
        });
      });
    } catch (err) {
      console.error('Error downloading QR code:', err);
      toast({
        title: "Error",
        description: "Failed to download QR code",
        variant: "destructive"
      });
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className}`} style={{ width: size, height: size }}>
        <p className="text-sm text-muted-foreground text-center px-2">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <div className="relative bg-white p-2 rounded-lg border">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{ width: size, height: size }}
            className="block"
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isLoading || !!error}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Download QR Code
        </Button>
      </div>
    </div>
  );
}

import React from 'react';
import QRCode from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeDisplayProps {
  employeeId: string;
  staffName: string;
  className?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  employeeId,
  staffName,
  className
}) => {
  const { toast } = useToast();

  const downloadPNG = async () => {
    try {
      const QRCodeLib = (await import('qrcode')).default;
      const dataUrl = await QRCodeLib.toDataURL(employeeId, { width: 400, margin: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${staffName.replace(/\s+/g, '_')}_qr_code.png`;
      link.click();
      toast({ title: "Downloaded", description: "QR code saved as PNG." });
    } catch {
      toast({ title: "Error", description: "Failed to download QR code.", variant: "destructive" });
    }
  };

  const downloadPDF = async () => {
    try {
      const [{ jsPDF }, QRCodeLib] = await Promise.all([
        import('jspdf'),
        import('qrcode').then(m => m.default),
      ]);
      const pdf = new jsPDF();

      pdf.setFontSize(20);
      pdf.text('Staff Attendance QR Code', 105, 30, { align: 'center' });

      pdf.setFontSize(12);
      pdf.text(`Name: ${staffName}`, 20, 60);
      pdf.text(`Employee ID: ${employeeId}`, 20, 72);

      const qrDataUrl = await QRCodeLib.toDataURL(employeeId, { width: 240, margin: 1 });
      pdf.addImage(qrDataUrl, 'PNG', 75, 90, 60, 60);

      pdf.setFontSize(10);
      pdf.text('Instructions:', 20, 170);
      pdf.text('1. Present this QR code at the attendance kiosk', 20, 180);
      pdf.text('2. Ensure the QR code is clearly visible to the camera', 20, 190);
      pdf.text('3. Wait for the confirmation message', 20, 200);
      pdf.text('4. Keep this QR code safe — do not share it', 20, 210);

      pdf.save(`${staffName.replace(/\s+/g, '_')}_qr_code.pdf`);
      toast({ title: "Downloaded", description: "QR code saved as PDF." });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
  };

  if (!employeeId) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">QR Code</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No Employee ID assigned. Edit the staff record to add one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">QR Code</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-white rounded-lg border">
            <QRCode
              value={employeeId}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Employee ID: <span className="font-mono font-semibold">{employeeId}</span>
          </p>
          <div className="flex gap-2 w-full">
            <Button onClick={downloadPNG} className="flex-1" variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>
            <Button onClick={downloadPDF} className="flex-1" variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Download, FileUp, Info, Loader2, Upload } from 'lucide-react';
import { api } from '@/api/api';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExecuteImport, useValidateImport } from '@/hooks/useStudentImport';
import type { ImportExecuteResult, ImportValidationResult } from '@/types/dashboard';

export default function StudentBulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportExecuteResult | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const validateImport = useValidateImport();
  const executeImport = useExecuteImport();

  async function handleTemplateDownload() {
    setDownloadError(null);
    try {
      const blob = await api.downloadStudentImportTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_import_template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not download CSV template.');
    }
  }

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setValidation(null);
    setImportResult(null);
    validateImport.reset();
    executeImport.reset();
  }

  async function handleValidate() {
    if (!file) return;
    const result = await validateImport.mutateAsync(file);
    setValidation(result);
    setImportResult(null);
  }

  async function handleExecute() {
    if (!file || !validation?.valid) return;
    const result = await executeImport.mutateAsync(file);
    setImportResult(result);
  }

  function resetImport() {
    selectFile(null);
    setImportResult(null);
  }

  const isBusy = validateImport.isPending || executeImport.isPending;

  return (
    <SubscriptionGuard feature="students">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bulk Import Students</h1>
            <p className="text-muted-foreground">Download a CSV template, fill it offline, then upload it to create students in bulk.</p>
          </div>
          <Button variant="outline" onClick={handleTemplateDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV Template
          </Button>
        </div>

        <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle>Use the import template — not an exported file</AlertTitle>
          <AlertDescription>
            The CSV produced by <strong>Export CSV</strong> on the Students page contains extra columns (e.g. <code className="text-xs font-mono">class_name</code>, <code className="text-xs font-mono">status</code>) that are not supported for import and will be rejected. Always start from the <button onClick={handleTemplateDownload} className="underline font-medium cursor-pointer bg-transparent border-none p-0 text-blue-700 dark:text-blue-300 hover:text-blue-900">downloaded import template</button>. Use the optional <code className="text-xs font-mono">opening_balance</code> column to record any fee debt the student already owes (e.g. from a previous system). Leave it blank for new students with no prior balance.
          </AlertDescription>
        </Alert>

        {downloadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Template download failed</AlertTitle>
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}

        {importResult ? (
          <Alert className="border-green-200 bg-green-50 text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertTitle>{importResult.imported} students imported successfully</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Students imported successfully. Please go to the Classes page to assign students to their respective classes using the multi-select feature.</span>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/classes">Go to Classes Page</Link>
                </Button>
                <Button variant="outline" onClick={resetImport}>Import More Students</Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Upload completed CSV</CardTitle>
              <CardDescription>CSV files up to 10 MB are supported. Validate the file before importing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div
                className="rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/40"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  selectFile(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <FileUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Drop your CSV file here, or choose a file</p>
                <p className="mb-4 text-sm text-muted-foreground">Use the downloaded template to avoid formatting errors.</p>
                <input
                  id="student-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                />
                <Button asChild variant="outline">
                  <label htmlFor="student-import-file" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Choose CSV File
                  </label>
                </Button>
              </div>

              {file && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <span className="font-medium">{file.name}</span>
                  <span className="ml-2 text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}

              {validateImport.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Validation failed</AlertTitle>
                  <AlertDescription>{validateImport.error.message}</AlertDescription>
                </Alert>
              )}

              {executeImport.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import failed</AlertTitle>
                  <AlertDescription>{executeImport.error.message}</AlertDescription>
                </Alert>
              )}

              {validation?.valid && (
                <Alert className="border-green-200 bg-green-50 text-green-900">
                  <CheckCircle2 className="h-4 w-4 text-green-700" />
                  <AlertTitle>All {validation.totalRows} rows are valid — ready to import</AlertTitle>
                  <AlertDescription>Review the selected file, then click Import to create the student records.</AlertDescription>
                </Alert>
              )}

              {validation && !validation.valid && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Validation errors</CardTitle>
                    <CardDescription>{validation.errorCount} issue(s) found across {validation.totalRows} row(s).</CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-80 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Error message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validation.errors.map((error, index) => (
                          <TableRow key={`${error.row}-${error.field}-${index}`}>
                            <TableCell>{error.row}</TableCell>
                            <TableCell>{error.field}</TableCell>
                            <TableCell>{error.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleValidate} disabled={!file || isBusy}>
                  {validateImport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Validate
                </Button>
                <Button onClick={handleExecute} disabled={!file || !validation?.valid || isBusy}>
                  {executeImport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {executeImport.isPending ? 'Importing students…' : 'Import'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SubscriptionGuard>
  );
}

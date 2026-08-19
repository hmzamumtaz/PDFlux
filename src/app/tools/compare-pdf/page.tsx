'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { comparePdfs } from '@/lib/pdf-engine';

export default function ComparePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ pages1: number; pages2: number; identical: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = useCallback(async () => {
    if (files.length < 2) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await comparePdfs(files[0], files[1]);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Comparison failed');
    } finally {
      setProcessing(false);
    }
  }, [files]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to all tools
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compare PDF</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Compare two PDF files side by side</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple
            maxFiles={2}
            files={files}
            onFilesSelected={(f) => { setFiles(f.slice(0, 2)); setResult(null); setError(null); }}
            onRemoveFile={(i) => setFiles(prev => prev.filter((_, idx) => idx !== i))}
            label="Drop two PDF files to compare"
            description="Upload exactly 2 PDF files"
          />

          {result && (
            <div className="mt-6 p-6 bg-gray-50 rounded-xl animate-fade-in">
              <h3 className="text-lg font-semibold text-foreground mb-4">Comparison Results</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-white rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">File 1</p>
                  <p className="text-2xl font-bold text-foreground">{result.pages1} pages</p>
                </div>
                <div className="p-4 bg-white rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground">File 2</p>
                  <p className="text-2xl font-bold text-foreground">{result.pages2} pages</p>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${result.identical ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`font-semibold ${result.identical ? 'text-green-700' : 'text-amber-700'}`}>
                  {result.identical ? 'Files are identical' : 'Files are different'}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {files.length === 2 && !result && (
            <div className="mt-6">
              <button
                onClick={handleProcess}
                disabled={processing}
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-primary hover:bg-primary-hover text-white hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</> : <><Check className="w-4 h-4" /> Compare Files</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, FileDown, AlertCircle, CheckCircle2, ScanText } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { ocrPdf, OcrResult, downloadBlob } from '@/lib/pdf-engine';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function OcrPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    setProgress('Starting OCR...');
    try {
      const res = await ocrPdf(files[0], (page, total, msg) => setProgress(msg));
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'OCR processing failed');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  }, [files]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, files[0].name.replace(/\.pdf$/i, '_ocr.pdf'));
  }, [result, files]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-lime-50"><ScanText className="w-6 h-6 text-lime-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">OCR PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Convert scanned PDFs into selectable and searchable text</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple={false}
            files={files}
            onFilesSelected={(f) => { setFiles(f); setResult(null); setError(null); setProgress(''); }}
            onRemoveFile={() => { setFiles([]); setResult(null); setProgress(''); }}
          />

          {files.length > 0 && !result && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">File</span>
                  <span className="text-sm font-medium text-foreground">{files[0].name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Size</span>
                  <span className="text-sm font-medium text-foreground">{formatBytes(files[0].size)}</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800 leading-relaxed">
                  <span className="font-semibold">What this does:</span> Scans each page using OCR, extracts all visible text, and creates a new PDF with an invisible text layer. The result is a fully selectable and searchable PDF while keeping the original visual appearance intact.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {processing && progress && (
                <div className="p-4 bg-lime-50 border border-lime-200 rounded-xl flex items-center gap-3 animate-fade-in">
                  <Loader2 className="w-4 h-4 animate-spin text-lime-600" />
                  <p className="text-sm font-medium text-lime-800">{progress}</p>
                </div>
              )}

              <button onClick={handleProcess} disabled={processing}
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-white hover:shadow-lg hover:shadow-lime-500/25 active:scale-[0.98] disabled:opacity-50">
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing OCR...</> : <><ScanText className="w-4 h-4" /> Start OCR</>}
              </button>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4 animate-fade-in">
              <div className="p-5 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">OCR completed successfully</p>
                  <p className="text-sm text-green-700">
                    Processed {result.pages} page{result.pages > 1 ? 's' : ''} and extracted {result.totalChars.toLocaleString()} characters of text.
                  </p>
                </div>
              </div>

              <div className="p-5 bg-gray-50 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Output file size</span>
                  <span className="text-lg font-bold text-foreground">{formatBytes(result.blob.size)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleDownload} className="px-6 py-3 rounded-xl font-semibold text-sm bg-primary hover:bg-primary-hover text-white transition-all flex items-center gap-2">
                  <FileDown className="w-4 h-4" /> Download OCR PDF
                </button>
                <button onClick={() => { setResult(null); }} className="px-6 py-3 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors">
                  Process Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

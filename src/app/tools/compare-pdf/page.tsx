'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, FileText, AlertCircle, Check, X, Scale } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { comparePdfs, CompareResult } from '@/lib/pdf-engine';

function Row({ label, value1, value2, match }: { label: string; value1: string; value2: string; match: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr_24px_1fr] gap-2 items-center py-2 border-b border-border last:border-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground truncate">{value1}</span>
      <span className="flex justify-center">{match ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}</span>
      <span className="text-sm text-foreground truncate">{value2}</span>
    </div>
  );
}

function SimilarityBar({ value }: { value: number }) {
  const color = value === 100 ? 'bg-green-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

export default function ComparePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50"><Scale className="w-6 h-6 text-blue-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compare PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Compare two PDF files side by side</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple
            maxFiles={2}
            files={files}
            onFilesSelected={(f) => { setFiles(f.slice(0, 2)); setResult(null); setError(null); }}
            onRemoveFile={(i) => { setFiles(prev => prev.filter((_, idx) => idx !== i)); setResult(null); }}
            label="Drop two PDF files to compare"
            description="Upload exactly 2 PDF files"
          />

          {files.length === 2 && !result && (
            <div className="mt-6">
              <button onClick={handleProcess} disabled={processing} className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-primary hover:bg-primary-hover text-white hover:shadow-lg active:scale-[0.98] disabled:opacity-50">
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</> : <><Scale className="w-4 h-4" /> Compare Files</>}
              </button>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-6 animate-fade-in">
              {/* Overall verdict */}
              <div className={`p-5 rounded-xl border ${result.identical ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-3">
                  {result.identical ? <Check className="w-6 h-6 text-green-600" /> : <X className="w-6 h-6 text-amber-600" />}
                  <div>
                    <p className={`text-lg font-bold ${result.identical ? 'text-green-800' : 'text-amber-800'}`}>
                      {result.identical ? 'Files are identical' : 'Files are different'}
                    </p>
                    <p className={`text-sm ${result.identical ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.differingPages.length > 0
                        ? `${result.differingPages.length} of ${Math.max(result.file1.pages, result.file2.pages)} pages have differences`
                        : 'All pages have the same text content'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Text similarity */}
              <div className="p-5 bg-gray-50 rounded-xl border border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Text Similarity</h3>
                  <span className="text-2xl font-bold text-foreground">{result.textSimilarity}%</span>
                </div>
                <SimilarityBar value={result.textSimilarity} />
                <p className="text-xs text-muted-foreground mt-2">
                  {result.textSimilarity === 100 ? 'Text content is identical across all pages' : `Average similarity across all pages`}
                </p>
              </div>

              {/* File comparison table */}
              <div className="p-5 bg-gray-50 rounded-xl border border-border">
                <div className="grid grid-cols-[140px_1fr_24px_1fr] gap-2 pb-2 mb-1 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground">Property</span>
                  <span className="text-xs font-semibold text-foreground">{result.file1.name}</span>
                  <span />
                  <span className="text-xs font-semibold text-foreground">{result.file2.name}</span>
                </div>
                <Row label="Pages" value1={String(result.file1.pages)} value2={String(result.file2.pages)} match={result.file1.pages === result.file2.pages} />
                <Row label="File size" value1={`${(result.file1.fileSize / 1024).toFixed(1)} KB`} value2={`${(result.file2.fileSize / 1024).toFixed(1)} KB`} match={result.file1.fileSize === result.file2.fileSize} />
                <Row label="Title" value1={result.file1.title || '(none)'} value2={result.file2.title || '(none)'} match={result.file1.title === result.file2.title} />
                <Row label="Author" value1={result.file1.author || '(none)'} value2={result.file2.author || '(none)'} match={result.file1.author === result.file2.author} />
                <Row label="Creator" value1={result.file1.creator || '(none)'} value2={result.file2.creator || '(none)'} match={result.file1.creator === result.file2.creator} />
                <Row label="Page size" value1={result.file1.pageWidths.length > 0 ? `${result.file1.pageWidths[0]} × ${result.file1.pageHeights[0]} pt` : '-'} value2={result.file2.pageWidths.length > 0 ? `${result.file2.pageWidths[0]} × ${result.file2.pageHeights[0]} pt` : '-'} match={result.file1.pageWidths[0] === result.file2.pageWidths[0] && result.file1.pageHeights[0] === result.file2.pageHeights[0]} />
              </div>

              {/* Page-by-page differences */}
              {result.differingPages.length > 0 && (
                <div className="p-5 bg-gray-50 rounded-xl border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Pages with Differences</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.differingPages.map(pg => (
                      <span key={pg} className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium">Page {pg}</span>
                    ))}
                  </div>
                </div>
              )}

              {files.length === 2 && (
                <button onClick={() => setResult(null)} className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-gray-50 transition-colors">Compare Again</button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

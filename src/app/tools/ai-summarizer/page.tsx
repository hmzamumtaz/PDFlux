'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { pdfToMarkdown } from '@/lib/pdf-engine';

export default function AiSummarizerPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const text = await pdfToMarkdown(files[0]);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const summaryText = sentences.slice(0, 10).join('. ').trim();
      setSummary(summaryText || 'No extractable text found in this document. It may be a scanned image-based PDF.');
    } catch (err: any) {
      setError(err.message || 'Failed to summarize');
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
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-pink-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">AI Summarizer</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">Get an instant summary of your PDF document</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            files={files}
            onFilesSelected={(f) => { setFiles(f); setSummary(''); setError(null); }}
            onRemoveFile={(i) => { setFiles([]); setSummary(''); }}
          />

          {files.length > 0 && !summary && (
            <div className="mt-6">
              <button
                onClick={handleSummarize}
                disabled={processing}
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Generate Summary</>}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {summary && (
            <div className="mt-6 p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border border-pink-200 animate-fade-in">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-500" /> Summary
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
              <button
                onClick={() => navigator.clipboard.writeText(summary)}
                className="mt-4 text-xs font-medium text-primary hover:text-primary-hover"
              >
                Copy summary
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

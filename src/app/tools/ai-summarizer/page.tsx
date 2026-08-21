'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Sparkles, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { summarizePdf } from '@/lib/pdf-engine';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function AiSummarizerPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [wordCount, setWordCount] = useState(250);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ summary: string; wordCount: number; originalWordCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSummarize = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    try {
      const res = await summarizePdf(files[0], { wordCount }, (msg) => setProgress(msg));
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to summarize');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  }, [files, wordCount]);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-pink-50"><Sparkles className="w-6 h-6 text-pink-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Summarizer</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Get an intelligent summary of your PDF document</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple={false}
            files={files}
            onFilesSelected={(f) => { setFiles(f); setResult(null); setError(null); }}
            onRemoveFile={() => { setFiles([]); setResult(null); }}
          />

          {files.length > 0 && !result && (
            <div className="mt-6 space-y-5">
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

              {/* Summary length selector */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Summary length</label>
                <p className="text-xs text-muted-foreground mb-3">Approximate number of words in the summary.</p>
                <div className="flex flex-wrap gap-2">
                  {[100, 150, 250, 400, 600].map(wc => (
                    <button key={wc} onClick={() => setWordCount(wc)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${wordCount === wc ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-gray-50 text-muted-foreground hover:text-foreground'}`}>
                      {wc} words
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {processing && progress && (
                <div className="p-4 bg-pink-50 border border-pink-200 rounded-xl flex items-center gap-3 animate-fade-in">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-600" />
                  <p className="text-sm font-medium text-pink-800">{progress}</p>
                </div>
              )}

              <button onClick={handleSummarize} disabled={processing}
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white hover:shadow-lg hover:shadow-pink-500/25 active:scale-[0.98] disabled:opacity-50">
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Generate Summary</>}
              </button>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4 animate-fade-in">
              <div className="p-5 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Summary generated</p>
                  <p className="text-sm text-green-700">
                    {result.wordCount} words from {result.originalWordCount.toLocaleString()} original words ({Math.round((1 - result.wordCount / Math.max(result.originalWordCount, 1)) * 100)}% reduction)
                  </p>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" /> Summary
                </h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={handleCopy}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors flex items-center gap-2">
                  {copied ? <><Check className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
                <button onClick={() => setResult(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors">
                  Summarize Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

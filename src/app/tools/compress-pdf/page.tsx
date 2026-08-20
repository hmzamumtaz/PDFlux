'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, FileDown, AlertCircle, CheckCircle2, Minus, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { compressToTargetSize, CompressResult, downloadBlob } from '@/lib/pdf-engine';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}


export default function CompressPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState<'MB' | 'KB'>('MB');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const originalSize = files[0]?.size || 0;
  const targetBytes = targetValue ? parseFloat(targetValue) * (targetUnit === 'MB' ? 1048576 : 1024) : null;
  const targetValid = targetBytes !== null && targetBytes > 0;
  const noCompressionNeeded = targetValid && targetBytes >= originalSize;
  const isPossible = targetValid && targetBytes > 50000;
  const notPossible = targetValid && targetBytes <= 50000;

  const handleCompress = useCallback(async () => {
    if (files.length === 0 || !targetBytes) return;
    setProcessing(true);
    setError(null);
    setResult(null);
    setProgress('Starting compression...');
    try {
      const res = await compressToTargetSize(files[0], targetBytes, (msg) => setProgress(msg));
      setResult(res);
      if (!res.achieved) {
        setProgress('');
      }
    } catch (err: any) {
      setError(err.message || 'Compression failed');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  }, [files, targetBytes]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, files[0].name.replace(/\.pdf$/i, '_compressed.pdf'));
  }, [result, files]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-50"><TrendingDown className="w-6 h-6 text-emerald-500" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compress PDF</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Reduce PDF file size to your target</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            multiple={false}
            files={files}
            onFilesSelected={(f) => { setFiles(f); setResult(null); setError(null); setTargetValue(''); setProgress(''); }}
            onRemoveFile={() => { setFiles([]); setResult(null); setTargetValue(''); setProgress(''); }}
          />

          {files.length > 0 && !result && (
            <div className="mt-6 space-y-5">
              {/* Original size */}
              <div className="p-4 bg-gray-50 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Original size</span>
                  <span className="text-lg font-bold text-foreground">{formatBytes(originalSize)}</span>
                </div>
              </div>

              {/* Target size input */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Target file size</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={targetValue}
                    onChange={(e) => { setTargetValue(e.target.value); setResult(null); setError(null); }}
                    placeholder="0.0"
                    className="flex-1 px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                  <div className="flex rounded-xl border border-border overflow-hidden">
                    <button onClick={() => { setTargetUnit('MB'); setResult(null); setError(null); }}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${targetUnit === 'MB' ? 'bg-primary text-white' : 'bg-white text-muted-foreground hover:bg-gray-50'}`}>MB</button>
                    <button onClick={() => { setTargetUnit('KB'); setResult(null); setError(null); }}
                      className={`px-4 py-3 text-sm font-medium transition-colors border-l border-border ${targetUnit === 'KB' ? 'bg-primary text-white' : 'bg-white text-muted-foreground hover:bg-gray-50'}`}>KB</button>
                  </div>
                </div>
              </div>

              {/* Auto presets */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Quick presets</label>
                <div className="flex flex-wrap gap-2">
                  {[50, 25, 10, 5].map(pct => {
                    const presetBytes = Math.round(originalSize * pct / 100);
                    const useMB = presetBytes >= 1048576;
                    const presetNum = useMB ? (presetBytes / 1048576).toFixed(1) : (presetBytes / 1024).toFixed(0);
                    const presetUnit = useMB ? 'MB' : 'KB';
                    const isActive = targetValue === presetNum && targetUnit === presetUnit;
                    return (
                      <button key={pct} onClick={() => { setTargetValue(presetNum); setTargetUnit(presetUnit as 'MB' | 'KB'); setResult(null); setError(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isActive ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-gray-50 text-muted-foreground hover:text-foreground'}`}>
                        {pct}% ({presetNum} {presetUnit})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Analysis */}
              {targetValid && (
                <div className={`p-4 rounded-xl border animate-fade-in ${noCompressionNeeded ? 'bg-blue-50 border-blue-200' : notPossible ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-start gap-3">
                    {noCompressionNeeded ? (
                      <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    ) : notPossible ? (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      {noCompressionNeeded ? (
                        <>
                          <p className="text-sm font-semibold text-blue-800">No compression needed</p>
                          <p className="text-sm text-blue-700">Target size ({formatBytes(targetBytes)}) is larger than the original ({formatBytes(originalSize)}).</p>
                        </>
                      ) : notPossible ? (
                        <>
                          <p className="text-sm font-semibold text-red-800">Target too small</p>
                          <p className="text-sm text-red-700">Target size ({formatBytes(targetBytes)}) is below the minimum possible size (~50 KB). Try a larger target.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-green-800">Compression possible</p>
                          <p className="text-sm text-green-700">
                            Reduce from {formatBytes(originalSize)} to {formatBytes(targetBytes)} ({Math.round((1 - targetBytes / originalSize) * 100)}% reduction)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {targetValid && !noCompressionNeeded && !notPossible && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 leading-relaxed">
                    <p className="font-semibold mb-1">Quality reduction warning</p>
                    <p>
                      {Math.round((1 - targetBytes / originalSize) * 100) >= 70
                        ? 'This is a very aggressive compression. Text may become blurry, images will lose significant detail, and the PDF will become image-based (text will no longer be selectable).'
                        : Math.round((1 - targetBytes / originalSize) * 100) >= 40
                        ? 'This level of compression will reduce image quality and may make text slightly less sharp. The PDF will become image-based (text will no longer be selectable).'
                        : 'Some image quality reduction will occur. Text and layout will remain mostly intact.'}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {processing && progress && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-fade-in">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-800">{progress}</p>
                </div>
              )}

              {targetValid && !noCompressionNeeded && !notPossible && (
                <button onClick={handleCompress} disabled={processing}
                  className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-50">
                  {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Compressing...</> : <><TrendingDown className="w-4 h-4" /> Compress to {formatBytes(targetBytes!)}</>}
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4 animate-fade-in">
              <div className={`p-5 rounded-xl border ${result.achieved ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  {result.achieved ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
                  <div>
                    <p className={`text-sm font-semibold ${result.achieved ? 'text-green-800' : 'text-amber-800'}`}>
                      {result.achieved ? 'Compression successful' : 'Could not reach target size'}
                    </p>
                    <p className={`text-sm ${result.achieved ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.achieved
                        ? `Reduced from ${formatBytes(result.originalSize)} to ${formatBytes(result.compressedSize)} (${Math.round((1 - result.compressedSize / result.originalSize) * 100)}% smaller)`
                        : `Smallest achievable: ${formatBytes(result.compressedSize)} (target was ${formatBytes(result.targetSize)})`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Size comparison */}
              <div className="p-5 bg-gray-50 rounded-xl border border-border">
                <div className="flex items-center gap-4">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Original</p>
                    <p className="text-xl font-bold text-foreground">{formatBytes(result.originalSize)}</p>
                  </div>
                  <Minus className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Compressed</p>
                    <p className="text-xl font-bold text-green-600">{formatBytes(result.compressedSize)}</p>
                  </div>
                  <Minus className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Saved</p>
                    <p className="text-xl font-bold text-primary">{formatBytes(result.originalSize - result.compressedSize)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.max(5, (result.compressedSize / result.originalSize) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">0</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(result.originalSize)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleDownload} className="px-6 py-3 rounded-xl font-semibold text-sm bg-primary hover:bg-primary-hover text-white transition-all flex items-center gap-2">
                  <FileDown className="w-4 h-4" /> Download Compressed PDF
                </button>
                <button onClick={() => { setResult(null); setTargetValue(''); }} className="px-6 py-3 rounded-xl text-sm font-medium border border-border hover:bg-gray-50 transition-colors">
                  Compress Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

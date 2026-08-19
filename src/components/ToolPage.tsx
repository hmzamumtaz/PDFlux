'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Download, Loader2, Check, AlertCircle, FileText, Eye, Trash2, X, FileDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import Link from 'next/link';
import { getToolBySlug } from '@/lib/tools-data';
import FileUpload from './FileUpload';
import { downloadBlob } from '@/lib/pdf-engine';

interface ToolPageProps {
  slug: string;
  children?: React.ReactNode;
  options?: React.ReactNode;
  multiple?: boolean;
  accept?: string;
  onProcess: (files: File[], options?: any) => Promise<Blob | Blob[]>;
  processLabel?: string;
  processAllTogether?: boolean;
}

interface ProcessedResult {
  sourceFile: File;
  result: Blob;
}

function ResultCard({ sourceFile, result, index, onDownload, onDelete }: { sourceFile: File; result: Blob; index: number; onDownload: () => void; onDelete: () => void }) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const isText = result.type === 'text/markdown' || result.type === 'text/plain' || result.type === 'text/html';
  const isPdf = result.type === 'application/pdf';
  const isImage = result.type.startsWith('image/');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handlePreview = async () => {
    if (isText) {
      const text = await result.text();
      setTextContent(text);
      setShowPreview(true);
    } else if (isPdf || isImage) {
      const url = URL.createObjectURL(result);
      setPreviewUrl(url);
      setShowPreview(true);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setTextContent(null);
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors animate-fade-in">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{sourceFile.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(result.size)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(isPdf || isText || isImage) && (
            <button onClick={handlePreview} className="p-2 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors" title="Preview">
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button onClick={onDownload} className="p-2 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors" title="Download">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">{sourceFile.name}</h3>
              <button onClick={closePreview} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isPdf && previewUrl && <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border border-border" />}
              {isImage && previewUrl && <img src={previewUrl} alt="Preview" className="max-w-full max-h-[70vh] mx-auto rounded-lg" />}
              {isText && textContent && (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-4 rounded-xl max-h-[70vh] overflow-auto">
                  {textContent.substring(0, 10000)}
                  {textContent.length > 10000 && '\n\n... (truncated)'}
                </pre>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button onClick={() => { onDownload(); closePreview(); }} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ToolPage({
  slug,
  children,
  options,
  multiple = true,
  accept = '.pdf',
  onProcess,
  processLabel = 'Process PDF',
  processAllTogether = false,
}: ToolPageProps) {
  const tool = getToolBySlug(slug);
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processOptions, setProcessOptions] = useState<any>({});
  const [results, setResults] = useState<ProcessedResult[]>([]);

  const allSelected = files.length > 0 && selected.size === files.length;
  const someSelected = selected.size > 0 && !allSelected;

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    setResults([]);
    setError(null);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setSelected(prev => {
      const next = new Set<number>();
      prev.forEach(i => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
    setResults([]);
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((_, i) => i)));
    }
  }, [allSelected, files]);

  const toggleFile = useCallback((index: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    setError(null);
    setResults([]);

    const indices = Array.from(selected).sort((a, b) => a - b);
    const selectedFiles = indices.map(i => files[i]);
    const newResults: ProcessedResult[] = [];

    try {
      if (processAllTogether) {
        setProgress({ current: 1, total: 1, currentFile: `${selectedFiles.length} files` });
        const result = await onProcess(selectedFiles, processOptions);
        if (Array.isArray(result)) {
          result.forEach(blob => newResults.push({ sourceFile: selectedFiles[0], result: blob }));
        } else {
          newResults.push({ sourceFile: selectedFiles[0], result });
        }
        setResults([...newResults]);
      } else {
        for (let idx = 0; idx < selectedFiles.length; idx++) {
          const file = selectedFiles[idx];
          setProgress({ current: idx + 1, total: selectedFiles.length, currentFile: file.name });
          const result = await onProcess([file], processOptions);
          if (Array.isArray(result)) {
            result.forEach(blob => newResults.push({ sourceFile: file, result: blob }));
          } else {
            newResults.push({ sourceFile: file, result });
          }
          setResults([...newResults]);
        }
      }
      setProgress(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
      setProgress(null);
    } finally {
      setProcessing(false);
    }
  }, [files, selected, onProcess, processOptions, processAllTogether]);

  const handleDownloadResult = useCallback((result: ProcessedResult, index: number) => {
    const extMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/markdown': '.md',
      'text/plain': '.txt',
      'text/html': '.html',
    };
    const ext = extMap[result.result.type] || (result.result.type.startsWith('image/') ? '.jpg' : '.bin');
    const baseName = result.sourceFile.name.replace(/\.pdf$/i, '');
    downloadBlob(result.result, `${baseName}${ext}`);
  }, []);

  const handleDeleteResult = useCallback((index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDownloadAll = useCallback(() => {
    results.forEach((r, i) => handleDownloadResult(r, i));
  }, [results, handleDownloadResult]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setSelected(new Set());
    setResults([]);
    setProgress(null);
    setError(null);
  }, []);

  if (!tool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Tool not found.</p>
      </div>
    );
  }

  const IconComponent = (LucideIcons as any)[tool.icon] || LucideIcons.FileText;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${tool.color}15` }}>
              <IconComponent className="w-6 h-6" style={{ color: tool.color }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{tool.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">{tool.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          {/* Upload Zone with integrated file selection */}
          <FileUpload
            accept={accept}
            multiple={multiple}
            files={files}
            onFilesSelected={handleFilesSelected}
            onRemoveFile={results.length === 0 ? handleRemoveFile : undefined}
            selectable={results.length === 0}
            selected={selected}
            onToggleFile={toggleFile}
            onToggleAll={toggleSelectAll}
            allSelected={allSelected}
            someSelected={someSelected}
          />

          {/* Options */}
          {options && files.length > 0 && results.length === 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              {options}
            </div>
          )}

          {/* Children */}
          {children && files.length > 0 && results.length === 0 && (
            <div className="mt-6">{children}</div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Progress Bar */}
          {progress && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-blue-800">
                  Processing {progress.current} of {progress.total}: {progress.currentFile}
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Process Button (before results) */}
          {files.length > 0 && results.length === 0 && !processing && (
            <div className="mt-6">
              <button
                onClick={handleProcess}
                disabled={selected.size === 0}
                className={`px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  selected.size > 0
                    ? 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                {processLabel} {selected.size > 0 && `(${selected.size})`}
              </button>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && !processing && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  {results.length} file{results.length > 1 ? 's' : ''} ready
                </h3>
                <div className="flex items-center gap-2">
                  {results.length > 1 && (
                    <button onClick={handleDownloadAll} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5">
                      <FileDown className="w-3.5 h-3.5" /> Download All
                    </button>
                  )}
                  <button onClick={handleReset} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
                    Delete All
                  </button>
                </div>
              </div>

              {results.map((r, i) => (
                <ResultCard
                  key={i}
                  sourceFile={r.sourceFile}
                  result={r.result}
                  index={i}
                  onDownload={() => handleDownloadResult(r, i)}
                  onDelete={() => handleDeleteResult(i)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full"></span>100% Private</span>
          <span>No files uploaded to any server</span>
        </div>
      </div>
    </div>
  );
}

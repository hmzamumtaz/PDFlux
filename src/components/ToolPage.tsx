'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Download, Loader2, Check, AlertCircle, FileText, Eye, Trash2, X, ChevronDown } from 'lucide-react';
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
}

function ResultPreview({ blob, index, onDownload, onDelete }: { blob: Blob; index: number; onDownload: () => void; onDelete: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);

  const isText = blob.type === 'text/markdown' || blob.type === 'text/plain' || blob.type === 'text/html';
  const isPdf = blob.type === 'application/pdf';
  const isImage = blob.type.startsWith('image/');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handlePreview = async () => {
    if (isText) {
      const text = await blob.text();
      setTextContent(text);
      setShowPreview(true);
    } else if (isPdf || isImage) {
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setTextContent(null);
  };

  const ext = isPdf ? '.pdf' : isImage ? '.jpg' : isText ? '.txt' : '.bin';
  const filename = `output_${index + 1}${ext}`;

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors animate-fade-in">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{filename}</p>
          <p className="text-xs text-muted-foreground">{formatSize(blob.size)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(isPdf || isText || isImage) && (
            <button
              onClick={handlePreview}
              className="p-2 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDownload}
            className="p-2 rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Preview</h3>
              <button onClick={closePreview} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isPdf && previewUrl && (
                <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border border-border" />
              )}
              {isImage && previewUrl && (
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[70vh] mx-auto rounded-lg" />
              )}
              {isText && textContent && (
                <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-4 rounded-xl max-h-[70vh] overflow-auto">
                  {textContent.substring(0, 10000)}
                  {textContent.length > 10000 && '\n\n... (truncated)'}
                </pre>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => { onDownload(); closePreview(); }}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
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
}: ToolPageProps) {
  const tool = getToolBySlug(slug);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processOptions, setProcessOptions] = useState<any>({});
  const [results, setResults] = useState<Blob[]>([]);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    setResults([]);
    setError(null);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResults([]);
  }, []);

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    setResults([]);
    try {
      const result = await onProcess(files, processOptions);
      if (Array.isArray(result)) {
        setResults(result);
      } else {
        setResults([result]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [files, onProcess, processOptions, tool]);

  const handleDownloadResult = useCallback((blob: Blob, index: number) => {
    const ext = blob.type === 'application/pdf' ? '.pdf' : blob.type.startsWith('image/') ? '.jpg' : blob.type === 'text/markdown' ? '.md' : '.txt';
    downloadBlob(blob, `${tool?.name?.replace(/\s/g, '_') || 'output'}_${index + 1}${ext}`);
  }, [tool]);

  const handleDeleteResult = useCallback((index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDownloadAll = useCallback(() => {
    results.forEach((blob, i) => handleDownloadResult(blob, i));
  }, [results, handleDownloadResult]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setResults([]);
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
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${tool.color}15` }}
            >
              <IconComponent className="w-6 h-6" style={{ color: tool.color }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{tool.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">{tool.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept={accept}
            multiple={multiple}
            files={files}
            onFilesSelected={handleFilesSelected}
            onRemoveFile={handleRemoveFile}
          />

          {options && files.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
              {options}
            </div>
          )}

          {children && files.length > 0 && (
            <div className="mt-6">
              {children}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {files.length > 0 && results.length === 0 && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleProcess}
                disabled={processing}
                className={`flex-1 sm:flex-none px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  processing
                    ? 'bg-primary/70 text-white cursor-wait'
                    : 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]'
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {processLabel}
                  </>
                )}
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  {results.length} file{results.length > 1 ? 's' : ''} ready
                </h3>
                <div className="flex items-center gap-2">
                  {results.length > 1 && (
                    <button
                      onClick={handleDownloadAll}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download All
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              </div>

              {results.map((blob, i) => (
                <ResultPreview
                  key={i}
                  blob={blob}
                  index={i}
                  onDownload={() => handleDownloadResult(blob, i)}
                  onDelete={() => handleDeleteResult(i)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            100% Private
          </span>
          <span>No files uploaded to any server</span>
        </div>
      </div>
    </div>
  );
}

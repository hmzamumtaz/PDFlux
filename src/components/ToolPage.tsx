'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Download, Loader2, Check, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getToolBySlug } from '@/lib/tools-data';
import FileUpload from './FileUpload';
import { downloadBlob, downloadBlobs } from '@/lib/pdf-engine';

interface ToolPageProps {
  slug: string;
  children?: React.ReactNode;
  options?: React.ReactNode;
  multiple?: boolean;
  accept?: string;
  onProcess: (files: File[], options?: any) => Promise<Blob | Blob[]>;
  processLabel?: string;
}

export default function ToolPage({
  slug,
  children,
  options,
  multiple = false,
  accept = '.pdf',
  onProcess,
  processLabel = 'Process PDF',
}: ToolPageProps) {
  const tool = getToolBySlug(slug);
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processOptions, setProcessOptions] = useState<any>({});

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles(newFiles);
    setDone(false);
    setError(null);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setDone(false);
  }, []);

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await onProcess(files, processOptions);
      if (Array.isArray(result)) {
        downloadBlobs(result, tool?.name?.replace(/\s/g, '_') || 'output');
      } else {
        downloadBlob(result, `${tool?.name?.replace(/\s/g, '_') || 'output'}.pdf`);
      }
      setDone(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [files, onProcess, processOptions, tool]);

  if (!tool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Tool not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
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
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tool.color }} />
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

          {files.length > 0 && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleProcess}
                disabled={processing || done}
                className={`flex-1 sm:flex-none px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  done
                    ? 'bg-green-500 text-white cursor-default'
                    : processing
                    ? 'bg-primary/70 text-white cursor-wait'
                    : 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]'
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : done ? (
                  <>
                    <Check className="w-4 h-4" />
                    Download Ready
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

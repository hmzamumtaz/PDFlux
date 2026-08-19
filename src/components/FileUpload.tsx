'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, X, Plus } from 'lucide-react';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  files: File[];
  onRemoveFile?: (index: number) => void;
  label?: string;
  description?: string;
}

export default function FileUpload({
  accept = '.pdf',
  multiple = false,
  maxFiles = 20,
  onFilesSelected,
  files,
  onRemoveFile,
  label = 'Drop your files here',
  description = 'or click to browse',
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).slice(0, maxFiles);
    if (droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
    }
  }, [maxFiles, onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).slice(0, maxFiles - files.length);
    if (selectedFiles.length > 0) {
      onFilesSelected([...files, ...selectedFiles]);
    }
    if (inputRef.current) inputRef.current.value = '';
  }, [files, maxFiles, onFilesSelected]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`upload-zone rounded-2xl p-12 text-center cursor-pointer transition-all ${
            isDragOver ? 'dragover border-primary bg-indigo-50/50' : 'hover:border-primary/50 hover:bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-primary/10' : 'bg-muted'}`}>
              <Upload className={`w-8 h-8 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{label}</p>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-muted rounded-md font-medium">{accept.replace(/\./g, '').toUpperCase()}</span>
              {multiple && <span>Up to {maxFiles} files</span>}
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl hover:bg-gray-50 transition-colors animate-fade-in"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              {onRemoveFile && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(index); }}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {multiple && files.length < maxFiles && (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add more files
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

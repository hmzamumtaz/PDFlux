'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, X, Plus, CheckSquare, Square, MinusSquare } from 'lucide-react';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  files: File[];
  onRemoveFile?: (index: number) => void;
  label?: string;
  description?: string;
  selected?: Set<number>;
  onToggleFile?: (index: number) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
  selectable?: boolean;
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
  selected,
  onToggleFile,
  onToggleAll,
  allSelected = false,
  someSelected = false,
  selectable = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // Dropped files bypass <input accept>, so enforce the filter here too —
  // otherwise a dropped .txt reaches the PDF parser and dies cryptically.
  const matchesAccept = useCallback((file: File) => {
    if (!accept) return true;
    const rules = accept.split(',').map(r => r.trim().toLowerCase()).filter(Boolean);
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();
    return rules.some(rule => {
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
  }, [accept]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    const accepted = dropped.filter(matchesAccept).slice(0, Math.max(0, maxFiles - files.length));
    if (accepted.length === 0 && dropped.length > 0) {
      setDropError(`Only ${accept.replace(/\./g, '').toUpperCase()} files are supported here.`);
      return;
    }
    setDropError(null);
    if (accepted.length > 0) {
      onFilesSelected(multiple ? accepted : accepted.slice(0, 1));
    }
  }, [accept, files.length, matchesAccept, maxFiles, multiple, onFilesSelected]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDropError(null);
    const selectedFiles = Array.from(e.target.files || []).slice(0, Math.max(0, maxFiles - files.length));
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
    if (inputRef.current) inputRef.current.value = '';
  }, [files.length, maxFiles, onFilesSelected]);

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
          {dropError && <p className="mt-3 text-xs text-destructive font-medium">{dropError}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All Bar */}
          {selectable && files.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={onToggleAll}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : someSelected ? <MinusSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-xs text-muted-foreground">
                {selected ? `${selected.size} of ${files.length} selected` : `${files.length} file${files.length > 1 ? 's' : ''}`}
              </span>
            </div>
          )}

          {/* File Rows */}
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              onClick={selectable && files.length > 1 && onToggleFile ? () => onToggleFile(index) : undefined}
              className={`flex items-center gap-3 p-4 border rounded-xl transition-all animate-fade-in ${
                selectable && files.length > 1
                  ? `cursor-pointer ${selected?.has(index) ? 'border-primary bg-primary/5' : 'border-border bg-white hover:bg-gray-50'}`
                  : 'border-border bg-white hover:bg-gray-50'
              }`}
            >
              {selectable && files.length > 1 && (
                <div className="shrink-0">
                  {selected?.has(index) ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-muted-foreground" />}
                </div>
              )}
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
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
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

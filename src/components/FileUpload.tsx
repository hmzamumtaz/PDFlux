'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Plus, HardDrive, Cloud, Loader2 } from 'lucide-react';

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

// Google Drive Picker types
declare global {
  interface Window {
    google: any;
    gapi: any;
    dropbox: any;
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_APP_KEY = process.env.NEXT_PUBLIC_GOOGLE_APP_KEY || '';
const DROPBOX_APP_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || '';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadGooglePickerAPI(): Promise<void> {
  await loadScript('https://apis.google.com/js/api.js');
  await loadScript('https://accounts.google.com/gsi/client');
  await new Promise<void>((resolve) => window.gapi.load('picker', { callback: resolve }));
}

async function loadDropboxChooserAPI(): Promise<void> {
  await loadScript('https://www.dropbox.com/static/api/2/dropins.js');
}

function getAccessTokenGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local'));
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
        } else {
          resolve(tokenResponse.access_token);
        }
      },
    });
    tokenClient.requestAccessToken();
  });
}

function openGooglePicker(token: string, accept: string, multiple: boolean, onPick: (files: File[]) => void) {
  const acceptMimes: Record<string, string[]> = {
    '.pdf': ['application/pdf'],
    '.jpg,.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.doc,.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  };
  const mimeTypes = acceptMimes[accept] || accept.split(',').map(a => a.trim());

  const picker = new window.google.picker.PickerBuilder()
    .setTitle('Select files from Google Drive')
    .addView(new window.google.picker.DocsView().setMimeTypes(mimeTypes.join(',')).setSelectFolderEnabled(false))
    .setOAuthToken(token)
    .setCallback(async (data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const pickedFiles: File[] = [];
        for (const doc of data.docs) {
          try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const blob = await response.blob();
            const ext = doc.mimeType === 'application/pdf' ? '.pdf' : doc.name.split('.').pop() || '';
            const fileName = doc.name || `drive-file-${doc.id}${ext}`;
            pickedFiles.push(new File([blob], fileName, { type: doc.mimeType }));
          } catch (err) {
            console.error('Failed to download file from Google Drive:', err);
          }
        }
        if (pickedFiles.length > 0) {
          onPick(pickedFiles);
        }
      }
    })
    .setMultiSelectEnabled(multiple)
    .build()
    .setVisible(true);
}

function openDropboxChooser(accept: string, multiple: boolean, onPick: (files: File[]) => void) {
  if (!DROPBOX_APP_KEY) {
    alert('Dropbox integration not configured. Set NEXT_PUBLIC_DROPBOX_APP_KEY in .env.local');
    return;
  }

  const extensions: Record<string, string[]> = {
    '.pdf': ['pdf'],
    '.jpg,.jpeg': ['jpg', 'jpeg'],
    '.png': ['png'],
    '.doc,.docx': ['doc', 'docx'],
  };
  const exts = extensions[accept] || [];

  window.dropbox.choose({
    success: async (files: any[]) => {
      const pickedFiles: File[] = [];
      for (const file of files) {
        try {
          const response = await fetch(file.link);
          const blob = await response.blob();
          pickedFiles.push(new File([blob], file.name, { type: file.bytes ? 'application/octet-stream' : undefined }));
        } catch (err) {
          console.error('Failed to download file from Dropbox:', err);
        }
      }
      if (pickedFiles.length > 0) {
        onPick(pickedFiles);
      }
    },
    cancel: () => {},
    link_type: 'direct',
    multiselect: multiple,
    extensions: exts,
    folderselect: false,
  });
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [dropboxLoading, setDropboxLoading] = useState(false);
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

  const handleGoogleDrive = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_APP_KEY) {
      alert('Google Drive is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_APP_KEY in .env.local');
      return;
    }
    setGoogleLoading(true);
    try {
      await loadGooglePickerAPI();
      const token = await getAccessTokenGoogle();
      openGooglePicker(token, accept, multiple, (newFiles) => {
        onFilesSelected([...files, ...newFiles].slice(0, maxFiles));
      });
    } catch (err: any) {
      console.error('Google Drive error:', err);
      alert(`Google Drive error: ${err.message}`);
    } finally {
      setGoogleLoading(false);
    }
  }, [accept, multiple, maxFiles, files, onFilesSelected]);

  const handleDropbox = useCallback(async () => {
    if (!DROPBOX_APP_KEY) {
      alert('Dropbox is not configured. Set NEXT_PUBLIC_DROPBOX_APP_KEY in .env.local');
      return;
    }
    setDropboxLoading(true);
    try {
      await loadDropboxChooserAPI();
      openDropboxChooser(accept, multiple, (newFiles) => {
        onFilesSelected([...files, ...newFiles].slice(0, maxFiles));
      });
    } catch (err: any) {
      console.error('Dropbox error:', err);
      alert(`Dropbox error: ${err.message}`);
    } finally {
      setDropboxLoading(false);
    }
  }, [accept, multiple, maxFiles, files, onFilesSelected]);

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

      {files.length === 0 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="text-xs text-muted-foreground">or import from</span>
          <button
            onClick={handleGoogleDrive}
            disabled={googleLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-gray-50 hover:bg-gray-100 border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            {googleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
            Google Drive
          </button>
          <button
            onClick={handleDropbox}
            disabled={dropboxLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-gray-50 hover:bg-gray-100 border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            {dropboxLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
            Dropbox
          </button>
        </div>
      )}
    </div>
  );
}

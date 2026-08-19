'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Loader2, Languages, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { pdfToMarkdown, downloadBlob } from '@/lib/pdf-engine';

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
  'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Dutch',
  'Swedish', 'Polish', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian',
];

export default function TranslatePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [translated, setTranslated] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      const text = await pdfToMarkdown(files[0]);
      const translatedText = `[Translation to ${targetLang}]\n\nNote: Full AI translation requires a backend API integration. Below is the extracted text from your PDF that can be translated using any translation service:\n\n${text}`;
      setTranslated(translatedText);
      const blob = new Blob([translatedText], { type: 'text/plain' });
      downloadBlob(blob, `translated_${targetLang}.txt`);
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setProcessing(false);
    }
  }, [files, targetLang]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to all tools
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Languages className="w-6 h-6 text-sky-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Translate PDF</h1>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">Extract and translate your PDF content</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
          <FileUpload
            accept=".pdf"
            files={files}
            onFilesSelected={(f) => { setFiles(f); setTranslated(''); setError(null); }}
            onRemoveFile={() => { setFiles([]); setTranslated(''); }}
          />

          {files.length > 0 && !translated && (
            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Target language</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full max-w-sm px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTranslate}
                disabled={processing}
                className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              >
                {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting text...</> : <><Languages className="w-4 h-4" /> Extract & Translate</>}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {translated && (
            <div className="mt-6 p-6 bg-sky-50 rounded-xl border border-sky-200 animate-fade-in">
              <h3 className="text-sm font-semibold text-foreground mb-3">Extracted Content</h3>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                {translated.substring(0, 3000)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

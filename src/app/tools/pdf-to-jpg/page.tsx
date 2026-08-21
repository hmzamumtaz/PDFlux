'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { pdfToImages } from '@/lib/pdf-engine';

export default function PdfToJpgPage() {
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [dpi, setDpi] = useState<'standard' | 'high'>('high');

  return (
    <ToolPage
      slug="pdf-to-jpg"
      accept=".pdf"
      processLabel="Convert to Images"
      options={
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Format</label>
            <div className="flex gap-2">
              {(['jpeg', 'png'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${format === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Resolution</label>
            <div className="flex gap-2">
              <button onClick={() => setDpi('standard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dpi === 'standard' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Standard (144 DPI)</button>
              <button onClick={() => setDpi('high')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dpi === 'high' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>High (216 DPI)</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Multiple pages download together as a single ZIP.</p>
        </div>
      }
      onProcess={async (files) => pdfToImages(files[0], { format, quality: 0.95, scale: dpi === 'high' ? 3 : 2 })}
    />
  );
}

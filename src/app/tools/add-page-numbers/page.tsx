'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { addPageNumbersToFile } from '@/lib/pdf-engine';

export default function AddPageNumbersPage() {
  const [position, setPosition] = useState<'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'>('bottom-center');

  return (
    <ToolPage
      slug="add-page-numbers"
      accept=".pdf"
      processLabel="Add Page Numbers"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Position</label>
          <div className="grid grid-cols-3 gap-2 max-w-xs">
            {(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  position === pos ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {pos.replace(/-/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      }
      onProcess={async (files) => addPageNumbersToFile(files[0], position)}
    />
  );
}

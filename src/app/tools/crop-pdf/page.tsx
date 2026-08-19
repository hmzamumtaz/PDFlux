'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { cropPdf } from '@/lib/pdf-engine';

export default function CropPdfPage() {
  const [margins, setMargins] = useState({ top: 50, bottom: 50, left: 50, right: 50 });

  return (
    <ToolPage
      slug="crop-pdf"
      accept=".pdf"
      processLabel="Crop PDF"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">Margins (points)</label>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div key={side}>
                <label className="text-xs text-muted-foreground capitalize mb-1 block">{side}</label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={margins[side]}
                  onChange={(e) => setMargins(prev => ({ ...prev, [side]: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Values in points (1 inch = 72 points). This crops from each edge.
          </p>
        </div>
      }
      onProcess={async (files) => cropPdf(files[0], margins)}
    />
  );
}

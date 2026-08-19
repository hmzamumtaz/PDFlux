'use client';

import { useState } from 'react';
import ToolPage from '@/components/ToolPage';
import { addWatermarkToFile } from '@/lib/pdf-engine';

export default function AddWatermarkPage() {
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.3);
  const [fontSize, setFontSize] = useState(50);

  return (
    <ToolPage
      slug="add-watermark"
      accept=".pdf"
      processLabel="Add Watermark"
      options={
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Watermark text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., CONFIDENTIAL"
              className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Opacity: {Math.round(opacity * 100)}%</label>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Font size: {fontSize}px</label>
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </div>
      }
      onProcess={async (files) => addWatermarkToFile(files[0], text, { opacity, fontSize })}
    />
  );
}

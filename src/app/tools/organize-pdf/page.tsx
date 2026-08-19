'use client';

import { useState, useEffect } from 'react';
import ToolPage from '@/components/ToolPage';
import { reorderPages, getPdfInfo } from '@/lib/pdf-engine';
import { GripVertical } from 'lucide-react';

export default function OrganizePdfPage() {
  const [order, setOrder] = useState<number[]>([]);
  const [totalPages, setTotalPages] = useState(0);

  return (
    <ToolPage
      slug="organize-pdf"
      accept=".pdf"
      processLabel="Organize PDF"
      options={
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Enter new page order (comma-separated, e.g., 3,1,2,4,5)
          </label>
          <input
            type="text"
            value={order.join(',')}
            onChange={(e) => {
              const newOrder = e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
              setOrder(newOrder);
            }}
            placeholder="e.g., 3,1,2,4,5"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Enter page numbers in the order you want them to appear
          </p>
        </div>
      }
      onProcess={async (files) => {
        if (order.length === 0) throw new Error('Please enter a page order');
        return reorderPages(files[0], order);
      }}
    />
  );
}

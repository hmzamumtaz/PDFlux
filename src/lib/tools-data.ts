export interface ToolInfo {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  accept?: string;
  color: string;
}

export const tools: ToolInfo[] = [
  // Organize
  { slug: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDFs into a single file', icon: 'Combine', category: 'Organize PDF', color: '#6366f1' },
  { slug: 'split-pdf', name: 'Split PDF', description: 'Separate a PDF into individual pages', icon: 'Scissors', category: 'Organize PDF', color: '#8b5cf6' },
  { slug: 'remove-pages', name: 'Remove Pages', description: 'Delete specific pages from a PDF', icon: 'Trash2', category: 'Organize PDF', color: '#ef4444' },
  { slug: 'extract-pages', name: 'Extract Pages', description: 'Extract specific pages as a new PDF', icon: 'FileOutput', category: 'Organize PDF', color: '#f59e0b' },
  { slug: 'organize-pdf', name: 'Organize PDF', description: 'Reorder, rotate, and manage pages', icon: 'ArrowUpDown', category: 'Organize PDF', color: '#10b981' },

  // Optimize
  { slug: 'compress-pdf', name: 'Compress PDF', description: 'Reduce file size while maintaining quality', icon: 'Minimize2', category: 'Optimize PDF', color: '#06b6d4' },
  { slug: 'optimize-pdf', name: 'Optimize PDF', description: 'Optimize PDF for web and faster loading', icon: 'Zap', category: 'Optimize PDF', color: '#0ea5e9' },
  { slug: 'repair-pdf', name: 'Repair PDF', description: 'Fix corrupted or damaged PDF files', icon: 'Wrench', category: 'Optimize PDF', color: '#14b8a6' },
  { slug: 'ocr-pdf', name: 'OCR PDF', description: 'Extract text from scanned documents', icon: 'ScanText', category: 'Optimize PDF', color: '#84cc16' },

  // Convert to PDF
  { slug: 'jpg-to-pdf', name: 'JPG to PDF', description: 'Convert images to PDF documents', icon: 'Image', category: 'Create PDF', color: '#f97316' },
  { slug: 'word-to-pdf', name: 'Word to PDF', description: 'Turn a document (DOCX) into a PDF', icon: 'FileText', category: 'Create PDF', color: '#2563eb' },
  { slug: 'powerpoint-to-pdf', name: 'PowerPoint to PDF', description: 'Turn slides (PPTX) into a PDF', icon: 'Presentation', category: 'Create PDF', color: '#dc2626' },
  { slug: 'excel-to-pdf', name: 'Excel to PDF', description: 'Turn a spreadsheet (XLSX) into a PDF', icon: 'Table', category: 'Create PDF', color: '#16a34a' },
  { slug: 'html-to-pdf', name: 'HTML to PDF', description: 'Convert web pages to PDF', icon: 'Globe', category: 'Create PDF', color: '#7c3aed' },

  // Convert from PDF
  { slug: 'pdf-to-jpg', name: 'PDF to JPG', description: 'Convert PDF pages to JPG images', icon: 'FileImage', category: 'Export PDF', color: '#eab308' },
  { slug: 'pdf-to-word', name: 'PDF to Word', description: 'Turn a PDF into an editable document (DOCX)', icon: 'FileType', category: 'Export PDF', color: '#0891b2' },
  { slug: 'pdf-to-powerpoint', name: 'PDF to PowerPoint', description: 'Turn a PDF into editable slides (PPTX)', icon: 'Slideshow', category: 'Export PDF', color: '#ea580c' },
  { slug: 'pdf-to-excel', name: 'PDF to Excel', description: 'Turn PDF tables into a spreadsheet (XLSX)', icon: 'Grid3x3', category: 'Export PDF', color: '#0d9488' },
  { slug: 'pdf-to-pdfa', name: 'PDF to PDF/A', description: 'Convert PDF to archival PDF/A format', icon: 'Archive', category: 'Export PDF', color: '#64748b' },
  { slug: 'pdf-to-markdown', name: 'PDF to Markdown', description: 'Convert PDF content to Markdown text', icon: 'FileCode', category: 'Export PDF', color: '#0f766e' },

  // Edit
  { slug: 'rotate-pdf', name: 'Rotate PDF', description: 'Rotate PDF pages to any angle', icon: 'RotateCw', category: 'Edit PDF', color: '#a855f7' },
  { slug: 'add-page-numbers', name: 'Add Page Numbers', description: 'Insert page numbers into your PDF', icon: 'Hash', category: 'Edit PDF', color: '#3b82f6' },
  { slug: 'add-watermark', name: 'Add Watermark', description: 'Add text or image watermarks', icon: 'Droplets', category: 'Edit PDF', color: '#0891b2' },
  { slug: 'crop-pdf', name: 'Crop PDF', description: 'Crop and resize PDF pages', icon: 'Crop', category: 'Edit PDF', color: '#65a30d' },
  { slug: 'sign-pdf', name: 'Sign PDF', description: 'Add digital signatures to PDFs', icon: 'PenTool', category: 'Edit PDF', color: '#1d4ed8' },
  { slug: 'redact-pdf', name: 'Redact PDF', description: 'Black out sensitive information', icon: 'Eraser', category: 'Edit PDF', color: '#991b1b' },

  // Security
  { slug: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove password protection from PDF', icon: 'Unlock', category: 'PDF Security', color: '#16a34a' },
  { slug: 'protect-pdf', name: 'Protect PDF', description: 'Add password protection to PDF', icon: 'Lock', category: 'PDF Security', color: '#dc2626' },

  // AI
  { slug: 'compare-pdf', name: 'Compare PDF', description: 'Compare two PDF files for differences', icon: 'GitCompare', category: 'PDF Intelligence', color: '#7c3aed' },
  { slug: 'ai-summarizer', name: 'Summarizer', description: 'Summarize PDF content', icon: 'Sparkles', category: 'PDF Intelligence', color: '#ec4899' },
  { slug: 'translate-pdf', name: 'Translate PDF', description: 'Translate PDF content to any language', icon: 'Languages', category: 'PDF Intelligence', color: '#0ea5e9' },
];

export const categories = [
  'Organize PDF',
  'Optimize PDF',
  'Create PDF',
  'Export PDF',
  'Edit PDF',
  'PDF Security',
  'PDF Intelligence',
];

export function getToolsByCategory(category: string): ToolInfo[] {
  return tools.filter(t => t.category === category);
}

export function getToolBySlug(slug: string): ToolInfo | undefined {
  return tools.find(t => t.slug === slug);
}

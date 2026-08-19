'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { Menu, X, FileText, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { categories, getToolsByCategory, type ToolInfo } from '@/lib/tools-data';

function DropdownMenu({ category, tools, alignRight }: { category: string; tools: ToolInfo[]; alignRight?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = category.replace(' PDF', '');

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute top-full mt-1 w-80 bg-white border border-border rounded-xl shadow-xl py-2 animate-fade-in z-50 ${alignRight ? 'right-0' : 'left-0'}`}>
          {tools.map((tool) => {
            const IconComp = (LucideIcons as any)[tool.icon] || LucideIcons.FileText;
            return (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${tool.color}12` }}>
                  <IconComp className="w-4 h-4" style={{ color: tool.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{tool.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navCategories = [
  'Organize PDF',
  'Create PDF',
  'Export PDF',
  'Edit PDF',
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCategory, setMobileCategory] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-foreground rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight">
              PDF<span className="font-light text-primary">lux</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navCategories.map((cat, i) => (
              <DropdownMenu key={cat} category={cat} tools={getToolsByCategory(cat)} alignRight={i >= 2} />
            ))}
            <Link href="/tools/ai-summarizer" className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
              AI Tools
            </Link>
          </nav>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-white animate-fade-in max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {navCategories.map((cat) => (
              <div key={cat}>
                <button
                  onClick={() => setMobileCategory(mobileCategory === cat ? null : cat)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {cat.replace(' PDF', '')}
                  <ChevronDown className={`w-4 h-4 transition-transform ${mobileCategory === cat ? 'rotate-180' : ''}`} />
                </button>
                {mobileCategory === cat && (
                  <div className="ml-4 space-y-0.5 mb-1">
                    {getToolsByCategory(cat).map((tool) => (
                      <Link
                        key={tool.slug}
                        href={`/tools/${tool.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        {tool.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/tools/ai-summarizer"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              AI Tools
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

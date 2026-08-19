import Link from 'next/link';
import { FileText, Shield, Zap, ArrowRight } from 'lucide-react';
import { tools, categories, getToolsByCategory } from '@/lib/tools-data';
import ToolGrid from '@/components/ToolGrid';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PDFlux - Modern PDF Toolkit | Edit, Convert, Merge & More',
  description: 'The modern PDF toolkit. Edit, convert, merge, compress, and optimize your PDFs entirely in your browser. 100% private and free.',
};

export default function Home() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white pt-16 sm:pt-24 pb-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-full text-sm font-medium text-muted-foreground mb-6 shadow-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              All processing happens in your browser
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              The modern{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                PDF toolkit
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Edit, convert, merge, compress, and optimize your PDFs with {tools.length}+ powerful tools.
              Everything runs locally in your browser — your files never leave your device.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/tools/merge-pdf"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-500" />
                  100% Private
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Free to use
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {categories.map((category) => (
          <div key={category} className="mb-14 last:mb-0">
            <h2 className="text-xl font-bold text-foreground mb-5">{category}</h2>
            <ToolGrid tools={getToolsByCategory(category)} />
          </div>
        ))}
      </section>

      <section className="bg-gray-950 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-8">
              <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Upload Required</h3>
              <p className="text-gray-400 text-sm leading-relaxed">All files are processed directly in your browser using WebAssembly and JavaScript. Nothing is ever sent to a server.</p>
            </div>
            <div className="p-8">
              <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Shield className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">100% Private & Secure</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Your documents never leave your device. We have zero access to your files. Perfect for sensitive and confidential documents.</p>
            </div>
            <div className="p-8">
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Zap className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
              <p className="text-gray-400 text-sm leading-relaxed">No upload/download delays. Processing happens instantly on your device. Works offline once loaded.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

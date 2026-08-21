import Link from 'next/link';
import BrandMark from './BrandMark';

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <BrandMark className="w-4 h-4 text-black" />
              </div>
              <span className="text-lg font-bold text-white">Folio</span>
            </Link>
            <p className="text-sm leading-relaxed">
              The modern PDF toolkit. Edit, convert, merge, and optimize your PDFs entirely in your browser.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Organize</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tools/merge-pdf" className="hover:text-white transition-colors">Merge PDF</Link></li>
              <li><Link href="/tools/split-pdf" className="hover:text-white transition-colors">Split PDF</Link></li>
              <li><Link href="/tools/remove-pages" className="hover:text-white transition-colors">Remove Pages</Link></li>
              <li><Link href="/tools/organize-pdf" className="hover:text-white transition-colors">Organize PDF</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Convert</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tools/jpg-to-pdf" className="hover:text-white transition-colors">JPG to PDF</Link></li>
              <li><Link href="/tools/pdf-to-jpg" className="hover:text-white transition-colors">PDF to JPG</Link></li>
              <li><Link href="/tools/word-to-pdf" className="hover:text-white transition-colors">Word to PDF</Link></li>
              <li><Link href="/tools/pdf-to-word" className="hover:text-white transition-colors">PDF to Word</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Edit & Security</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/tools/rotate-pdf" className="hover:text-white transition-colors">Rotate PDF</Link></li>
              <li><Link href="/tools/compress-pdf" className="hover:text-white transition-colors">Compress PDF</Link></li>
              <li><Link href="/tools/protect-pdf" className="hover:text-white transition-colors">Protect PDF</Link></li>
              <li><Link href="/tools/sign-pdf" className="hover:text-white transition-colors">Sign PDF</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">
            &copy; {new Date().getFullYear()} Folio. Files are processed locally in your browser — only the optional Translate tool contacts an online service.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span>No file size limits</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

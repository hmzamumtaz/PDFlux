'use client';

import ToolPage from '@/components/ToolPage';

export default function PowerPointToPdfPage() {
  return (
    <ToolPage
      slug="powerpoint-to-pdf"
      accept=".pptx"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const JSZip = (await import('jszip')).default;
        const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

        const buf = await files[0].arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        // Read presentation.xml for slide dimensions
        const presXml = await zip.file('ppt/presentation.xml')?.async('text') || '';
        const sldSzMatch = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
        // PPTX uses EMUs (English Metric Units): 1 inch = 914400 EMUs, 1 pt = 12700 EMUs
        const slideW = sldSzMatch ? parseInt(sldSzMatch[1]) / 12700 : 720; // default 10 inches
        const slideH = sldSzMatch ? parseInt(sldSzMatch[2]) / 12700 : 540; // default 7.5 inches

        // Get slide order
        const relsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('text') || '';
        const presRelMatches = [...presXml.matchAll(/r:id="(rId\d+)"/g)];
        const ridToSlide: Record<string, string> = {};
        for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="slides\/(slide\d+\.xml)"/g)) {
          ridToSlide[m[1]] = m[2];
        }
        const slideOrder = presRelMatches.map(m => ridToSlide[m[1]]).filter(Boolean);
        const slideFiles = slideOrder.length > 0
          ? slideOrder
          : Object.keys(zip.files).filter(k => k.match(/^ppt\/slides\/slide\d+\.xml$/)).sort().map(k => k.replace('ppt/slides/', ''));

        const pdf = await PDFDocument.create();
        const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

        // Decode the XML entities OOXML escapes inside <a:t> (&amp;, &#8217;, ...)
        function decodeEntities(text: string): string {
          return text
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
        }

        function sanitize(text: string): string {
          return decodeEntities(text)
            .replace(/[\u{1F000}-\u{1FFFF}]/gu, '?')
            .replace(/[\u{2600}-\u{27BF}]/gu, '-')
            .replace(/[^\x20-\x7E\xA0-\xFF]/g, c => {
              const code = c.charCodeAt(0);
              if (code === 0x2013 || code === 0x2014) return '-';
              if (code === 0x2026) return '...';
              if (code === 0x2018 || code === 0x2019) return "'";
              if (code === 0x201C || code === 0x201D) return '"';
              return '';
            });
        }

        for (const slideFile of slideFiles) {
          const slideXml = await zip.file(`ppt/slides/${slideFile}`)?.async('text');
          if (!slideXml) continue;

          const page = pdf.addPage([slideW, slideH]);

          // Extract all text frames: <p:sp> elements contain <p:txBody> with <a:p> paragraphs
          const spMatches = [...slideXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)];

          for (const sp of spMatches) {
            const spXml = sp[0];

            // Extract position from <p:spPr> or <a:xfrm>
            let x = 0, y = 0, w = slideW;
            const xfrmMatch = spXml.match(/<a:xfrm[^>]*>[\s\S]*?<\/a:xfrm>/);
            if (xfrmMatch) {
              const offMatch = xfrmMatch[0].match(/<a:off[^>]*x="(\d+)"[^>]*y="(\d+)"/);
              const extMatch = xfrmMatch[0].match(/<a:ext[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
              if (offMatch) {
                x = parseInt(offMatch[1]) / 12700;
                y = parseInt(offMatch[2]) / 12700;
              }
              if (extMatch) {
                w = parseInt(extMatch[1]) / 12700;
              }
            }

            // Extract paragraphs
            const paraMatches = [...spXml.matchAll(/<a:p[^>]*>[\s\S]*?<\/a:p>/g)];
            let paraY = 0;

            for (const para of paraMatches) {
              const paraXml = para[0];

              // Collect the paragraph's runs as word tokens, each with its own
              // style (no state leaking between runs), then wrap manually so
              // wrapped lines advance the cursor instead of overprinting.
              type Token = { text: string; size: number; bold: boolean };
              const tokens: Token[] = [];
              const runMatches = [...paraXml.matchAll(/<a:(?:r|br)[^>]*(?:\/>|>[\s\S]*?<\/a:r>)/g)];

              for (const run of runMatches) {
                const runXml = run[0];
                if (runXml.startsWith('<a:br')) {
                  tokens.push({ text: '\n', size: 12, bold: false });
                  continue;
                }
                let size = 12;
                let bold = false;
                const rPrMatch = runXml.match(/<a:rPr[^>]*>/);
                if (rPrMatch) {
                  const szMatch = rPrMatch[0].match(/sz="(\d+)"/);
                  if (szMatch) size = parseInt(szMatch[1]) / 100; // hundredths of a point
                  bold = /\bb="1"/.test(rPrMatch[0]);
                }
                const tMatch = runXml.match(/<a:t>([\s\S]*?)<\/a:t>/);
                const text = tMatch ? sanitize(tMatch[1]) : '';
                for (const word of text.split(/\s+/)) {
                  if (word) tokens.push({ text: word, size: Math.min(size, 28), bold });
                }
              }

              if (tokens.length === 0) { paraY += 12 * 1.2; continue; }

              // Greedy word-wrap within the shape width
              let line: Token[] = [];
              let lineW = 0;
              const flushLine = () => {
                if (line.length === 0) return;
                const lineSize = Math.max(...line.map(t => t.size));
                const pdfY = slideH - y - paraY - lineSize;
                let runX = 0;
                for (const tok of line) {
                  if (pdfY < 4) break; // stop when text overflows the slide bottom
                  const f = tok.bold ? helveticaBold : helvetica;
                  page.drawText(tok.text, {
                    x: x + runX,
                    y: pdfY,
                    size: tok.size,
                    font: f,
                    color: rgb(0.1, 0.1, 0.1),
                  });
                  runX += f.widthOfTextAtSize(tok.text + ' ', tok.size);
                }
                paraY += lineSize * 1.2;
                line = [];
                lineW = 0;
              };

              const maxLineW = Math.max(w - 4, 40);
              for (const tok of tokens) {
                if (tok.text === '\n') { flushLine(); continue; }
                const f = tok.bold ? helveticaBold : helvetica;
                const tw = f.widthOfTextAtSize(tok.text + ' ', tok.size);
                if (lineW + tw > maxLineW && line.length > 0) flushLine();
                line.push(tok);
                lineW += tw;
              }
              flushLine();
            }
          }
        }

        const bytes = await pdf.save();
        return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      }}
    />
  );
}

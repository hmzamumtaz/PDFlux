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

        function sanitize(text: string): string {
          return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '?')
            .replace(/[\u{2600}-\u{27BF}]/gu, '-')
            .replace(/[^\x20-\x7E\xA0-\xFF]/g, c => {
              const code = c.charCodeAt(0);
              if (code >= 0x20 && code <= 0x7E) return c;
              if (code >= 0xA0 && code <= 0xFF) return c;
              if (code === 0x2013 || code === 0x2014) return '-';
              if (code === 0x2026) return '...';
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
            let x = 0, y = 0, w = slideW, h = slideH;
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
                h = parseInt(extMatch[2]) / 12700;
              }
            }

            // Extract paragraphs
            const paraMatches = [...spXml.matchAll(/<a:p[^>]*>[\s\S]*?<\/a:p>/g)];
            let paraY = 0;

            for (const para of paraMatches) {
              const paraXml = para[0];

              // Extract paragraph properties (font size, bold)
              let fontSize = 12;
              let isBold = false;
              const pPrMatch = paraXml.match(/<a:pPr[^>]*>/);
              if (pPrMatch) {
                const spcMatch = pPrMatch[0].match(/spcPts="(\d+)"/);
                // spcPts is in hundredths of a point
              }

              // Extract text runs
              const runMatches = [...paraXml.matchAll(/<a:r[^>]*>[\s\S]*?<\/a:r>/g)];
              let runX = 0;

              for (const run of runMatches) {
                const runXml = run[0];

                // Run properties
                const rPrMatch = runXml.match(/<a:rPr[^>]*>/);
                if (rPrMatch) {
                  const szMatch = rPrMatch[0].match(/sz="(\d+)"/);
                  const bMatch = rPrMatch[0].match(/b="1"/);
                  if (szMatch) fontSize = parseInt(szMatch[1]) / 100; // sz is in hundredths of a point
                  isBold = !!bMatch;
                }

                // Text content
                const tMatch = runXml.match(/<a:t>([^<]*)<\/a:t>/);
                const rawText = tMatch ? tMatch[1] : '';
                if (!rawText) continue;
                const text = sanitize(rawText);

                const f = isBold ? helveticaBold : helvetica;
                const pdfFontSize = Math.min(fontSize, 24); // Cap for readability

                // PDF y is bottom-up, PPT y is top-down
                const pdfY = slideH - y - paraY - pdfFontSize;

                page.drawText(text, {
                  x: x + runX,
                  y: pdfY,
                  size: pdfFontSize,
                  font: f,
                  color: rgb(0.1, 0.1, 0.1),
                  maxWidth: w - runX,
                });

                runX += f.widthOfTextAtSize(text, pdfFontSize);
              }

              paraY += fontSize * 1.2;
            }
          }
        }

        const bytes = await pdf.save();
        return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      }}
    />
  );
}

'use client';

import ToolPage from '@/components/ToolPage';
import { htmlToPdf } from '@/lib/pdf-engine';

export default function PowerPointToPdfPage() {
  return (
    <ToolPage
      slug="powerpoint-to-pdf"
      accept=".pptx"
      processLabel="Convert to PDF"
      onProcess={async (files) => {
        const JSZip = (await import('jszip')).default;
        const buf = await files[0].arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        // Read presentation.xml to get slide order
        const presXml = await zip.file('ppt/presentation.xml')?.async('text');
        if (!presXml) throw new Error('Invalid PPTX file: missing presentation.xml');

        // Extract slide IDs from presentation.xml
        const slideIdMatches = [...presXml.matchAll(/r:id="(rId\d+)"/g)];
        const relsXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('text');
        if (!relsXml) throw new Error('Invalid PPTX: missing relationships');

        // Map rId -> slide filename
        const ridToSlide: Record<string, string> = {};
        for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="slides\/(slide\d+\.xml)"/g)) {
          ridToSlide[m[1]] = m[2];
        }

        // Get ordered slide filenames
        const slideOrder = slideIdMatches
          .map(m => ridToSlide[m[1]])
          .filter(Boolean);

        // If parsing fails, fall back to alphabetical
        const slideFiles = slideOrder.length > 0
          ? slideOrder
          : Object.keys(zip.files)
              .filter(k => k.match(/^ppt\/slides\/slide\d+\.xml$/))
              .sort()
              .map(k => k.replace('ppt/slides/', ''));

        const slideTexts: string[] = [];

        for (const slideFile of slideFiles) {
          const slideXml = await zip.file(`ppt/slides/${slideFile}`)?.async('text');
          if (!slideXml) continue;

          // Extract all text from <a:t> tags (run text) and <a:p> (paragraphs)
          const paragraphs: string[] = [];
          const paraMatches = slideXml.match(/<a:p[^>]*>[\s\S]*?<\/a:p>/g) || [];
          for (const para of paraMatches) {
            const textRuns = [...para.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
            const paraText = textRuns.map(m => m[1]).join('');
            if (paraText.trim()) paragraphs.push(paraText.trim());
          }

          slideTexts.push(paragraphs.join('\n'));
        }

        // Build HTML for pdf
        if (slideTexts.length === 0) {
          throw new Error('No text content found in the presentation.');
        }

        const slidesHtml = slideTexts.map((text, i) => `
          <div style="page-break-after: always; padding: 40px 0; ${i < slideTexts.length - 1 ? 'border-bottom: 2px solid #ddd;' : ''}">
            <div style="font-size: 10px; color: #999; margin-bottom: 8px;">Slide ${i + 1} of ${slideTexts.length}</div>
            <div style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #333;">${text || '<em style="color:#999">(blank slide)</em>'}</div>
          </div>
        `).join('');

        return htmlToPdf(`<div style="font-family: Arial, sans-serif; padding: 30px 40px;">${slidesHtml}</div>`);
      }}
    />
  );
}

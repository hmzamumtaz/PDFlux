'use client';

import { extractTextFromPdf, tokenize } from './pdf-engine';

const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','his','how','its','may',
  'new','now','old','see','way','who','did','get','let','say','she','too','use','him','with','that','this','will','each',
  'make','like','long','look','many','most','over','such','take','than','them','then','these','from','have','been','said',
  'more','when','what','your','were','they','would','could','should','there','their','about','which','where','into','also',
  'after','first','only','other','some','very','just','come','made','back','having','being','since','until',
  'while','through','during','before','under','above','below','between','same','different','using','used','based','within',
  'without','including','following','section','page','chapter','part','document','table','figure','appendix','number',
  'however','therefore','furthermore','moreover','additionally','consequently','although','though','whether','either',
  'neither','both','every','any','few','several','another','thus','hence','else','often','still','already','here',
  'well','even','much','quite','rather','almost','enough','most','own','able','last','next',
]);

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  keywords: string[];
  wordCount: number;
  originalWordCount: number;
  pages: number;
}

/**
 * Extractive summarization, fully in-browser (no text leaves the device).
 * Sentences are scored by keyword density (TF of non-stopword terms), title
 * words, position in the document and length, then the top sentences are
 * returned in their original reading order.
 */
export async function summarizePdf(
  file: File,
  onProgress?: (msg: string) => void,
  options?: { maxSentences?: number },
): Promise<SummaryResult> {
  onProgress?.('Extracting text...');
  const pages = await extractTextFromPdf(file);
  const fullText = pages.join('\n\n');

  if (!fullText.trim()) {
    throw new Error('No extractable text found — this PDF appears to be scanned or image-based. Run it through the OCR PDF tool first, then summarize the result.');
  }

  onProgress?.('Analyzing document...');
  const allWords = tokenize(fullText);
  const originalWordCount = allWords.length;

  // Sentence segmentation, keeping enough length to be meaningful.
  const sentences = fullText
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => {
      const words = s.split(/\s+/);
      return words.length >= 6 && words.length <= 80 && /[.!?]$/.test(s);
    });

  if (sentences.length === 0) {
    throw new Error('The document contains text but no complete sentences to summarize (it may be a form, table, or list-only document).');
  }

  onProgress?.('Scoring sentences...');

  // Term frequencies over meaningful words.
  const freq: Record<string, number> = {};
  for (const w of allWords) {
    if (!STOPWORDS.has(w) && w.length > 3) freq[w] = (freq[w] || 0) + 1;
  }
  const maxFreq = Math.max(1, ...Object.values(freq));
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  const scored = sentences.map((sent, i) => {
    const words = tokenize(sent).filter(w => !STOPWORDS.has(w) && w.length > 3);
    let score = 0;
    for (const w of words) score += (freq[w] || 0) / maxFreq;
    // Normalize so long sentences don't win on raw word count.
    score /= Math.max(words.length, 1);
    // Position bonus: openings and closings usually carry thesis statements.
    if (i === 0) score *= 1.6;
    else if (i < sentences.length * 0.1) score *= 1.3;
    else if (i > sentences.length * 0.9) score *= 1.15;
    // Numeric facts are usually informative.
    if (/\b\d[\d,.]*\s*(%|percent|million|billion|thousand|usd|eur)?\b/i.test(sent)) score *= 1.1;
    return { sent, i, score };
  });

  const targetCount = options?.maxSentences
    ?? Math.min(8, Math.max(3, Math.round(sentences.length * 0.08)));

  // Pick top sentences with a redundancy penalty, then restore reading order.
  const picked: { sent: string; i: number }[] = [];
  const pickedWords = new Set<string>();
  const candidates = [...scored].sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (picked.length >= targetCount) break;
    const words = tokenize(c.sent).filter(w => !STOPWORDS.has(w) && w.length > 3);
    const overlap = words.length > 0 ? words.filter(w => pickedWords.has(w)).length / words.length : 0;
    if (overlap > 0.75) continue; // near-duplicate of an already chosen sentence
    picked.push({ sent: c.sent, i: c.i });
    words.forEach(w => pickedWords.add(w));
  }
  picked.sort((a, b) => a.i - b.i);

  const keyPoints = picked.map(p => p.sent);
  const summary = keyPoints.join(' ');
  const wordCount = tokenize(summary).length;

  return { summary, keyPoints, keywords, wordCount, originalWordCount, pages: pages.length };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { extractTextFromPdf, tokenize } from './pdf-engine';

const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','has','his','how','its','may',
  'new','now','old','see','way','who','did','get','let','say','she','too','use','him','with','that','this','will','each',
  'make','like','long','look','many','most','over','such','take','than','them','then','these','from','have','been','said',
  'more','when','what','your','were','they','would','could','should','there','their','about','which','where','into','also',
  'after','first','only','other','some','very','just','come','made','back','had','has','his','her','our','one','you','all',
  'can','did','get','let','not','but','are','his','how','its','may','who','use','him','way','having','being','since','until',
  'while','through','during','before','under','above','below','between','same','different','using','used','based','within',
  'without','including','following','section','page','chapter','part','document','table','figure','appendix','number',
  'however','therefore','furthermore','moreover','additionally','consequently','although','though','whether','either',
  'neither','both','every','any','few','several','another','thus','hence','else','often','still','already','here','there',
  'well','just','only','even','also','too','much','very','quite','rather','almost','enough','rather','too','so','most',
  'own','same','able','last','next','just','only','even','well','much','well','well','well'
]);

const DOC_TYPES: [RegExp, string][] = [
  [/\b(abstract|methodology|findings|conclusion|hypothesis|experiment|research|study|analysis)\b/i, 'research document'],
  [/\b(salary|benefits|compensation|employee|payroll|hire|termination|policy|handbook)\b/i, 'policy document'],
  [/\b(manual|instructions|step|procedure|guide|tutorial|how.to|setup|installation)\b/i, 'instructional guide'],
  [/\b(invoice|receipt|total|amount|price|quantity|tax|billing|payment)\b/i, 'financial document'],
  [/\b(contract|agreement|terms|conditions|party|parties|obligations|liability)\b/i, 'legal document'],
  [/\b(resume|curriculum|experience|education|skills|qualification|reference)\b/i, 'resume or CV'],
  [/\b(proposal|scope|deliverables|timeline|budget|project|objective)\b/i, 'project proposal'],
  [/\b(press|release|announced|statement|spokesperson|media)\b/i, 'press release'],
  [/\b(news|article|report|today|yesterday|according to|published)\b/i, 'news article'],
  [/\b(slide|presentation|speaker|audience|visual|agenda)\b/i, 'presentation'],
];

const THEMES: [string[], string, string][] = [
  [['business','company','market','strategy','revenue','growth','customer','management','corporate','financial'], 'business and corporate strategy', 'addresses'],
  [['system','software','data','network','server','technology','digital','platform','application','security'], 'technology and systems', 'covers'],
  [['legal','law','court','rights','regulation','compliance','statute','jurisdiction','contract','agreement'], 'legal and regulatory matters', 'examines'],
  [['research','study','method','results','analysis','experiment','findings','observation','evidence'], 'scientific research and findings', 'presents'],
  [['student','learning','education','school','teaching','curriculum','course','academic','university','training'], 'education and learning', 'discusses'],
  [['health','medical','patient','treatment','clinical','disease','therapy','diagnosis','hospital','care'], 'health and medical matters', 'addresses'],
  [['financial','investment','fund','capital','budget','cost','revenue','profit','accounting','tax'], 'financial matters', 'outlines'],
  [['design','process','engineering','technical','specification','component','performance','efficiency','quality'], 'engineering and technical specifications', 'details'],
];

export async function summarizePdf(
  file: File,
  onProgress?: (msg: string) => void
): Promise<{ summary: string; wordCount: number; originalWordCount: number }> {
  onProgress?.('Extracting text...');
  const pages = await extractTextFromPdf(file);
  const fullText = pages.join('\n\n');

  if (!fullText.trim()) {
    return { summary: 'No extractable text found. The document may be scanned/image-based.', wordCount: 0, originalWordCount: 0 };
  }

  onProgress?.('Analyzing document...');
  const allWords = tokenize(fullText);
  const originalWordCount = allWords.length;
  const lowerText = fullText.toLowerCase();
  const sentences = fullText.replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 15);

  if (sentences.length === 0) {
    return { summary: 'No complete sentences found in the document.', wordCount: 0, originalWordCount };
  }

  onProgress?.('Building summary...');

  // Count meaningful word frequencies
  const freq: Record<string, number> = {};
  for (const w of allWords) {
    if (!STOPWORDS.has(w) && w.length > 3) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  // Detect document type
  let docType = 'document';
  for (const [pattern, type] of DOC_TYPES) {
    if (pattern.test(lowerText)) { docType = type; break; }
  }
  if (docType === 'document') {
    if (sentences.length < 20 && originalWordCount < 2000) docType = 'brief document';
    else if (originalWordCount > 10000) docType = 'comprehensive document';
  }

  // Detect topic theme
  const topWords = topKeywords.map(k => k.word);
  let theme = { topic: 'various subjects', verb: 'covers' };
  for (const [topicWords, topic, verb] of THEMES) {
    if (topWords.some(w => topicWords.includes(w))) {
      theme = { topic, verb };
      break;
    }
  }
  if (theme.topic === 'various subjects' && topWords.length >= 2) {
    theme = { topic: `${topWords[0]}, ${topWords[1]}${topWords[2] ? ' and ' + topWords[2] : ''}`, verb: 'discusses' };
  }

  // Detect document structure
  const hasHeadings = /(?:^|\n)\s*(?:chapter|section|part|introduction|conclusion|summary|abstract|overview|background|appendix)\s*[:.]?/im.test(fullText);
  const hasList = /(?:^|\n)\s*[•\-*▪]\s/m.test(fullText) || /(?:^|\n)\s*\d+[.)]\s/m.test(fullText);
  const hasNumbers = /\b\d+(?:\.\d+)?\s*(?:%|percent|million|billion|thousand|km|mb|gb|kb)\b/i.test(fullText);
  const hasReferences = /\b(?:references|bibliography|citations|sources)\s*[:.]?/i.test(fullText);

  // Build description
  const parts: string[] = [];
  const keyTerms = topKeywords.slice(0, 5).map(k => k.word);

  parts.push(`This ${docType} ${theme.verb} ${theme.topic}.`);

  if (keyTerms.length > 0) {
    const list = keyTerms.slice(0, 4).join(', ') + (keyTerms.length > 4 ? ', and ' + keyTerms[4] : '');
    parts.push(`The primary focus areas include ${list}.`);
  }

  const traits: string[] = [];
  if (hasHeadings) traits.push('organized with clear sections');
  if (hasList) traits.push('containing structured lists');
  if (hasNumbers) traits.push('supported by numerical data');
  if (hasReferences) traits.push('with cited references');
  if (pages.length > 10) traits.push(`spanning ${pages.length} pages`);
  if (originalWordCount > 5000) traits.push(`comprising approximately ${Math.round(originalWordCount / 1000) * 1000} words`);
  if (traits.length > 0) {
    parts.push(`The document is ${traits.join(traits.length > 1 ? ', ' : ' and ')}.`);
  }

  // Extract one core statement from the most info-dense sentence
  if (sentences.length > 0) {
    const scored = sentences.map((sent, i) => {
      const words = tokenize(sent);
      const hits = words.filter(w => keyTerms.includes(w)).length;
      const density = hits / Math.max(words.length, 1);
      let posBonus = 1;
      if (i === 0) posBonus = 1.5;
      else if (i === sentences.length - 1) posBonus = 1.4;
      else if (i < sentences.length * 0.15) posBonus = 1.2;
      return { sent, score: density * posBonus };
    });
    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (best) {
      const core = best.sent
        .replace(/^(however|therefore|furthermore|moreover|additionally|consequently|in addition|in conclusion|for example|specifically|notably|in particular|as mentioned|importantly|significantly|notwithstanding|nevertheless|alternatively|subsequently|accordingly|in summary|to summarize|overall|ultimately|in essence),?\s*/i, '')
        .replace(/,\s*(?:which|that|who|where|when|while|although|since|because|as)\s+.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (core.length > 20) {
        const final = core.charAt(0).toUpperCase() + core.slice(1);
        parts.push(`Key point: ${final.endsWith('.') ? final : final + '.'}`);
      }
    }
  }

  const summary = parts.join(' ');
  const wordCount = tokenize(summary).length;
  return { summary, wordCount, originalWordCount };
}

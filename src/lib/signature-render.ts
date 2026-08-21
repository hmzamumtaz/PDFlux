/**
 * Signature rasterisation.
 *
 * Both the on-screen preview and the stamp that lands in the PDF come from the
 * same canvas, so what the user approves is byte-for-byte what gets embedded.
 */

/** Crop a canvas down to its non-transparent pixels, plus a little breathing room. */
export function trimCanvas(source: HTMLCanvasElement, padding = 8): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx || source.width === 0 || source.height === 0) return source;

  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  let minX = source.width, minY = source.height, maxX = -1, maxY = -1;

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (data[(y * source.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return source; // nothing drawn

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(source.width - 1, maxX + padding);
  maxY = Math.min(source.height - 1, maxY + padding);

  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Draw a typed name onto a transparent canvas in the given font.
 *
 * Rendered large (the font size below is in device pixels, not points) so the
 * stamp stays sharp when the PDF is zoomed or printed.
 */
export async function renderTextSignature(
  text: string,
  options: { fontFamily: string; color: string; fontSize?: number },
): Promise<HTMLCanvasElement | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fontSize = options.fontSize ?? 180;
  const shorthand = `${fontSize}px ${options.fontFamily}`;

  // Canvas silently falls back to a default face if the webfont has not
  // finished loading, so wait for this exact face before measuring.
  try {
    await document.fonts.load(shorthand, trimmed);
    await document.fonts.ready;
  } catch {
    // A font that refuses to load still renders in the fallback face.
  }

  const measurer = document.createElement('canvas').getContext('2d')!;
  measurer.font = shorthand;
  const m = measurer.measureText(trimmed);

  const left = m.actualBoundingBoxLeft ?? 0;
  const right = m.actualBoundingBoxRight ?? m.width;
  const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent = m.actualBoundingBoxDescent ?? fontSize * 0.3;

  const pad = Math.ceil(fontSize * 0.25);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(left + right) + pad * 2);
  canvas.height = Math.max(1, Math.ceil(ascent + descent) + pad * 2);

  const ctx = canvas.getContext('2d')!;
  ctx.font = shorthand; // resizing the canvas resets the context
  ctx.fillStyle = options.color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(trimmed, pad + left, pad + ascent);

  return trimCanvas(canvas, 4);
}

/** PNG bytes for a canvas, ready for pdf-lib's embedPng. */
export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the signature image.');
  return blob.arrayBuffer();
}

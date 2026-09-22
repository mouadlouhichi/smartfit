import { safeLogoData } from './gym-profile';

/** Decode then re-encode to a small static raster. Metadata and animation aren't retained. */
export async function importGymLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPEG or WebP logo. SVG and animated formats are not supported.');
  if (file.size > 4 * 1024 * 1024) throw new Error('Choose a logo smaller than 4 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This file could not be read as an image. Try another logo.');
  }
  try {
    const size = 256;
    const scale = Math.min(1, size / bitmap.width, size / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('Image processing is unavailable in this browser. Use a logo URL instead.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.75, 0.55, 0.35]) {
      const data = canvas.toDataURL('image/webp', quality);
      if (safeLogoData(data)) return data;
    }
    throw new Error(
      'This logo is too detailed. Try a simpler or smaller image (optimized limit: 32 KB).',
    );
  } finally {
    bitmap.close();
  }
}

// Turns a picked photo into a small square image before upload: centre-cropped, scaled to `size` px,
// and re-encoded (WebP, or JPEG where the browser can't write WebP). Re-encoding also drops the
// photo's metadata, such as where it was taken.
export class UnreadableImageError extends Error {
  constructor() {
    super('That file couldn’t be read as a photo. Try a JPEG, PNG or WebP.');
    this.name = 'UnreadableImageError';
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function toSquareImage(file: Blob, size: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    // Modern browsers apply the photo's EXIF rotation here, so phone photos come out upright.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnreadableImageError();
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new UnreadableImageError();
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  const webp = await encode(canvas, 'image/webp', 0.85);
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await encode(canvas, 'image/jpeg', 0.9);
  if (!jpeg) throw new UnreadableImageError();
  return jpeg;
}

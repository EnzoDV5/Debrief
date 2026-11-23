// Tells a JPEG, PNG or WebP apart by its first bytes. The browser's claimed type and the file name are
// never trusted, because the photo is served back with the type found here.
import type { AVATAR_CONTENT_TYPES } from '@debrief/shared';

type ImageType = (typeof AVATAR_CONTENT_TYPES)[number];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImageType(data: Buffer): ImageType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (
    data.length >= 12 &&
    data.toString('latin1', 0, 4) === 'RIFF' &&
    data.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

import { describe, expect, it } from 'vitest';
import {
  detectFontSignature,
  detectImageSignature,
  MediaValidationError,
  parseImageHeaderDimensions,
  validateFontFile,
  validateMediaFile,
} from './mediaValidation';

function makePngBytes(width = 16, height = 12): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // length 13 IHDR
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

function makeGifBytes(width = 320, height = 240): Uint8Array {
  const bytes = new Uint8Array(16);
  // GIF89a
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
  bytes[6] = width & 0xff;
  bytes[7] = (width >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (height >> 8) & 0xff;
  return bytes;
}

describe('mediaValidation', () => {
  it('detects PNG, JPEG, WebP, AVIF, GIF and Font magic headers accurately', () => {
    expect(detectImageSignature(makePngBytes())).toBe('image/png');
    expect(detectImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageSignature(makeGifBytes())).toBe('image/gif');

    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 0);
    expect(detectImageSignature(webp)).toBe('image/webp');

    const avif = new Uint8Array(16);
    avif.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 0);
    expect(detectImageSignature(avif)).toBe('image/avif');

    expect(detectFontSignature(new Uint8Array([0x77, 0x4f, 0x46, 0x32]))).toBe('woff2');
    expect(detectFontSignature(new Uint8Array([0x77, 0x4f, 0x46, 0x46]))).toBe('woff');
  });

  it('rejects raw SVG uploads both by extension and XML/SVG payload', async () => {
    const svgText = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    await expect(validateMediaFile(svgBlob, 'image', 'icon.svg')).rejects.toMatchObject({
      name: 'MediaValidationError',
      code: 'SVG_EXCLUDED',
    });

    // Disguised SVG named as .png with image/png mime
    const spoofedBlob = new Blob([svgText], { type: 'image/png' });
    await expect(validateMediaFile(spoofedBlob, 'wallpaper', 'fake.png')).rejects.toMatchObject({
      code: 'SVG_EXCLUDED',
    });
  });

  it('enforces separation between static image objects/wallpapers and animated GIFs', async () => {
    const gifFile = new Blob([new Uint8Array(makeGifBytes()).buffer], { type: 'image/gif' });
    await expect(validateMediaFile(gifFile, 'image', 'loop.gif')).rejects.toMatchObject({
      code: 'WRONG_MEDIA_KIND',
    });
    await expect(validateMediaFile(gifFile, 'wallpaper', 'loop.gif')).rejects.toMatchObject({
      code: 'WRONG_MEDIA_KIND',
    });

    const okGif = await validateMediaFile(gifFile, 'gif', 'loop.gif');
    expect(okGif.mimeType).toBe('image/gif');
    expect(okGif.width).toBe(320);
    expect(okGif.height).toBe(240);

    const pngFile = new Blob([new Uint8Array(makePngBytes(400, 300)).buffer], {
      type: 'image/png',
    });
    await expect(validateMediaFile(pngFile, 'gif', 'photo.png')).rejects.toMatchObject({
      code: 'WRONG_MEDIA_KIND',
    });
  });

  it('enforces dimension limits via header inspection', async () => {
    const oversizedPng = makePngBytes(7200, 1200);
    const oversizedBlob = new Blob([new Uint8Array(oversizedPng).buffer], { type: 'image/png' });
    await expect(validateMediaFile(oversizedBlob, 'image', 'huge.png')).rejects.toBeInstanceOf(
      MediaValidationError,
    );

    const dims = parseImageHeaderDimensions(makePngBytes(1920, 1080), 'image/png');
    expect(dims).toEqual({ width: 1920, height: 1080 });
  });

  it('validates custom WOFF2 fonts and rejects corrupt font payloads', async () => {
    const woff2Bytes = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x00, 0x00]);
    const validFont = await validateFontFile(
      new Blob([woff2Bytes.buffer], { type: 'font/woff2' }),
      'DisplayCustom.woff2',
    );
    expect(validFont.format).toBe('woff2');
    expect(validFont.familyName).toMatch(/^AuroraUser-DisplayCustom-/);

    const invalidFont = new Blob(['not-a-font'], { type: 'font/woff2' });
    await expect(validateFontFile(invalidFont, 'bad.woff2')).rejects.toMatchObject({
      code: 'CORRUPT_HEADER',
    });
  });
});

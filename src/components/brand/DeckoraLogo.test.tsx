import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../../public/manifest.json';
import { DeckoraLogo } from './DeckoraLogo';

function readPngDimensions(filePath: string): { isPng: boolean; width: number; height: number } {
  const buf = readFileSync(filePath);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPng = buf.subarray(0, 8).equals(signature);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { isPng, width, height };
}

describe('Phase 6.2 — DECKORA Brand Identity, Logo System & Icon Assets', () => {
  it('renders full lockup, symbol-only variant, tagline, and monochrome/light tones', () => {
    const { rerender } = render(<DeckoraLogo variant="full" tone="brand" showTagline />);
    expect(screen.getByTestId('deckora-logo')).toBeInTheDocument();
    expect(screen.getByText('DECKORA')).toBeInTheDocument();
    expect(screen.getByText('Your Personal Browser Workspace')).toBeInTheDocument();

    rerender(<DeckoraLogo variant="symbol" tone="mono-white" />);
    expect(screen.getByTestId('deckora-logo-symbol')).toBeInTheDocument();
    expect(screen.queryByText('DECKORA')).not.toBeInTheDocument();

    rerender(<DeckoraLogo variant="full" tone="mono-dark" />);
    expect(screen.getByText('DECKORA')).toHaveClass('text-[#0B1220]');

    rerender(<DeckoraLogo variant="full" tone="light" />);
    expect(screen.getByText('DECKORA')).toHaveClass('text-[#0B1220]');
  });

  it('ships complete local brand SVG assets under public/brand/', () => {
    const brandDir = resolve(process.cwd(), 'public/brand');
    const expectedSvgs = [
      'deckora-symbol.svg',
      'deckora-logo-horizontal.svg',
      'deckora-logo-mono-white.svg',
      'deckora-logo-mono-dark.svg',
      'deckora-logo-light.svg',
      'deckora-cws-promo-440x280.svg',
      'deckora-cws-marquee-1400x560.svg',
    ];

    for (const fileName of expectedSvgs) {
      const fullPath = resolve(brandDir, fileName);
      expect(existsSync(fullPath), `${fileName} must exist`).toBe(true);
      const raw = readFileSync(fullPath, 'utf8');
      expect(raw).toContain('<svg');
    }
  });

  it('declares DECKORA identity and valid 16/32/48/128 PNG icons in manifest.json', () => {
    expect(manifestJson.name).toBe('DECKORA — Your Personal Browser Workspace');
    expect(manifestJson.short_name).toBe('DECKORA');
    expect(manifestJson.icons).toEqual({
      '16': 'icons/deckora-16.png',
      '32': 'icons/deckora-32.png',
      '48': 'icons/deckora-48.png',
      '128': 'icons/deckora-128.png',
    });

    for (const [sizeKey, relPath] of Object.entries(manifestJson.icons)) {
      const expectedPx = Number(sizeKey);
      const fullPath = resolve(process.cwd(), 'public', relPath);
      expect(existsSync(fullPath)).toBe(true);
      const info = readPngDimensions(fullPath);
      expect(info).toEqual({ isPng: true, width: expectedPx, height: expectedPx });
    }
  });
});

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';
import { DECKORA_SEED_PALETTE } from '@/design-system/tokens';
import { DeckoraLogo } from './DeckoraLogo';

export interface DeckoraAboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PALETTE_SWATCHES = [
  { name: 'Midnight Navy', hex: DECKORA_SEED_PALETTE.midnightNavy },
  { name: 'Royal Slate', hex: DECKORA_SEED_PALETTE.royalSlate },
  { name: 'Ice Blue', hex: DECKORA_SEED_PALETTE.iceBlue },
  { name: 'Violet', hex: DECKORA_SEED_PALETTE.royalViolet },
  { name: 'Emerald', hex: DECKORA_SEED_PALETTE.emerald },
  { name: 'Ice White', hex: DECKORA_SEED_PALETTE.iceWhite },
] as const;

export function DeckoraAboutDialog({ open, onOpenChange }: DeckoraAboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2">
            <DeckoraLogo variant="full" tone="brand" size="lg" showTagline />
          </div>
          <DialogTitle className="sr-only">About Deckora</DialogTitle>
          <DialogDescription>
            A beautiful place to begin. Local-first, Manifest V3 customizable New Tab workspace
            using the Royal Crystal design system.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4 text-xs text-[var(--aurora-text-secondary)]">
          <div className="rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/45 p-3.5">
            <p className="font-semibold text-[var(--aurora-text)]">
              Brand System — &ldquo;The Dual Horizon Decks&rdquo; (v0.1.0)
            </p>
            <p className="mt-1 leading-relaxed">
              Refined geometric monogram uniting interlocking workspace planes, negative-space
              horizon channel, and clean typography. Zero telemetry, zero external asset CDNs, and
              strictly opt-in browser permissions.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
              Royal Crystal Palette
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PALETTE_SWATCHES.map((swatch) => (
                <div
                  key={swatch.name}
                  className="flex flex-col items-center gap-1 rounded-xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)]/30 p-2 text-center"
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 rounded-full border border-white/20"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <span className="text-[10px] font-medium text-[var(--aurora-text)]">
                    {swatch.name}
                  </span>
                  <span className="font-mono text-[9px] text-[var(--aurora-text-muted)]">
                    {swatch.hex}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--aurora-text-muted)] uppercase">
              Logo System Variants
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-center rounded-xl border border-[var(--aurora-border)] bg-[#0B1220] p-3">
                <DeckoraLogo variant="full" tone="mono-white" size="sm" />
              </div>
              <div className="flex items-center justify-center rounded-xl border border-[var(--aurora-border)] bg-[#EAF4FF] p-3">
                <DeckoraLogo variant="full" tone="light" size="sm" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

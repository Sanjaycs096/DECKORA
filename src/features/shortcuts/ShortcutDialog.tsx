import { useState, type FormEvent } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';
import type { ShortcutItem } from '@/types/workspace';
import { pickMonogramColor, validateShortcutForm } from './shortcutUtils';

export interface ShortcutDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  initialShortcut?: ShortcutItem | null;
  existingItems?: ShortcutItem[];
  onOpenChange: (open: boolean) => void;
  onSave: (shortcut: ShortcutItem) => void;
}

interface ShortcutFormBodyProps {
  mode: 'add' | 'edit';
  initialShortcut?: ShortcutItem | null;
  existingItems?: ShortcutItem[];
  onCancel: () => void;
  onSave: (shortcut: ShortcutItem) => void;
}

function ShortcutFormBody({
  mode,
  initialShortcut,
  existingItems,
  onCancel,
  onSave,
}: ShortcutFormBodyProps) {
  const [title, setTitle] = useState(initialShortcut?.title ?? '');
  const [url, setUrl] = useState(initialShortcut?.url ?? '');
  const [errorField, setErrorField] = useState<'title' | 'url' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateShortcutForm(title, url, {
      existingItems,
      excludeId: initialShortcut?.id,
    });
    if (!validation.ok) {
      setErrorField(validation.field);
      setErrorMessage(validation.message);
      return;
    }

    const nextItem: ShortcutItem = initialShortcut
      ? {
          ...initialShortcut,
          title: validation.title,
          url: validation.url,
        }
      : {
          id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: validation.title,
          url: validation.url,
          iconSource: 'favicon',
          materialSymbolName: null,
          monogramColor: pickMonogramColor(validation.title),
        };

    onSave(nextItem);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3.5" noValidate>
      <div>
        <label
          htmlFor="shortcut-title-input"
          className="mb-1.5 block text-xs font-medium text-[var(--aurora-text-secondary)]"
        >
          Name
        </label>
        <Input
          id="shortcut-title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errorField === 'title') {
              setErrorField(null);
              setErrorMessage(null);
            }
          }}
          invalid={errorField === 'title'}
          placeholder="e.g. GitHub"
          maxLength={60}
          autoFocus
        />
      </div>

      <div>
        <label
          htmlFor="shortcut-url-input"
          className="mb-1.5 block text-xs font-medium text-[var(--aurora-text-secondary)]"
        >
          URL
        </label>
        <Input
          id="shortcut-url-input"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (errorField === 'url') {
              setErrorField(null);
              setErrorMessage(null);
            }
          }}
          invalid={errorField === 'url'}
          placeholder="https://github.com"
        />
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs text-[var(--aurora-error)]">
          {errorMessage}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {mode === 'add' ? 'Add Shortcut' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ShortcutDialog({
  open,
  mode,
  initialShortcut,
  existingItems,
  onOpenChange,
  onSave,
}: ShortcutDialogProps) {
  const formKey = `${mode}-${initialShortcut?.id ?? 'new'}-${open ? 'open' : 'closed'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Shortcut' : 'Edit Shortcut'}</DialogTitle>
          <DialogDescription>
            Save a website link to your Deckora workspace shortcuts.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <ShortcutFormBody
            key={formKey}
            mode={mode}
            initialShortcut={initialShortcut}
            existingItems={existingItems}
            onCancel={() => onOpenChange(false)}
            onSave={(item) => {
              onSave(item);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

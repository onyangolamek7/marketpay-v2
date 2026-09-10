'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  id: string;
  label: string;
  hint?: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** Indeterminate bar while the submission is in flight. */
  uploading?: boolean;
  disabled?: boolean;
  error?: string | null;
  multiple?: boolean;
  /** Advisory only — the backend decides what it will actually accept. */
  accept?: string;
}

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const isImage = file.type.startsWith('image/');

  // The object URL is pushed straight at the DOM node and revoked on cleanup,
  // so nothing about the chosen file has to be mirrored in React state.
  useEffect(() => {
    const element = imageRef.current;
    if (!element || !isImage) return;
    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      // A thumbnail is a nicety; losing it must not take down the upload control.
      return;
    }
    element.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, never a remote asset
        <img ref={imageRef} alt="" className="size-12 shrink-0 rounded bg-surface-deep object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded bg-surface-deep">
          <FileText className="size-5 text-text-muted" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
        <span className="block text-sm text-text-muted">
          {(file.size / 1024).toFixed(0)} KB
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-deep hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/25"
      >
        <X className="size-4" aria-hidden="true" />
        <span className="sr-only">Remove {file.name}</span>
      </button>
    </li>
  );
}

export function FileUpload({
  id,
  label,
  hint,
  files,
  onChange,
  uploading,
  disabled,
  error,
  multiple = true,
  accept = 'image/*,application/pdf',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function add(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const next = multiple ? [...files, ...Array.from(incoming)] : [incoming[0]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) add(event.dataTransfer.files);
        }}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-action bg-action-tint/40' : 'border-border bg-card',
          error && 'border-danger',
          disabled && 'opacity-60'
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-describedby={cn(hint && `${id}-hint`, error && `${id}-error`) || undefined}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = '';
          }}
          className="sr-only"
        />
        <Upload className="mx-auto size-6 text-text-muted" aria-hidden="true" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded font-medium text-action underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-action/25"
        >
          Choose a file
        </button>
        <p className="mt-1 text-sm text-text-muted">
          <span className="hidden sm:inline">or drag it here. </span>
          Clear photos and PDFs work best.
        </p>
      </div>

      {hint && (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => onChange(files.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      )}

      {uploading && (
        // ponytail: indeterminate, because fetch reports no upload progress.
        // Swap for XHR upload events if a real percentage is ever needed.
        <div
          role="progressbar"
          aria-label="Uploading documents"
          className="h-1.5 overflow-hidden rounded-full bg-surface-deep"
        >
          <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-action" />
        </div>
      )}
    </div>
  );
}

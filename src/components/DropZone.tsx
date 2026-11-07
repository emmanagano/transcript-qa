'use client';

import { useId, useRef, useState, type DragEvent } from 'react';

export interface LoadedFile {
  name: string;
  text: string;
  lines: number;
  words: number;
}

interface Props {
  title: string;
  noun: string; // "QA version", "AI template", "transcript"
  barColor: string;
  file: LoadedFile | null;
  onFile: (f: LoadedFile | null) => void;
  parse: (text: string) => { lines: number; words: number };
}

export function DropZone({ title, noun, barColor, file, onFile, parse }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const startRename = () => {
    if (!file) return;
    setDraft(file.name.replace(/\.srt$/i, ''));
    setRenaming(true);
  };

  // only the name shown changes; the file's text is untouched and never leaves the browser
  const saveRename = () => {
    setRenaming(false);
    const base = draft.trim().replace(/\.srt$/i, '');
    if (!file || !base) return;
    onFile({ ...file, name: `${base}.srt` });
  };

  const take = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/\.srt$/i.test(f.name)) {
      setError(`“${f.name}” isn’t an .srt file.`);
      return;
    }
    const text = await f.text();
    const { lines, words } = parse(text);
    if (lines === 0) {
      setError(`“${f.name}” has no subtitles in it. Is it the right file?`);
      return;
    }
    onFile({ name: f.name, text, lines, words });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
  };

  return (
    <section aria-label={title} className="flex min-w-0 flex-[1_1_360px] flex-col overflow-hidden rounded-[20px] border border-line bg-white">
      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          {file ? (
            <span className="rounded-full bg-tint px-3 py-1 text-[13px] font-semibold text-brand-dark">Added</span>
          ) : (
            <span className="rounded-full bg-chip px-3 py-1 text-[13px] font-semibold text-ink">Needed</span>
          )}
        </div>

        {file ? (
          <div className="flex flex-col gap-3.5 rounded-xl border border-line bg-page p-4">
            <div className="flex items-center gap-3.5">
              <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={barColor} strokeWidth="1.8" className="shrink-0">
                <path d="M14 3H6v18h12V7z" />
                <path d="M14 3v4h4" />
                <path d="M9 13h6M9 17h4" />
              </svg>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {renaming ? (
                  <input
                    autoFocus
                    aria-label="File name"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename();
                      if (e.key === 'Escape') setRenaming(false);
                    }}
                    className="min-h-9 w-full rounded-lg border border-field bg-white px-2.5 text-[15px] font-semibold"
                  />
                ) : (
                  <span className="truncate text-[15px] font-semibold">{file.name}</span>
                )}
                <span className="text-[13px] text-muted">
                  {file.lines.toLocaleString()} lines · {file.words.toLocaleString()} words
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onMouseDown={(e) => renaming && e.preventDefault()}
                onClick={renaming ? saveRename : startRename}
                className="min-h-10 rounded-lg border-[1.5px] border-brand bg-white px-4 text-sm font-bold text-brand hover:bg-tint-soft"
              >
                {renaming ? 'Save name' : 'Rename'}
              </button>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => {
                  setRenaming(false);
                  onFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="min-h-10 rounded-lg border-[1.5px] border-field bg-white px-4 text-sm font-bold text-ink hover:bg-page"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed p-5 text-center ${
              over ? 'border-brand bg-tint-soft' : 'border-field bg-page hover:border-brand'
            }`}
          >
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.8">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v4h16v-4" />
            </svg>
            <span className="text-[15px] font-semibold">
              Drop the {noun} here, or <span className="text-brand underline">browse</span>
            </span>
            <span className="text-[13px] text-muted">.srt files only</span>
          </label>
        )}
        <input ref={inputRef} id={id} type="file" accept=".srt" className="sr-only" onChange={(e) => take(e.target.files?.[0])} />
        {error && (
          <p role="alert" className="rounded-xl border border-del-line bg-del-bg px-4 py-3 text-sm text-del-fg">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

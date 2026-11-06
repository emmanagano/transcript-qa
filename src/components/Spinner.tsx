export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-muted">
      <span aria-hidden="true" className="h-5 w-5 animate-spin border-2 border-field border-t-brand" />
      <span className="text-[15px]">{label}…</span>
    </div>
  );
}

// Logo mark: three stacked subtitle lines in teal, the middle one lighter (a "corrected" line).
// `size` is one unit of the mark, so callers can scale it.
export function LogoMark({ size = 9 }: { size?: number }) {
  const bar = { height: Math.max(3, size / 2.5), borderRadius: 999 };
  return (
    <span aria-hidden="true" className="flex flex-col items-start" style={{ width: size * 2.4, gap: Math.max(2, size / 4) }}>
      <span style={{ ...bar, width: '100%', background: 'var(--color-brand)' }} />
      <span style={{ ...bar, width: '65%', background: '#7CC4BA' }} />
      <span style={{ ...bar, width: '85%', background: 'var(--color-brand)' }} />
    </span>
  );
}

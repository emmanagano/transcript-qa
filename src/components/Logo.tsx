// Logo mark: three stacked subtitle lines, the middle one green like a "corrected" line.
// `size` keeps the old meaning (one unit of the mark), so existing callers don't change.
export function LogoMark({ size = 9 }: { size?: number }) {
  const bar = { height: Math.max(3, size / 2.5) };
  return (
    <span
      aria-hidden="true"
      className="flex flex-col items-start"
      style={{ width: size * 2.4, gap: Math.max(2, size / 4) }}
    >
      <span style={{ ...bar, width: '100%', background: 'var(--color-brand)' }} />
      <span style={{ ...bar, width: '65%', background: 'var(--color-accuracy)' }} />
      <span style={{ ...bar, width: '85%', background: 'var(--color-brand)' }} />
    </span>
  );
}

interface Point {
  label: string; // shown in the tooltip, e.g. case name + date
  value: number;
}

interface Props {
  title: string;
  points: Point[]; // oldest first
  color: string;
  format: (v: number) => string;
  /** fixed axis bounds; computed from the data when left out */
  min?: number;
  max?: number;
}

export function TrendChart({ title, points, color, format, min, max }: Props) {
  if (points.length < 2) {
    return (
      <figure className="m-0 flex flex-col gap-3 rounded-[20px] border border-line bg-white px-6 py-5">
        <figcaption className="text-base font-bold">{title}</figcaption>
        <p className="py-6 text-center text-muted">The trend line appears after two or more cases.</p>
      </figure>
    );
  }
  const vals = points.map((p) => p.value);
  let lo = min ?? Math.min(...vals);
  let hi = max ?? Math.max(...vals);
  if (min === undefined || max === undefined) {
    const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1;
    lo = min ?? lo - pad;
    hi = max ?? hi + pad;
  }
  const W = 1000, H = 220, left = 64, right = 16, top = 20, bottom = 180;
  const X = (i: number) => left + (i * (W - left - right)) / (points.length - 1);
  const Y = (v: number) => bottom - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (bottom - top);
  const ticks = [hi, (hi + lo) / 2, lo];

  return (
    <figure className="m-0 flex flex-col gap-3 rounded-[20px] border border-line bg-white px-6 py-5">
      <figcaption className="flex flex-wrap justify-between gap-2">
        <span className="text-base font-bold">{title}</span>
        <span className="text-[13px] text-muted">Last {points.length} cases</span>
      </figcaption>
      <svg role="img" aria-label={`${title}: from ${format(vals[0])} to ${format(vals[vals.length - 1])}`} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={left} x2={W - right} y1={Y(t)} y2={Y(t)} stroke={i === 2 ? '#C5CDC9' : '#ECEFEA'} />
            <text x={left - 12} y={Y(t) + 5} textAnchor="end" fontSize="14" fill="#55636A">
              {format(t)}
            </text>
          </g>
        ))}
        <polyline points={points.map((p, i) => `${X(i)},${Y(p.value)}`).join(' ')} fill="none" stroke={color} strokeWidth="3" />
        {points.map((p, i) => (
          // the latest point is gold: it is the one the transcriber cares about
          <circle key={i} cx={X(i)} cy={Y(p.value)} r={i === points.length - 1 ? 7 : 5} fill={i === points.length - 1 ? '#F2A93B' : '#FFFFFF'} stroke={i === points.length - 1 ? '#F2A93B' : color} strokeWidth="2.5">
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
        ))}
        <text x={left} y={H - 6} fontSize="14" fill="#55636A">{points[0].label.split(' · ').pop()}</text>
        <text x={W - right} y={H - 6} textAnchor="end" fontSize="14" fill="#55636A">{points[points.length - 1].label.split(' · ').pop()}</text>
      </svg>
    </figure>
  );
}

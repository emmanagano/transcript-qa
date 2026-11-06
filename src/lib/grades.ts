export interface Grade {
  letter: 'A' | 'B' | 'C' | 'D' | 'F';
  bg: string;
  fg: string;
}

/** American grading scale, applied to Accuracy scores (0–100). */
export function gradeFor(percent: number): Grade {
  // soft traffic light: tinted pill, strong letter. F must not shout.
  if (percent >= 90) return { letter: 'A', bg: '#DDF3E4', fg: '#17603A' };
  if (percent >= 80) return { letter: 'B', bg: '#ECF6D5', fg: '#46601A' };
  if (percent >= 70) return { letter: 'C', bg: '#FBF0D6', fg: '#7A5300' };
  if (percent >= 60) return { letter: 'D', bg: '#FCE6D6', fg: '#8A3B0E' };
  return { letter: 'F', bg: '#FBE3E1', fg: '#8E2A22' };
}

export const pct = (x: number, digits = 1) => `${x.toFixed(digits)}%`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

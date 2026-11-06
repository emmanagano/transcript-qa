export interface Grade {
  letter: 'A' | 'B' | 'C' | 'D' | 'F';
  bg: string;
  fg: string;
}

/** American grading scale, applied to Accuracy scores (0–100). */
export function gradeFor(percent: number): Grade {
  if (percent >= 90) return { letter: 'A', bg: '#2E8B57', fg: '#FFFFFF' };
  if (percent >= 80) return { letter: 'B', bg: '#9CD326', fg: '#1F2433' };
  if (percent >= 70) return { letter: 'C', bg: '#FFCB00', fg: '#1F2433' };
  if (percent >= 60) return { letter: 'D', bg: '#C2510F', fg: '#FFFFFF' };
  return { letter: 'F', bg: '#C62F46', fg: '#FFFFFF' };
}

export const pct = (x: number, digits = 1) => `${x.toFixed(digits)}%`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

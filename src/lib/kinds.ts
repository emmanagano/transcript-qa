import type { Kind, Mode } from './compare/engine';

export interface KindStyle {
  label: string;
  bg: string;
  fg: string;
}

const INK = '#17262B';

// `bg` is the colour of the dot shown before the label on a tag. Warm = content errors, cool = formatting.
const shared = {
  punct: { label: 'Punctuation', bg: '#3E7BFA', fg: INK },
  caps: { label: 'Capitalization', bg: '#6E6CF0', fg: INK },
  dash: { label: 'Dialog dash', bg: '#64748B', fg: INK },
  seg: { label: 'Re-segmented', bg: '#8B8D98', fg: INK },
  time: { label: 'Timestamp', bg: '#4F46E5', fg: INK },
};

/**
 * Labels follow the comparison: in Accuracy the QA is the reference, so a word the
 * QA has that you don't is "missed". In Effort the AI template is the reference, so
 * the same situation means you removed one of the AI's words.
 */
export const KINDS: Record<Mode, Record<Kind, KindStyle>> = {
  accuracy: {
    wrong: { label: 'Wrong word', bg: '#E5644E', fg: INK },
    missed: { label: 'Missed word', bg: '#D6457A', fg: INK },
    extra: { label: 'Extra word', bg: '#B2459B', fg: INK },
    ...shared,
  },
  effort: {
    wrong: { label: 'Word fixed', bg: '#E5644E', fg: INK },
    extra: { label: 'Word added', bg: '#D6457A', fg: INK },
    missed: { label: 'Word removed', bg: '#B2459B', fg: INK },
    ...shared,
  },
};

export const KIND_ORDER: Record<Mode, Kind[]> = {
  accuracy: ['wrong', 'missed', 'extra', 'punct', 'caps', 'dash'],
  effort: ['wrong', 'extra', 'missed', 'punct', 'caps', 'dash', 'seg', 'time'],
};

/** Teal is the only brand accent, so both comparisons share it. */
export const MODE_COLOR: Record<Mode, string> = {
  accuracy: '#0F766E',
  effort: '#0F766E',
};

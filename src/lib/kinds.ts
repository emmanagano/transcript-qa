import type { Kind, Mode } from './compare/engine';

export interface KindStyle {
  label: string;
  bg: string;
  fg: string;
}

const WHITE = '#FFFFFF';
const INK = '#1F2433';

const shared = {
  punct: { label: 'Punctuation', bg: '#FFCB00', fg: INK },
  caps: { label: 'Capitalization', bg: '#1F6FD1', fg: WHITE },
  dash: { label: 'Dialog dash', bg: '#0E7C7B', fg: WHITE },
  seg: { label: 'Re-segmented', bg: '#6B7280', fg: WHITE },
  time: { label: 'Timestamp', bg: '#1E3A8A', fg: WHITE },
};

/**
 * Labels follow the comparison: in Accuracy the QA is the reference, so a word the
 * QA has that you don't is "missed". In Effort the AI template is the reference, so
 * the same situation means you removed one of the AI's words.
 */
export const KINDS: Record<Mode, Record<Kind, KindStyle>> = {
  accuracy: {
    wrong: { label: 'Wrong word', bg: '#C62F46', fg: WHITE },
    missed: { label: 'Missed word', bg: '#C2510F', fg: WHITE },
    extra: { label: 'Extra word', bg: '#7B3FD1', fg: WHITE },
    ...shared,
  },
  effort: {
    wrong: { label: 'Word fixed', bg: '#C62F46', fg: WHITE },
    extra: { label: 'Word added', bg: '#C2510F', fg: WHITE },
    missed: { label: 'Word removed', bg: '#7B3FD1', fg: WHITE },
    ...shared,
  },
};

export const KIND_ORDER: Record<Mode, Kind[]> = {
  accuracy: ['wrong', 'missed', 'extra', 'punct', 'caps', 'dash'],
  effort: ['wrong', 'extra', 'missed', 'punct', 'caps', 'dash', 'seg', 'time'],
};

export const MODE_COLOR: Record<Mode, string> = {
  accuracy: '#2E8B57',
  effort: '#1F6FD1',
};

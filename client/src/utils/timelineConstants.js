// Shared metadata for the Timeline ("Life Map") feature.

export const LANES = [
  { key: 'career',        label: 'Career',        emoji: '💼', color: '#3498DB' },
  { key: 'education',     label: 'Education',     emoji: '🎓', color: '#2ECC71' },
  { key: 'travel',        label: 'Travel',        emoji: '✈️', color: '#9B59B6' },
  { key: 'health',        label: 'Health',        emoji: '🩺', color: '#1ABC9C' },
  { key: 'relationships', label: 'Relationships', emoji: '❤️', color: '#FF6B9D' },
  { key: 'finance',       label: 'Finance',       emoji: '💰', color: '#F1C40F' },
  { key: 'personal',      label: 'Personal',      emoji: '🌱', color: '#E67E22' },
  { key: 'general',       label: 'General',       emoji: '🗂️', color: '#6366f1' },
];

export const TYPES = [
  { key: 'dream',     label: 'Dreams',     emoji: '🌫' },
  { key: 'goal',      label: 'Goals',      emoji: '🎯' },
  { key: 'milestone', label: 'Milestones', emoji: '📍' },
];

export const STATUSES = ['planned', 'active', 'completed', 'abandoned'];

const LANE_BY_KEY = Object.fromEntries(LANES.map(l => [l.key, l]));

export function laneMeta(key) {
  return LANE_BY_KEY[key] || LANE_BY_KEY.general;
}

// Effective color for an item: explicit override, else its lane default.
export function itemColor(item) {
  return item.color || laneMeta(item.lane).color;
}

// Mood helpers (1-10 scale, consistent with therapy journal)
export function moodColor(v) {
  if (!v) return 'var(--text-dimmed)';
  if (v >= 7) return '#2ECC71';
  if (v >= 5) return '#F1C40F';
  return '#E74C3C';
}
export function moodEmoji(v) {
  if (!v) return null;
  if (v >= 8) return '😊';
  if (v >= 6) return '🙂';
  if (v >= 4) return '😶';
  if (v >= 2) return '😔';
  return '😞';
}

export const MOOD_OPTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

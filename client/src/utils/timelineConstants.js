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

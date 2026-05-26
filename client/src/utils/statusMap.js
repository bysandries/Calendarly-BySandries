/**
 * GTD Status normalization — maps all known status strings
 * to a canonical { key, label, color, cssClass } object.
 */

const STATUS_MAP = {
  // Notion GTD format (canonical)
  '00 - Not Done - Due Date Passed': { key: 'not-done', label: 'Due Date Passed', color: '#E74C3C', cssClass: 'not-done' },
  '00 - Cancelled': { key: 'cancelled', label: 'Cancelled', color: '#7F8C8D', cssClass: 'cancelled' },
  '00 - Not Actionable': { key: 'not-actionable', label: 'Not Actionable', color: '#7F8C8D', cssClass: 'not-actionable' },
  '01 - Inbox': { key: 'inbox', label: 'Inbox', color: '#95A5A6', cssClass: 'inbox' },
  '01 - To Calendar': { key: 'to-calendar', label: 'To Calendar', color: '#9B59B6', cssClass: 'to-calendar' },
  '02 - Next Step': { key: 'next-step', label: 'Next Step', color: '#3498DB', cssClass: 'next-step' },
  '03 - In Progress': { key: 'in-progress', label: 'In Progress', color: '#E67E22', cssClass: 'in-progress' },
  '04 - Waiting for Someone': { key: 'waiting', label: 'Waiting for Someone', color: '#F39C12', cssClass: 'waiting' },
  '04 - Delegate It': { key: 'delegate', label: 'Delegate It', color: '#F1C40F', cssClass: 'delegate' },
  '05 - Snoozed': { key: 'snoozed', label: 'Snoozed', color: '#34495E', cssClass: 'snoozed' },
  '06 - Someday / Maybe': { key: 'someday', label: 'Someday / Maybe', color: '#8E44AD', cssClass: 'someday' },
  '07 - Done': { key: 'done', label: 'Done', color: '#2ECC71', cssClass: 'done' },

  // Compatibility with old strings or short keys
  '04 - Waiting':     { key: 'waiting',     label: 'Waiting',     color: '#F39C12', cssClass: 'waiting' },
  '05 - Someday':     { key: 'someday',     label: 'Someday',     color: '#8E44AD', cssClass: 'someday' },
  '06 - Reference':   { key: 'reference',   label: 'Reference',   color: '#7F8C8D', cssClass: 'reference' },
  'inbox':       { key: 'inbox',       label: 'Inbox',       color: '#95A5A6', cssClass: 'inbox' },
  'next-step':   { key: 'next-step',   label: 'Next Step',   color: '#3498DB', cssClass: 'next-step' },
  'in-progress': { key: 'in-progress', label: 'In Progress', color: '#E67E22', cssClass: 'in-progress' },
  'done':        { key: 'done',        label: 'Done',        color: '#2ECC71', cssClass: 'done' },
};

// Canonical statuses for the UI selection (Notion GTD format)
export const GTD_STATUSES = [
  '00 - Not Done - Due Date Passed',
  '00 - Cancelled',
  '00 - Not Actionable',
  '01 - Inbox',
  '01 - To Calendar',
  '02 - Next Step',
  '03 - In Progress',
  '04 - Waiting for Someone',
  '04 - Delegate It',
  '05 - Snoozed',
  '06 - Someday / Maybe',
  '07 - Done',
];

/**
 * Given a raw status string from the DB, return the normalized info.
 */
export function getStatusInfo(rawStatus) {
  if (!rawStatus) {
    return STATUS_MAP['01 - Inbox'];
  }
  return STATUS_MAP[rawStatus] || {
    key: rawStatus.toLowerCase().replace(/\s+/g, '-'),
    label: rawStatus.replace(/^\d+\s*-\s*/, ''),
    color: '#95A5A6',
    cssClass: 'inbox',
  };
}

/**
 * Task Tabs — groups canonical statuses into 4 UX buckets
 */
export const TASK_TABS = [
  {
    key: 'priorities',
    label: 'Priorities',
    statuses: [], // Filtered by is_starred instead
  },
  {
    key: 'actionable',
    label: 'Actionable',
    statuses: [
      '01 - Inbox',
      '02 - Next Step',
      '03 - In Progress',
      '04 - Waiting for Someone',
      '04 - Delegate It',
    ],
  },
  {
    key: 'planned',
    label: 'Planned',
    statuses: [
      '01 - To Calendar',
      '05 - Snoozed',
    ],
  },
  {
    key: 'someday',
    label: 'Someday',
    statuses: [
      '06 - Someday / Maybe',
    ],
  },
  {
    key: 'done',
    label: 'Done',
    statuses: [
      '07 - Done',
      '00 - Cancelled',
      '00 - Not Done - Due Date Passed',
    ],
  },
];

/**
 * Given a canonical status string, return the tab key it belongs to.
 */
export function getTabForStatus(status) {
  for (const tab of TASK_TABS) {
    if (tab.statuses.includes(status)) return tab.key;
  }
  return 'actionable';
}

/**
 * Priority helpers
 */
export const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'];
export const PRIORITY_COLORS = ['#444444', '#3498DB', '#E67E22', '#E74C3C'];

export function getNextPriority(current) {
  return (current + 1) % 4;
}

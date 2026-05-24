// Pure helpers for task time/urgency math.
// Assumption: the user can dedicate 60 work-minutes per day.

export const MINUTES_PER_WORK_DAY = 60;

export function formatDuration(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return '—';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export function calcDaysLeft(dateDueStr) {
  if (!dateDueStr) return null;
  const due = new Date(dateDueStr);
  if (isNaN(due.getTime())) return null;
  const today = new Date();
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

export function formatDaysLeft(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return '—';
  if (daysLeft === 0) return 'Today';
  if (daysLeft < 0) return `Overdue ${Math.abs(daysLeft)}d`;
  return `${daysLeft}d`;
}

export function calcUrgency(daysLeft, estimatedMinutes) {
  const minutes = Number(estimatedMinutes);
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(minutes) || minutes <= 0) {
    return { label: '—', slack: null, daysNeeded: null, cssClass: 'urgency-unknown' };
  }
  const daysNeeded = Math.ceil(minutes / MINUTES_PER_WORK_DAY);
  const slack = daysLeft - daysNeeded;
  let label, cssClass;
  if (slack < 0) { label = 'Critical'; cssClass = 'urgency-critical'; }
  else if (slack === 0) { label = 'High'; cssClass = 'urgency-high'; }
  else if (slack <= 2) { label = 'Medium'; cssClass = 'urgency-medium'; }
  else { label = 'Low'; cssClass = 'urgency-low'; }
  return { label, slack, daysNeeded, cssClass };
}

export function formatIsoDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

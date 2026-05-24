import { DateTime } from 'luxon';

/**
 * Parses an RFC 5545 RRULE string into a key-value object.
 * Example: "FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1"
 * -> { FREQ: 'WEEKLY', BYDAY: 'MO,WE,FR', INTERVAL: '1' }
 */
export function parseRRule(rruleStr) {
  if (!rruleStr) return null;
  const parts = rruleStr.split(';');
  const rules = {};
  parts.forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      rules[key.trim().toUpperCase()] = value.trim();
    }
  });
  return rules;
}

// Map RRULE days to Luxon weekday numbers (1 = Monday, 7 = Sunday)
const DAY_MAP = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7
};

/**
 * Expands a single recurring event within the given visible start/end date range.
 * Returns an array of virtual event occurrences (or the event itself if it falls in range).
 *
 * @param {Object} event The database event object
 * @param {DateTime} viewStart The start of the visible range (Luxon DateTime)
 * @param {DateTime} viewEnd The end of the visible range (Luxon DateTime)
 * @returns {Array<Object>} List of expanded event occurrences
 */
export function expandEventRecurrence(event, viewStart, viewEnd) {
  const targetZone = viewStart.zoneName;
  const startStr = viewStart.toISODate();
  const endStr = viewEnd.toISODate();

  // If there's no RRULE, simply return the event if its date_string is within the view range
  if (!event.rrule) {
    if (event.date_string >= startStr && event.date_string <= endStr) {
      return [event];
    }
    return [];
  }

  const rules = parseRRule(event.rrule);
  if (!rules || !rules.FREQ) {
    if (event.date_string >= startStr && event.date_string <= endStr) {
      return [event];
    }
    return [];
  }

  const eventStart = DateTime.fromISO(event.date_string, { zone: targetZone });
  const freq = rules.FREQ.toUpperCase();
  const interval = parseInt(rules.INTERVAL || '1', 10);
  
  // Parse UNTIL if present
  let untilDate = null;
  if (rules.UNTIL) {
    // UNTIL can be YYYYMMDDThhmmssZ or YYYYMMDD
    const cleanUntil = rules.UNTIL.replace(/[-:]/g, '');
    if (cleanUntil.length >= 8) {
      const year = parseInt(cleanUntil.substring(0, 4), 10);
      const month = parseInt(cleanUntil.substring(4, 6), 10);
      const day = parseInt(cleanUntil.substring(6, 8), 10);
      untilDate = DateTime.fromObject({ year, month, day }, { zone: targetZone }).endOf('day');
    }
  }

  const maxCount = rules.COUNT ? parseInt(rules.COUNT, 10) : Infinity;

  // We only expand occurrences up to the end of our current view window, or UNTIL, whichever is earlier
  const expansionEnd = untilDate && untilDate < viewEnd ? untilDate : viewEnd;

  const occurrences = [];
  let currentCount = 0;

  if (freq === 'DAILY') {
    let current = eventStart;
    while (current.toISODate() <= expansionEnd.toISODate() && currentCount < maxCount) {
      const curStr = current.toISODate();
      if (curStr >= startStr && curStr <= endStr && current >= eventStart) {
        occurrences.push(createOccurrence(event, current));
      }
      currentCount++;
      current = current.plus({ days: interval });
    }
  } else if (freq === 'WEEKLY') {
    const byDay = rules.BYDAY ? rules.BYDAY.split(',') : [];
    
    if (byDay.length === 0) {
      // If no BYDAY is specified, it repeats weekly on the same day of the week as eventStart
      let current = eventStart;
      while (current.toISODate() <= expansionEnd.toISODate() && currentCount < maxCount) {
        const curStr = current.toISODate();
        if (curStr >= startStr && curStr <= endStr && current >= eventStart) {
          occurrences.push(createOccurrence(event, current));
        }
        currentCount++;
        current = current.plus({ weeks: interval });
      }
    } else {
      // If BYDAY is specified, e.g. BYDAY=MO,WE,FR
      // We step week-by-week starting from the week containing eventStart
      const targetDays = byDay.map(d => DAY_MAP[d.toUpperCase()]).filter(Boolean);
      
      let currentWeekStart = eventStart.startOf('week');
      let keepGoing = true;

      while (keepGoing && currentCount < maxCount) {
        // Check matching days in this week
        for (const weekdayNum of targetDays) {
          const occurrenceDate = currentWeekStart.plus({ days: weekdayNum - 1 });
          const occStr = occurrenceDate.toISODate();
          
          if (occStr > expansionEnd.toISODate()) {
            // Since days are ordered, once we exceed expansionEnd we might be done.
            if (weekdayNum === Math.max(...targetDays)) {
              keepGoing = false;
            }
            continue;
          }

          if (occurrenceDate >= eventStart && occStr >= startStr && occStr <= endStr) {
            occurrences.push(createOccurrence(event, occurrenceDate));
            currentCount++;
            if (currentCount >= maxCount) {
              keepGoing = false;
              break;
            }
          }
        }

        if (currentWeekStart.plus({ weeks: interval }).toISODate() > expansionEnd.toISODate()) {
          keepGoing = false;
        } else {
          currentWeekStart = currentWeekStart.plus({ weeks: interval });
        }
      }
    }
  } else {
    // Fallback for other/unsupported frequencies (e.g. monthly/yearly)
    if (event.date_string >= startStr && event.date_string <= endStr) {
      occurrences.push(event);
    }
  }

  return occurrences;
}

/**
 * Creates a virtual event occurrence for a specific date.
 */
function createOccurrence(event, occurrenceDate) {
  const dateStr = occurrenceDate.toISODate();
  return {
    ...event,
    // Virtual ID combines original event ID and occurrence date to ensure uniqueness in React key loops
    id: `${event.id}_occ_${dateStr}`,
    original_event_id: event.id,
    date_string: dateStr,
    // Mark as recurring instance
    is_recurring_instance: true
  };
}

/**
 * Expands a list of events (both recurring and non-recurring) for the visible range.
 *
 * @param {Array<Object>} events Raw database events list
 * @param {DateTime} viewStart Start date of the range
 * @param {DateTime} viewEnd End date of the range
 * @returns {Array<Object>} Complete list of expanded events
 */
export function expandEventsForRange(events, viewStart, viewEnd) {
  if (!Array.isArray(events)) return [];
  const expanded = [];
  events.forEach(event => {
    const instances = expandEventRecurrence(event, viewStart, viewEnd);
    expanded.push(...instances);
  });
  return expanded;
}

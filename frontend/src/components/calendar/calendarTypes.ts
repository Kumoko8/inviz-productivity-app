export type CalEvent = {
    id: string;
    title: string;
    date: string; // 'YYYY-MM-DD' — start date
    color: string;
    time?: string;
    note?: string;
    recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    recurrenceEnd?: string; // 'YYYY-MM-DD' optional end date for series
    excludedDates?: string[]; // individual occurrences deleted from the series
    durationValue?: number;
    durationUnit?: 'hours' | 'days';
};

export type View = 'month' | 'week' | 'year';

export type FormState = {
    title: string;
    time: string;
    note: string;
    color: string;
    recurrence: string;
    recurrenceEnd: string;
    durationValue: string;
    durationUnit: string;
};

export const EVENT_COLORS = [
    '#c084fc', // purple
    '#f472b6', // pink
    '#fb923c', // orange
    '#facc15', // yellow
    '#4ade80', // green
    '#22d3ee', // cyan
    '#60a5fa', // blue
    '#f87171', // red
];

export const INITIAL_FORM: FormState = {
    title: '', time: '', note: '', color: EVENT_COLORS[0],
    recurrence: '', recurrenceEnd: '', durationValue: '', durationUnit: 'hours',
};

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function toKey(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseKey(key: string): { y: number; m: number; d: number } {
    const [y, m, d] = key.split('-').map(Number);
    return { y, m: m - 1, d };
}

export function getDaysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
}

export function getFirstDayOfWeek(y: number, m: number) {
    return new Date(y, m, 1).getDay();
}

export function expandRecurrence(ev: CalEvent, rangeStart: Date, rangeEnd: Date): string[] {
    const dates: string[] = [];
    const excluded = new Set(ev.excludedDates ?? []);
    const evStart = new Date(ev.date + 'T00:00:00');
    const seriesEnd = ev.recurrenceEnd ? new Date(ev.recurrenceEnd + 'T00:00:00') : null;
    const limit = seriesEnd && seriesEnd < rangeEnd ? seriesEnd : rangeEnd;
    let cur = new Date(evStart);
    let iter = 0;
    while (cur <= limit && iter < 750) {
        iter++;
        if (cur >= rangeStart) {
            const key = toKey(cur.getFullYear(), cur.getMonth(), cur.getDate());
            if (!excluded.has(key)) dates.push(key);
        }
        if (ev.recurrence === 'daily') cur.setDate(cur.getDate() + 1);
        else if (ev.recurrence === 'weekly') cur.setDate(cur.getDate() + 7);
        else if (ev.recurrence === 'monthly') cur.setMonth(cur.getMonth() + 1);
        else if (ev.recurrence === 'yearly') cur.setFullYear(cur.getFullYear() + 1);
        else break;
    }
    return dates;
}

export function buildEventsByDate(
    events: CalEvent[],
    view: View,
    viewDate: { year: number; month: number },
    weekStart: Date,
): Record<string, CalEvent[]> {
    let rangeStart: Date, rangeEnd: Date;
    if (view === 'week') {
        rangeStart = new Date(weekStart);
        rangeEnd = new Date(weekStart);
        rangeEnd.setDate(rangeEnd.getDate() + 6);
    } else if (view === 'year') {
        rangeStart = new Date(viewDate.year, 0, 1);
        rangeEnd = new Date(viewDate.year, 11, 31);
    } else {
        rangeStart = new Date(viewDate.year, viewDate.month - 1, 15);
        rangeEnd = new Date(viewDate.year, viewDate.month + 2, 0);
    }
    const acc: Record<string, CalEvent[]> = {};
    for (const ev of events) {
        const startDates = ev.recurrence ? expandRecurrence(ev, rangeStart, rangeEnd) : [ev.date];
        const daySpan = ev.durationUnit === 'days' && ev.durationValue && ev.durationValue > 1 ? ev.durationValue : 1;
        for (const startKey of startDates) {
            for (let i = 0; i < daySpan; i++) {
                const d = new Date(startKey + 'T00:00:00');
                d.setDate(d.getDate() + i);
                const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
                if (!acc[key]) acc[key] = [];
                if (!acc[key].find(e => e.id === ev.id)) acc[key].push(ev);
            }
        }
    }
    return acc;
}

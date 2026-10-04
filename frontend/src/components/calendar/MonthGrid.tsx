import React from 'react';
import { CalEvent, DAYS, toKey, getDaysInMonth, getFirstDayOfWeek } from './calendarTypes';
import EventChip from './EventChip';

type Props = {
    viewDate: { year: number; month: number };
    todayKey: string;
    eventsByDate: Record<string, CalEvent[]>;
    onNewEvent: (dateKey: string) => void;
    onEditEvent: (ev: CalEvent, occurrenceDate: string) => void;
};

const MonthGrid: React.FC<Props> = ({ viewDate, todayKey, eventsByDate, onNewEvent, onEditEvent }) => {
    const { year, month } = viewDate;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const daysInPrev = getDaysInMonth(year, month === 0 ? 11 : month - 1);

    const cells: { key: string; day: number; cur: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrev - i;
        const prevM = month === 0 ? 11 : month - 1;
        const prevY = month === 0 ? year - 1 : year;
        cells.push({ key: toKey(prevY, prevM, d), day: d, cur: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ key: toKey(year, month, d), day: d, cur: true });
    }
    while (cells.length % 7 !== 0) {
        const d = cells.length - firstDay - daysInMonth + 1;
        const nextM = month === 11 ? 0 : month + 1;
        const nextY = month === 11 ? year + 1 : year;
        cells.push({ key: toKey(nextY, nextM, d), day: d, cur: false });
    }

    return (
        <div className="flex flex-col gap-0 flex-1 min-h-0">
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-purple-300 py-1">{d}</div>
                ))}
            </div>
            <div
                className="grid grid-cols-7 flex-1"
                style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(0, 1fr))` }}
            >
                {cells.map(cell => {
                    const isToday = cell.key === todayKey;
                    const dayEvents = eventsByDate[cell.key] ?? [];
                    return (
                        <div
                            key={cell.key}
                            onClick={() => cell.cur && onNewEvent(cell.key)}
                            className={`border border-white/10 p-1 cursor-pointer transition-colors relative flex flex-col
                                ${cell.cur ? 'hover:bg-white/10' : 'opacity-30 cursor-default'}
                                ${isToday ? 'ring-2 ring-inset ring-yellow-400' : ''}`}
                            style={{ minHeight: '70px' }}
                        >
                            <span className={`text-xs font-semibold self-end mb-0.5 w-5 h-5 flex items-center justify-center rounded-full
                                ${isToday ? 'bg-yellow-400 text-black' : 'text-white/70'}`}>
                                {cell.day}
                            </span>
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                {dayEvents.slice(0, 3).map(ev => (
                                    <EventChip
                                        key={ev.id}
                                        ev={ev}
                                        onClick={e => { e.stopPropagation(); onEditEvent(ev, cell.key); }}
                                        className="text-[10px] leading-tight"
                                    />
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-[9px] text-white/50 px-1">+{dayEvents.length - 3} more</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthGrid;

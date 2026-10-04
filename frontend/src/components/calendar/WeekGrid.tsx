import React from 'react';
import { CalEvent, DAYS, toKey } from './calendarTypes';
import EventChip from './EventChip';

type Props = {
    weekStart: Date;
    todayKey: string;
    eventsByDate: Record<string, CalEvent[]>;
    onNewEvent: (dateKey: string) => void;
    onEditEvent: (ev: CalEvent, occurrenceDate: string) => void;
};

const WeekGrid: React.FC<Props> = ({ weekStart, todayKey, eventsByDate, onNewEvent, onEditEvent }) => {
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    return (
        <div className="flex flex-col flex-1 gap-1 min-h-0">
            {/* Day name headers */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => (
                    <div key={i} className="text-center text-xs font-bold text-purple-300 py-1">
                        {DAYS[d.getDay()]}
                    </div>
                ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1 flex-1" style={{ minHeight: 0 }}>
                {days.map((d, i) => {
                    const key = toKey(d.getFullYear(), d.getMonth(), d.getDate());
                    const isToday = key === todayKey;
                    const dayEvents = eventsByDate[key] ?? [];
                    return (
                        <div
                            key={i}
                            onClick={() => onNewEvent(key)}
                            className={`border border-white/10 rounded p-1 flex flex-col gap-0.5 cursor-pointer hover:bg-white/10 transition-colors
                                ${isToday ? 'ring-2 ring-inset ring-yellow-400' : ''}`}
                        >
                            <span className={`text-xs font-semibold self-center mb-1 w-6 h-6 flex items-center justify-center rounded-full
                                ${isToday ? 'bg-yellow-400 text-black' : 'text-white/70'}`}>
                                {d.getDate()}
                            </span>
                            {dayEvents.map(ev => (
                                <EventChip
                                    key={ev.id}
                                    ev={ev}
                                    onClick={e => { e.stopPropagation(); onEditEvent(ev, key); }}
                                    className="text-[10px] leading-tight"
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WeekGrid;

import React from 'react';
import { CalEvent, MONTHS, toKey, getDaysInMonth, getFirstDayOfWeek } from './calendarTypes';

type Props = {
    viewDate: { year: number; month: number };
    todayKey: string;
    eventsByDate: Record<string, CalEvent[]>;
    onSelectMonth: (month: number) => void;
};

const YearGrid: React.FC<Props> = ({ viewDate, todayKey, eventsByDate, onSelectMonth }) => {
    const { year } = viewDate;

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto">
            {MONTHS.map((mName, m) => {
                const days = getDaysInMonth(year, m);
                const firstDay = getFirstDayOfWeek(year, m);
                const cells: { key: string | null; d: number | null }[] = [];
                for (let i = 0; i < firstDay; i++) cells.push({ key: null, d: null });
                for (let d = 1; d <= days; d++) cells.push({ key: toKey(year, m, d), d });
                while (cells.length % 7 !== 0) cells.push({ key: null, d: null });

                return (
                    <div
                        key={m}
                        onClick={() => onSelectMonth(m)}
                        className="bg-white/5 rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                        <div className="text-xs font-bold text-purple-300 mb-1 text-center">{mName}</div>
                        <div className="grid grid-cols-7 gap-0">
                            {cells.map((cell, ci) => {
                                if (!cell.key || !cell.d) {
                                    return <div key={ci} className="w-4 h-4" />;
                                }
                                const isToday = cell.key === todayKey;
                                const hasEvents = (eventsByDate[cell.key]?.length ?? 0) > 0;
                                return (
                                    <div
                                        key={ci}
                                        className={`w-4 h-4 flex items-center justify-center rounded-full text-[8px] relative
                                            ${isToday ? 'bg-yellow-400 text-black font-bold' : 'text-white/50'}`}
                                    >
                                        {cell.d}
                                        {hasEvents && !isToday && (
                                            <span className="absolute bottom-0 right-0 w-1 h-1 rounded-full bg-purple-400" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default YearGrid;

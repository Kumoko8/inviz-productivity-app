import React from 'react';
import { CalEvent } from './calendarTypes';

type Props = {
    ev: CalEvent;
    onClick: (e: React.MouseEvent) => void;
    className?: string;
};

const EventChip: React.FC<Props> = ({ ev, onClick, className = '' }) => (
    <div
        onClick={onClick}
        className={`truncate rounded px-1 py-0.5 font-medium cursor-pointer hover:opacity-80 ${className}`}
        style={{ backgroundColor: ev.color, color: '#111' }}
    >
        {ev.recurrence && <span className="mr-0.5 opacity-70">↻</span>}
        {ev.time ? `${ev.time} ` : ''}
        {ev.durationValue
            ? <span className="opacity-70 mr-0.5">[{ev.durationValue}{ev.durationUnit === 'hours' ? 'h' : 'd'}]</span>
            : null}
        {ev.title}
    </div>
);

export default EventChip;

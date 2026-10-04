// REFACTORED — logic split into calendar/ subdirectory
import React, { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import {
    getItemsForCharacter,
    addItemToCharacter,
    updateItemForCharacter,
    deleteItemFromCharacter,
} from '../services/characterService';
import {
    CalEvent, View, FormState,
    EVENT_COLORS, INITIAL_FORM, MONTHS,
    toKey, buildEventsByDate,
} from './calendar/calendarTypes';
import MonthGrid from './calendar/MonthGrid';
import WeekGrid from './calendar/WeekGrid';
import YearGrid from './calendar/YearGrid';
import EventForm from './calendar/EventForm';

type Props = {
    onClose: () => void;
    characterId?: string | null;
};

const CalendarModal: React.FC<Props> = ({ onClose, characterId }) => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid ?? null;

    const today = new Date();
    const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [weekStart, setWeekStart] = useState<Date>(() => {
        const d = new Date(today);
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [view, setView] = useState<View>('month');
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Event editor state
    const [editingDate, setEditingDate] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const formRef = useRef<HTMLDivElement>(null);

    // Load events
    useEffect(() => {
        if (!uid || !characterId) { setLoading(false); return; }
        getItemsForCharacter(uid, characterId, 'calendarEvents').then((items: any[]) => {
            setEvents(items as CalEvent[]);
            setLoading(false);
        });
    }, [uid, characterId]);

    const eventsByDate = buildEventsByDate(events, view, viewDate, weekStart);

    // --- CRUD ---
    const openNewEvent = (dateKey: string) => {
        setEditingDate(dateKey);
        setEditingEvent(null);
        setForm(INITIAL_FORM);
    };

    const openEditEvent = (ev: CalEvent, occurrenceDate?: string) => {
        setEditingDate(occurrenceDate ?? ev.date);
        setEditingEvent(ev);
        setForm({ title: ev.title, time: ev.time ?? '', note: ev.note ?? '', color: ev.color, recurrence: ev.recurrence ?? '', recurrenceEnd: ev.recurrenceEnd ?? '', durationValue: ev.durationValue != null ? String(ev.durationValue) : '', durationUnit: ev.durationUnit ?? 'hours' });
    };

    const closeForm = () => { setEditingDate(null); setEditingEvent(null); };

    const saveEvent = async () => {
        if (!form.title.trim() || !editingDate || !uid || !characterId) return;
        setSaving(true);
        try {
            if (editingEvent) {
                await updateItemForCharacter(uid, characterId, 'calendarEvents', editingEvent.id, {
                    title: form.title.trim(),
                    time: form.time,
                    note: form.note,
                    color: form.color,
                    recurrence: form.recurrence || null,
                    recurrenceEnd: form.recurrenceEnd || null,
                    durationValue: form.durationValue ? Number(form.durationValue) : null,
                    durationUnit: form.durationValue ? form.durationUnit : null,
                });
                setEvents(prev => prev.map(e => e.id === editingEvent.id
                    ? { ...e, title: form.title.trim(), time: form.time, note: form.note, color: form.color, recurrence: (form.recurrence as CalEvent['recurrence']) || undefined, recurrenceEnd: form.recurrenceEnd || undefined, durationValue: form.durationValue ? Number(form.durationValue) : undefined, durationUnit: form.durationValue ? (form.durationUnit as CalEvent['durationUnit']) : undefined }
                    : e));
            } else {
                const id = await addItemToCharacter(uid, characterId, 'calendarEvents', {
                    title: form.title.trim(),
                    date: editingDate,
                    time: form.time,
                    note: form.note,
                    color: form.color,
                    ...(form.recurrence ? { recurrence: form.recurrence, recurrenceEnd: form.recurrenceEnd || undefined } : {}),
                    ...(form.durationValue ? { durationValue: Number(form.durationValue), durationUnit: form.durationUnit } : {}),
                });
                if (id) {
                    setEvents(prev => [...prev, {
                        id, title: form.title.trim(), date: editingDate,
                        time: form.time, note: form.note, color: form.color,
                        ...(form.recurrence ? { recurrence: form.recurrence as CalEvent['recurrence'], recurrenceEnd: form.recurrenceEnd || undefined } : {}),
                        ...(form.durationValue ? { durationValue: Number(form.durationValue), durationUnit: form.durationUnit as CalEvent['durationUnit'] } : {}),
                    }]);
                }
            }
            closeForm();
        } finally {
            setSaving(false);
        }
    };

    const deleteEvent = async (ev: CalEvent) => {
        if (!uid || !characterId) return;
        await deleteItemFromCharacter(uid, characterId, 'calendarEvents', ev.id);
        setEvents(prev => prev.filter(e => e.id !== ev.id));
        closeForm();
    };

    const deleteOccurrence = async (ev: CalEvent, dateKey: string) => {
        if (!uid || !characterId) return;
        const excluded = [...(ev.excludedDates ?? []), dateKey];
        await updateItemForCharacter(uid, characterId, 'calendarEvents', ev.id, { excludedDates: excluded });
        setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, excludedDates: excluded } : e));
        closeForm();
    };

    // --- Navigation ---
    const prevMonth = () => setViewDate(v => {
        const m = v.month === 0 ? 11 : v.month - 1;
        const y = v.month === 0 ? v.year - 1 : v.year;
        return { year: y, month: m };
    });
    const nextMonth = () => setViewDate(v => {
        const m = v.month === 11 ? 0 : v.month + 1;
        const y = v.month === 11 ? v.year + 1 : v.year;
        return { year: y, month: m };
    });
    const prevYear = () => setViewDate(v => ({ ...v, year: v.year - 1 }));
    const nextYear = () => setViewDate(v => ({ ...v, year: v.year + 1 }));
    const prevWeek = () => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
    const nextWeek = () => setWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
    const goToday = () => {
        setViewDate({ year: today.getFullYear(), month: today.getMonth() });
        const d = new Date(today); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0);
        setWeekStart(d);
    };

    const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

    return (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(160deg, #1a0533 0%, #0d2b3e 50%, #0a3d3a 100%)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* View toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-white/20">
                        {(['month', 'week', 'year'] as View[]).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-3 py-1 text-xs capitalize font-semibold transition
                                    ${view === v ? 'bg-purple-500 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                            >{v}</button>
                        ))}
                    </div>

                    {/* Navigation */}
                    {view === 'week' ? (() => {
                        const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
                        const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
                        const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
                        const label = sameMonth
                            ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}\u2013${weekEnd.getDate()}, ${weekStart.getFullYear()}`
                            : sameYear
                                ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} \u2013 ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
                                : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()} \u2013 ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
                        return (
                            <div className="flex items-center gap-2">
                                <button onClick={prevWeek} className="text-white/60 hover:text-white px-2 text-lg leading-none">‹</button>
                                <span className="text-white font-bold text-sm min-w-[180px] text-center">{label}</span>
                                <button onClick={nextWeek} className="text-white/60 hover:text-white px-2 text-lg leading-none">›</button>
                            </div>
                        );
                    })() : view !== 'year' ? (
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="text-white/60 hover:text-white px-2 text-lg leading-none">‹</button>
                            <span className="text-white font-bold text-sm min-w-[130px] text-center">
                                {MONTHS[viewDate.month]} {viewDate.year}
                            </span>
                            <button onClick={nextMonth} className="text-white/60 hover:text-white px-2 text-lg leading-none">›</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={prevYear} className="text-white/60 hover:text-white px-2 text-lg leading-none">‹</button>
                            <span className="text-white font-bold text-sm min-w-[60px] text-center">{viewDate.year}</span>
                            <button onClick={nextYear} className="text-white/60 hover:text-white px-2 text-lg leading-none">›</button>
                        </div>
                    )}

                    <button onClick={goToday} className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 rounded px-2 py-1">Today</button>
                </div>

                <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-white/50 text-sm">Loading…</div>
                ) : (
                    <>
                        {view === 'month' && (
                            <MonthGrid
                                viewDate={viewDate}
                                todayKey={todayKey}
                                eventsByDate={eventsByDate}
                                onNewEvent={openNewEvent}
                                onEditEvent={openEditEvent}
                            />
                        )}
                        {view === 'week' && (
                            <WeekGrid
                                weekStart={weekStart}
                                todayKey={todayKey}
                                eventsByDate={eventsByDate}
                                onNewEvent={openNewEvent}
                                onEditEvent={openEditEvent}
                            />
                        )}
                        {view === 'year' && (
                            <YearGrid
                                viewDate={viewDate}
                                todayKey={todayKey}
                                eventsByDate={eventsByDate}
                                onSelectMonth={m => { setViewDate(v => ({ ...v, month: m })); setView('month'); }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Event form overlay */}
            {editingDate && (
                <EventForm
                    editingDate={editingDate}
                    editingEvent={editingEvent}
                    form={form}
                    setForm={setForm}
                    saving={saving}
                    formRef={formRef}
                    onSave={saveEvent}
                    onClose={closeForm}
                    onDelete={deleteEvent}
                    onDeleteOccurrence={deleteOccurrence}
                />
            )}
        </div>
    );
};

export default CalendarModal;

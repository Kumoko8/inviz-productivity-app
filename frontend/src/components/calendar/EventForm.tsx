import React from 'react';
import { CalEvent, FormState, EVENT_COLORS, MONTHS, parseKey } from './calendarTypes';

type Props = {
    editingDate: string;
    editingEvent: CalEvent | null;
    form: FormState;
    setForm: React.Dispatch<React.SetStateAction<FormState>>;
    saving: boolean;
    formRef: React.RefObject<HTMLDivElement>;
    onSave: () => void;
    onClose: () => void;
    onDelete: (ev: CalEvent) => void;
    onDeleteOccurrence: (ev: CalEvent, dateKey: string) => void;
};

const EventForm: React.FC<Props> = ({
    editingDate, editingEvent, form, setForm, saving, formRef,
    onSave, onClose, onDelete, onDeleteOccurrence,
}) => {
    const { y, m, d } = parseKey(editingDate);
    const label = `${MONTHS[m]} ${d}, ${y}`;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                ref={formRef}
                className="bg-gradient-to-br from-[#2d1b4e] to-[#0e3a4a] border border-purple-500/40 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-white font-bold text-base mb-1">
                    {editingEvent ? 'Edit Event' : 'New Event'}
                </h3>
                <p className="text-purple-300 text-xs mb-4">{label}</p>

                <input
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 mb-3 focus:outline-none focus:border-purple-400"
                    placeholder="Event title"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
                    autoFocus
                />
                <input
                    type="time"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-purple-400"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                />

                {/* Duration */}
                <div className="flex gap-2 mb-3">
                    <input
                        type="number"
                        min="1"
                        placeholder="Duration"
                        className="w-28 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-400"
                        value={form.durationValue}
                        onChange={e => setForm(f => ({ ...f, durationValue: e.target.value }))}
                    />
                    <select
                        className="flex-1 bg-[#1a0533] border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
                        value={form.durationUnit}
                        onChange={e => setForm(f => ({ ...f, durationUnit: e.target.value }))}
                    >
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                    </select>
                </div>

                {/* Recurrence */}
                <select
                    className="w-full bg-[#1a0533] border border-white/20 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-purple-400"
                    value={form.recurrence}
                    onChange={e => setForm(f => ({ ...f, recurrence: e.target.value, recurrenceEnd: '' }))}
                >
                    <option value="">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>
                {form.recurrence && (
                    <div className="mb-3">
                        <label className="text-white/50 text-xs block mb-1">End date </label>
                        <input
                            type="date"
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
                            value={form.recurrenceEnd}
                            min={editingDate ?? undefined}
                            onChange={e => setForm(f => ({ ...f, recurrenceEnd: e.target.value }))}
                        />
                    </div>
                )}
                <textarea
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 mb-3 resize-none focus:outline-none focus:border-purple-400"
                    placeholder="Notes (optional)"
                    rows={2}
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />

                {/* Color picker */}
                <div className="flex gap-2 mb-4 flex-wrap">
                    {EVENT_COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setForm(f => ({ ...f, color: c }))}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-125' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>

                {/* Preview */}
                <div
                    className="text-xs rounded px-2 py-1 mb-4 font-medium truncate"
                    style={{ backgroundColor: form.color, color: '#111' }}
                >
                    {form.title || 'Preview'}
                </div>

                <div className="flex gap-2 justify-end flex-wrap">
                    {editingEvent && !editingEvent.recurrence && (
                        <button
                            onClick={() => onDelete(editingEvent)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-red-500/80 text-white hover:bg-red-600"
                        >Delete</button>
                    )}
                    {editingEvent && editingEvent.recurrence && (
                        <>
                            <button
                                onClick={() => onDeleteOccurrence(editingEvent, editingDate)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-red-400/80 text-white hover:bg-red-500"
                                title="Remove only this date from the series"
                            >Delete this</button>
                            <button
                                onClick={() => onDelete(editingEvent)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-red-700/90 text-white hover:bg-red-800"
                                title="Remove the entire repeating series"
                            >Delete all</button>
                        </>
                    )}
                    <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-white/20 text-white hover:bg-white/10">
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={saving || !form.title.trim()}
                        className="px-4 py-1.5 text-xs rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50"
                    >{saving ? 'Saving…' : editingEvent ? 'Update' : 'Add'}</button>
                </div>
            </div>
        </div>
    );
};

export default EventForm;

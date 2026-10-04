import React, { useState } from 'react';

interface Props {
    onAdd: (text: string) => void;
}

export const AddPrayerRequestForm: React.FC<Props> = ({ onAdd }) => {
    const [newText, setNewText] = useState('');

    const submit = () => {
        const trimmed = newText.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setNewText('');
    };

    return (
        <div className="flex-shrink-0 border-t border-white/10 px-2 py-2">
            <div className="flex gap-1.5">
                <input
                    value={newText}
                    onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    placeholder="New prayer request…"
                    className="flex-1 min-w-0 bg-white/5 text-white/70 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25 transition-colors"
                />
                <button
                    onClick={submit}
                    disabled={!newText.trim()}
                    className="text-white/50 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30 text-base leading-none"
                >
                    ＋
                </button>
            </div>
        </div>
    );
};

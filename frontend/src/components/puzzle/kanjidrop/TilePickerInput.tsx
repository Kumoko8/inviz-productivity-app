import React, { useState } from 'react';
import { RUNTIME_TILES, lookupTile } from './kanjiDropTypes';

type Props = {
    value: string;
    onChange: (id: string) => void;
    placeholder: string;
};

const TilePickerInput: React.FC<Props> = ({ value, onChange, placeholder }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const selected = value ? lookupTile(value) : null;

    const results = React.useMemo(() => {
        if (!open) return [];
        const q = query.toLowerCase();
        return Object.values(RUNTIME_TILES)
            .filter(t => !q || t.meaning.toLowerCase().includes(q) || t.char.includes(q) || t.id.includes(q))
            .sort((a, b) => a.tier - b.tier || a.meaning.localeCompare(b.meaning))
            .slice(0, 30);
    }, [open, query]);

    if (selected && !open) {
        return (
            <button
                type="button"
                className="flex items-center gap-1 w-full px-1.5 py-0.5 rounded border border-gray-600 hover:border-gray-500 text-left"
                onClick={() => { onChange(''); setQuery(''); setOpen(true); }}
            >
                <span className="font-bold leading-none flex-shrink-0"
                    style={{ background: selected.color, color: selected.textColor, fontFamily: 'serif', fontSize: 12, padding: '1px 4px', borderRadius: 4 }}>
                    {selected.char}
                </span>
                <span className="text-xs text-gray-300 truncate flex-1">{selected.meaning}</span>
                <span className="text-gray-600 hover:text-red-400 flex-shrink-0 text-xs">×</span>
            </button>
        );
    }

    return (
        <div className="relative">
            <input
                autoFocus={open}
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                className="w-full text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded border border-gray-600 outline-none focus:border-purple-500"
            />
            {open && results.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-0.5 bg-gray-900 border border-gray-700 rounded shadow-xl max-h-36 overflow-y-auto">
                    {results.map(t => (
                        <div key={t.id}
                            className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-800 cursor-pointer"
                            onMouseDown={() => { onChange(t.id); setQuery(''); setOpen(false); }}
                        >
                            <span className="font-bold flex-shrink-0"
                                style={{ background: t.color, color: t.textColor, fontFamily: 'serif', fontSize: 11, padding: '1px 3px', borderRadius: 3 }}>
                                {t.char}
                            </span>
                            <span className="text-xs text-gray-300 truncate">{t.meaning}</span>
                            <span className="text-xs text-gray-700 flex-shrink-0 ml-auto">t{t.tier}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TilePickerInput;

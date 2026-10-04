import React, { useMemo, useState } from 'react';
import PixelChest from './PixelChest';
import PixelSprite from './pixels/PixelSprite';
import type { Character } from '../types/character';
import { totalXpForLevel } from '../utils/xpUtils';

type Props = {
    selectedCharacter: Character | null;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<any> | void;
    controlsDisabled?: boolean;
};

// Default store items — prices can be overridden per-character via storePrices
const DEFAULT_ITEMS = [
    { id: 'pixel-chest', name: 'Pixel Chest', price: 250, icon: '/assets/store/chest.svg', description: 'Buy and open a chest to get a random Pixel Character!' },
    { id: 'sticker', name: 'Sticker', price: 150, icon: '/assets/store/sticker.svg', description: 'Stick it on your hand, journal, or water bottle!' },
    { id: 'tv', name: 'TV Time', price: 1000, icon: '/assets/store/tv.svg', description: 'Get one episode of TV time!' },
    { id: 'treat', name: 'Treat', price: 1000, icon: '/assets/store/treat.svg', description: 'A sweet treat to eat!' },
];


const XPStore: React.FC<Props> = ({ selectedCharacter, setUserCharacters, saveCharacter, controlsDisabled = false }) => {
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [editingPrices, setEditingPrices] = useState(false);
    const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

    // Merge default prices with any per-character overrides
    const ITEMS = useMemo(() => {
        const overrides = (selectedCharacter as any)?.storePrices ?? {};
        return DEFAULT_ITEMS.map(item => ({
            ...item,
            price: typeof overrides[item.id] === 'number' ? overrides[item.id] : item.price,
        }));
    }, [selectedCharacter]);

    const openEditPrices = () => {
        const seed: Record<string, string> = {};
        ITEMS.forEach(item => { seed[item.id] = String(item.price); });
        setDraftPrices(seed);
        setEditingPrices(true);
    };

    const savePrices = async () => {
        if (!selectedCharacter) return;
        const parsed: Record<string, number> = {};
        DEFAULT_ITEMS.forEach(item => {
            const v = parseInt(draftPrices[item.id] ?? '', 10);
            if (!isNaN(v) && v >= 0) parsed[item.id] = v;
        });
        const updated = { ...selectedCharacter, storePrices: parsed } as any;
        setUserCharacters((prev: any) => ({ ...prev, [selectedCharacter.id]: updated }));
        await saveCharacter(updated);
        setEditingPrices(false);
    };

    const totalXP = useMemo(() => {
        if (!selectedCharacter) return 0;
        // if character has an explicit spendable XP field, use it
        const currency = (selectedCharacter as any).currencyXp;
        if (typeof currency === 'number') return Math.max(0, Math.floor(currency));
        const level = selectedCharacter.level ?? 1;
        const xp = selectedCharacter.xp ?? 0;
        return totalXpForLevel(level, xp);
    }, [selectedCharacter]);

    const handlePurchase = async (item: any) => {
        if (!selectedCharacter) return;
        if (controlsDisabled) return;
        // If this is the pixel chest, we only open the chest modal here (no deduction yet)
        if (item.id === 'pixel-chest') {
            if (totalXP < item.price) {
                setError('Not enough XP');
                return;
            }
            setSelectedItem(item);
            setError(null);
            return;
        }

        if (totalXP < item.price) {
            setError('Not enough XP');
            return;
        }
        // Deduct from spendable currencyXp without touching level/xp for non-chest items
        const currentCurrency = typeof (selectedCharacter as any).currencyXp === 'number'
            ? Math.max(0, Math.floor((selectedCharacter as any).currencyXp))
            : totalXpForLevel(selectedCharacter.level ?? 1, selectedCharacter.xp ?? 0);
        const newCurrency = Math.max(0, currentCurrency - item.price);
        const updated = { ...selectedCharacter, currencyXp: newCurrency } as any;
        setUserCharacters(prev => ({ ...prev, [updated.id]: updated }));
        try {
            await saveCharacter(updated);
            // show confirmation toast once save completes
            const msg = `You purchased ${item.name}.`;
            setToastMessage(msg);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        } catch (e) { console.error(e); }

        setSelectedItem(null);
        setError(null);
    };

    if (!selectedCharacter) return null;

    return (
        <div className="bg-white rounded-lg shadow-md p-4 border mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold">XP Store</div>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">Total XP: <span className="font-medium text-cyan-700">{totalXP}</span></div>
                    <button
                        onClick={editingPrices ? () => setEditingPrices(false) : openEditPrices}
                        title={editingPrices ? 'Cancel' : 'Edit prices'}
                        className="text-gray-400 hover:text-gray-600 text-base leading-none transition-colors"
                    >
                        {editingPrices ? '✕' : '✏️'}
                    </button>
                </div>
            </div>

            {/* Price editor */}
            {editingPrices && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Set prices for this character</div>
                    <div className="grid grid-cols-2 gap-2">
                        {DEFAULT_ITEMS.map(item => (
                            <label key={item.id} className="flex items-center gap-2 text-sm">
                                <span className="w-20 truncate text-gray-700">{item.name}</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={draftPrices[item.id] ?? ''}
                                    onChange={e => setDraftPrices(p => ({ ...p, [item.id]: e.target.value }))}
                                    className="w-20 border border-gray-300 rounded px-2 py-0.5 text-sm text-right"
                                />
                                <span className="text-gray-400 text-xs">XP</span>
                            </label>
                        ))}
                    </div>
                    <button
                        onClick={savePrices}
                        className="mt-3 px-4 py-1 bg-emerald-500 text-white rounded text-sm font-medium hover:bg-emerald-600 transition-colors"
                    >
                        Save Prices
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {ITEMS.map(item => (
                    <div key={item.id} className="flex flex-col items-center text-center p-2 bg-gray-50 rounded cursor-pointer hover:shadow" onClick={() => setSelectedItem(item)}>
                        {/* placeholder pixel icon container */}
                        <div className="w-20 h-20 bg-white rounded-md overflow-hidden flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                            {item.id === 'pixel-chest' ? (
                                <div className="w-16 h-16 flex items-center justify-center">
                                    <PixelSprite id="unicorn" scale={2} fps={6} />
                                </div>
                            ) : (
                                // use <img> if asset available; fallback to colored box
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.icon} alt={item.name} className="w-16 h-16 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            )}
                        </div>
                        <div className="mt-2 text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-gray-600">{item.price} XP</div>
                    </div>
                ))}
            </div>

            {selectedItem && selectedItem.id !== 'pixel-chest' && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-lg font-semibold">{selectedItem.name}</div>
                            <div className="text-sm text-gray-600">{selectedItem.price} XP</div>
                        </div>
                        <div className="flex gap-4 mb-4">
                            <div className="w-24 h-24 bg-white rounded-md overflow-hidden flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                                <img src={selectedItem.icon} alt={selectedItem.name} className="w-20 h-20 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            <div className="text-sm text-gray-700">{selectedItem.description}</div>
                        </div>

                        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setSelectedItem(null)} className="px-3 py-1 bg-gray-200 rounded">Close</button>
                            <button onClick={() => handlePurchase(selectedItem)} className="px-3 py-1 bg-emerald-500 text-white rounded" disabled={controlsDisabled}>Purchase</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedItem && selectedItem.id === 'pixel-chest' && (
                <PixelChest
                    onClose={() => { setSelectedItem(null); }}
                    selectedCharacter={selectedCharacter}
                    setUserCharacters={setUserCharacters}
                    saveCharacter={saveCharacter}
                    price={selectedItem.price}
                />
            )}

            {/* Confirmation toast */}
            {showToast && toastMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto bg-indigo-600 text-white px-4 py-2 rounded shadow-lg">
                        {toastMessage}
                    </div>
                </div>
            )}
        </div>
    );
};

export default XPStore;

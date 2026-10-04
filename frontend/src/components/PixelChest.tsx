import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { writeUserCharacter, getUserCharacter } from '../services/characterService';
import { CHARACTER_POOL, PIXEL_CHARACTER_GROUPS, PixelCharacterGroup, buildWeightedPool, findCharacter } from './pixels/pixelRegistry';
import PixelSprite from './pixels/PixelSprite';
import { totalXpForLevel } from '../utils/xpUtils';

type Props = {
  onClose: () => void;
  selectedCharacter: any;
  setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  saveCharacter: (c: any) => Promise<any> | void;
  price?: number;
};

// Color-coded label for a pixel character's rarity tier.
const RARITY_STYLES: Record<string, string> = {
  common: 'bg-gray-200 text-gray-700',
  uncommon: 'bg-emerald-100 text-emerald-700',
  rare: 'bg-sky-100 text-sky-700',
  special: 'bg-amber-100 text-amber-700',
  miraculous: 'bg-violet-200 text-violet-800',
};


const PixelChest: React.FC<Props> = ({ onClose, selectedCharacter, setUserCharacters, saveCharacter, price = 0 }) => {
  const [opened, setOpened] = useState(false);
  const [awarded, setAwarded] = useState<string | null>(null);
  const [awardCountBefore, setAwardCountBefore] = useState<number | null>(null);
  const [showAwardProgress, setShowAwardProgress] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<PixelCharacterGroup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const spinTimer = useRef<number | null>(null);

  const { user } = useUser();

  useEffect(() => () => {
    if (spinTimer.current) window.clearInterval(spinTimer.current);
  }, []);

  const openChest = async (group: PixelCharacterGroup) => {
    if (animating) return;
    const availableIds = CHARACTER_POOL
      .filter(character => character.group === group)
      .map(character => character.id);

    const weighted = buildWeightedPool(availableIds);
    setSelectedGroup(group);
    setMessage(null);
    setAwarded(null);
    setAwardCountBefore(null);
    setShowAwardProgress(false);

    // deduct price immediately and persist before playing the animation
    try {
      const next = { ...selectedCharacter } as any;
      // determine current spendable currency
      const currentCurrency = typeof next.currencyXp === 'number'
        ? Math.max(0, Math.floor(next.currencyXp))
        : totalXpForLevel(next.level ?? 1, next.xp ?? 0);
      const newCurrency = Math.max(0, currentCurrency - (price || 0));
      next.currencyXp = newCurrency;
      // optimistic local update
      setUserCharacters(prev => ({ ...prev, [next.id]: next }));

      // attempt an atomic partial update on the server to avoid overwriting currency from other saves
      try {
        const uid = user?.uid ?? null;
        if (uid) {
          await writeUserCharacter(uid, next.id, { currencyXp: newCurrency });
          // refresh from server to avoid later stale overwrites
          try {
            const fresh = await getUserCharacter(uid, next.id);
            if (fresh) {
              const merged = { id: next.id, ...fresh } as any;
              setUserCharacters(prev => ({ ...prev, [next.id]: merged }));
            }
          } catch (e) {
            // ignore fetch errors
          }
        } else {
          // fallback: use provided saveCharacter if no uid available
          await saveCharacter(next);
        }
      } catch (e) {
        // fallback to generic saveCharacter if partial update fails
        try { await saveCharacter(next); } catch (err) { console.error('Failed fallback save for currencyXp', err); }
      }
    } catch (e) {
      console.error('Failed to deduct chest price', e);
    }

    setAnimating(true);
    setOpened(true);
    spinTimer.current = window.setInterval(() => {
      setAwarded(weighted[Math.floor(Math.random() * weighted.length)]);
    }, 90);

    // Spin through only the selected group's characters, including duplicates.
    await new Promise(res => setTimeout(res, 1000));
    if (spinTimer.current) {
      window.clearInterval(spinTimer.current);
      spinTimer.current = null;
    }

    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    setAwarded(pick);
    const pickInfo = findCharacter(pick);
    const pickIsMiraculous = pickInfo?.rarity === 'miraculous';
    const previousCount = (selectedCharacter.pixelCharacters || {})[pick] || 0;
    setAwardCountBefore(previousCount);
    window.requestAnimationFrame(() => setShowAwardProgress(true));

    // increment user's inventory for this character (miraculous stays unique at 1)
    try {
      const next = { ...selectedCharacter };
      next.pixelCharacters = { ...(next.pixelCharacters || {}) };
      next.pixelCharacters[pick] = pickIsMiraculous ? 1 : (next.pixelCharacters[pick] || 0) + 1;
      setUserCharacters(prev => ({ ...prev, [next.id]: next }));
      try {
        const uid = user?.uid ?? null;
        if (uid) {
          await writeUserCharacter(uid, next.id, { pixelCharacters: next.pixelCharacters });
          try {
            const fresh = await getUserCharacter(uid, next.id);
            if (fresh) {
              const merged = { id: next.id, ...fresh } as any;
              setUserCharacters(prev => ({ ...prev, [next.id]: merged }));
            }
          } catch (e) { /* ignore */ }
        } else {
          await saveCharacter(next);
        }
      } catch (e) {
        try { await saveCharacter(next); } catch (err) { console.error('Failed to save awarded pixel character', err); }
      }
    } catch (e) {
      console.error('Error selecting award', e);
    }

    // keep sparkle animation for a moment
    await new Promise(res => setTimeout(res, 1200));
    setAnimating(false);
  };

  const CharacterView: React.FC<{ id: string | null }> = ({ id }) => {
    if (!id) return null;
    const info = findCharacter(id);
    if (!info) return null;
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="bg-gray-300 rounded shadow" style={{ imageRendering: 'pixelated' }}>
          <PixelSprite id={info.id} scale={8} fps={6} />
        </div>
        <div className="text-sm font-semibold">{info.name}</div>
        <div className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${RARITY_STYLES[info.rarity] ?? RARITY_STYLES.common}`}>
          {info.rarity}
        </div>
      </div>
    );
  };

  const awardedProgress = awardCountBefore === null ? null : {
    before: Math.min(awardCountBefore, 10),
    after: Math.min(awardCountBefore + 1, 10),
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm text-center">
        <div className="text-lg font-semibold mb-3">Pixel Chest</div>
        {!opened && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-28 h-28 bg-yellow-600 rounded-md flex items-center justify-center transform transition-transform" style={{ boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.12)', position: 'relative' }}>
              <div className="w-16 h-12 bg-brown-700 rounded-sm" />
              {/* gold band with diamonds overlay */}
              <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translate(-50%, -50%)', width: '84%', height: 12, background: '#FFD700', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px', boxSizing: 'border-box' }}>
                <div style={{ width: 12, height: 12, background: '#4AA3FF', transform: 'rotate(45deg)', boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset' }} />
                <div style={{ position: 'relative', width: 20, height: 20 }}>
                  <div style={{ width: '100%', height: '100%', background: '#FF39C6', transform: 'rotate(45deg)', boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset', borderRadius: 2 }} />
                  {/* small white reflection at top-right */}
                  <div className="diamond-reflection diamond-sparkle" />
                </div>
                <div style={{ width: 12, height: 12, background: '#4AA3FF', transform: 'rotate(45deg)', boxShadow: '0 0 0 1px rgba(0,0,0,0.06) inset' }} />
              </div>
            </div>
            <div className="text-sm text-gray-700">Choose a character group to spin for a random Pixel Character.</div>
            {message && <div className="text-sm text-amber-700">{message}</div>}
            <div className="grid w-full grid-cols-3 gap-2">
              {(Object.entries(PIXEL_CHARACTER_GROUPS) as [PixelCharacterGroup, string][]).map(([group, label]) => (
                <button key={group} onClick={() => openChest(group)} disabled={animating} className="px-2 py-2 bg-amber-400 text-black rounded text-sm font-semibold hover:bg-amber-500 disabled:opacity-50">
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        )}

        {opened && (
          <div className="flex flex-col items-center gap-4 mt-5">
            <div className={`relative ${animating ? 'animate-pulse' : ''}`}>
              <div className="my-10 w-40 h-40 bg-black rounded flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                <CharacterView id={awarded} />
              </div>
              {/* sparkles */}
              {animating && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-sparkle" />
                  </div>
                </div>
              )}
            </div>

  

            {awardedProgress && findCharacter(awarded ?? '')?.rarity !== 'miraculous' && (
              <div className="w-full max-w-xs text-left">
                <div className="mb-1 flex justify-between text-xs text-gray-600">
                  <span>Level</span>
                  <span>{awardedProgress.after} / 10</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={awardedProgress.after}>
                  <div
                    className={`h-full transition-all duration-700 ease-out ${awardedProgress.after === 10 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${showAwardProgress ? awardedProgress.after * 10 : awardedProgress.before * 10}%` }}
                  />
                </div>
                {awardedProgress.after === 10 && <div className="mt-1 text-xs font-semibold text-amber-700">Ready to transform in your gallery.</div>}
              </div>
            )}

            <div className="my-7 flex gap-2">
              <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes sparkle { 0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 0 } }
          .animate-sparkle { width: 100%; height: 100%; background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.9) 0px, rgba(255,255,255,0) 6px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.8) 0px, rgba(255,255,255,0) 5px); animation: sparkle 1200ms ease-in-out; }

          /* diamond reflection sparkle */
          .diamond-reflection { position: absolute; top: 2px; right: 2px; width: 8px; height: 6px; background: rgba(255,255,255,0.95); transform: rotate(45deg); border-radius: 1px; pointer-events: none; }
          @keyframes diamond-sparkle { 0% { opacity: 0.45; transform: rotate(45deg) scale(1); } 50% { opacity: 1; transform: rotate(45deg) scale(1.25); } 100% { opacity: 0.45; transform: rotate(45deg) scale(1); } }
          .diamond-sparkle { animation: diamond-sparkle 900ms ease-in-out infinite; transform-origin: center; }
        `}</style>
      </div>
    </div>
  );
};

export default PixelChest;

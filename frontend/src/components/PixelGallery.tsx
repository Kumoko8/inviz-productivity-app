import React, { useState, useEffect } from 'react';
import ToggleArrow from './ToggleArrow';
import { findCharacter, findPixelTransformTargets } from './pixels/pixelRegistry';
import PixelSprite from './pixels/PixelSprite';

type Props = {
  selectedCharacter: any | null;
  onTransform: (sourceId: string, targetId: string) => Promise<void>;
};

const DUPLICATES_PER_TRANSFORM = 10;

// Color-coded label for a pixel character's rarity tier (matches PixelChest).
const RARITY_STYLES: Record<string, string> = {
  common: 'bg-gray-200 text-gray-700',
  uncommon: 'bg-emerald-100 text-emerald-700',
  rare: 'bg-sky-100 text-sky-700',
  special: 'bg-amber-100 text-amber-700',
  miraculous: 'bg-violet-200 text-violet-800',
};

type PixelTransformation = {
  sourceId: string;
  targetId: string;
  phase: 'source' | 'transforming' | 'result' | 'complete';
};

const PixelGallery: React.FC<Props> = ({ selectedCharacter, onTransform }) => {
  const [open, setOpen] = useState(false);
  const [transformingId, setTransformingId] = useState<string | null>(null);
  const [pixelTransformation, setPixelTransformation] = useState<PixelTransformation | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w < 420) return 2;
    if (w < 640) return 3;
    if (w < 900) return 4;
    return 6;
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 420) setScale(2);
      else if (w < 640) setScale(3);
      else if (w < 900) setScale(4);
      else setScale(6);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!selectedCharacter) return null;

  const owned = selectedCharacter.pixelCharacters || {};
  // build an ordered list of owned character ids
  const ownedIds = Object.keys(owned).filter(id => (owned as any)[id] > 0);

  const transformCharacter = async (id: string) => {
    const source = findCharacter(id);
    // Pass ownership so already-owned miraculous characters aren't offered again.
    const targets = source ? findPixelTransformTargets(source, owned) : [];
    if (!source || targets.length === 0 || (owned[id] || 0) < DUPLICATES_PER_TRANSFORM) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    setTransformingId(id);
    setTransformError(null);
    setPixelTransformation({ sourceId: source.id, targetId: target.id, phase: 'source' });
    try {
      await new Promise(resolve => window.setTimeout(resolve, 800));
      setPixelTransformation({ sourceId: source.id, targetId: target.id, phase: 'transforming' });
      await new Promise(resolve => window.setTimeout(resolve, 900));
      setPixelTransformation({ sourceId: source.id, targetId: target.id, phase: 'result' });
      await onTransform(id, target.id);
      setPixelTransformation({ sourceId: source.id, targetId: target.id, phase: 'complete' });
    } catch (error) {
      console.error('Failed to transform pixel character', error);
      setTransformError('Could not transform this character. Please try again.');
      setPixelTransformation(null);
    } finally {
      setTransformingId(null);
    }
  };

  const sourceInfo = pixelTransformation ? findCharacter(pixelTransformation.sourceId) : null;
  const targetInfo = pixelTransformation ? findCharacter(pixelTransformation.targetId) : null;

  return (
    <div className="w-full max-w-md mx-auto my-4">
      <div className="flex items-center justify-between bg-white border rounded px-3 py-2 shadow-sm">
        <div className="font-semibold">Pixel Gallery</div>
        <button
          onClick={() => setOpen(prev => !prev)}
          aria-label={open ? 'Hide Pixel Gallery' : `Show Pixel Gallery (${ownedIds.length})`}
          className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
        >
          <ToggleArrow open={open} size={18} />
        </button>
      </div>

      {open && (
        <div className="mt-3 bg-white border rounded p-3 grid grid-cols-2 gap-3">
          {ownedIds.length === 0 && (
            <div className="col-span-2 text-sm text-gray-600">You don't have any Pixel Characters yet. Open a Pixel Chest to earn them.</div>
          )}

          {transformError && <div className="col-span-2 text-sm text-red-600">{transformError}</div>}

          {ownedIds.map(id => {
            const info = findCharacter(id) || { id, name: id, rarity: 'common' } as any;
            const count = (owned as any)[id] || 0;
            const canTransform = info.rarity !== 'miraculous' && count >= DUPLICATES_PER_TRANSFORM && findPixelTransformTargets(info, owned).length > 0;
            const progress = Math.min(count, DUPLICATES_PER_TRANSFORM) / DUPLICATES_PER_TRANSFORM * 100;
            return (
              <div key={id} className={`flex flex-col items-center p-2 bg-gray-50 rounded border ${canTransform ? 'border-amber-400 ring-2 ring-amber-200' : 'border-transparent'}`}>
                <div className="bg-gray-300 rounded p-2 mb-2 flex items-center justify-center overflow-hidden" style={{ imageRendering: 'pixelated' }}>
                  <PixelSprite id={info.id} scale={scale} fps={6} />
                </div>
                <div className="text-sm font-semibold">{info.name}</div>
                <div className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${RARITY_STYLES[info.rarity] ?? RARITY_STYLES.common}`}>{info.rarity}</div>
                {info.rarity !== 'miraculous' && (
                  <div className="w-full mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Level</span>
                      <span>{Math.min(count, DUPLICATES_PER_TRANSFORM)} / {DUPLICATES_PER_TRANSFORM}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={DUPLICATES_PER_TRANSFORM} aria-valuenow={Math.min(count, DUPLICATES_PER_TRANSFORM)}>
                      <div className={`h-full ${canTransform ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
                {canTransform && (
                  <button onClick={() => transformCharacter(id)} disabled={transformingId !== null} className="mt-2 px-3 py-1 text-xs font-semibold rounded bg-amber-400 text-black hover:bg-amber-500 disabled:opacity-50">
                    {transformingId === id ? 'Transforming...' : 'Transform'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pixelTransformation && sourceInfo && targetInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4" role="dialog" aria-modal="true" aria-label="Pixel character transformation">
          <div className="w-full max-w-sm rounded-lg border-2 border-amber-300 bg-white p-6 text-center shadow-2xl">
            <div className="text-lg font-semibold">Pixel Character Transform</div>
            <div className="mt-1 text-sm text-gray-600">
              {pixelTransformation.phase === 'source' && `${sourceInfo.name} is ready to transform.`}
              {pixelTransformation.phase === 'transforming' && `${sourceInfo.name} is transforming...`}
              {(pixelTransformation.phase === 'result' || pixelTransformation.phase === 'complete') && `${sourceInfo.name} transformed into ${targetInfo.name}!`}
            </div>

            <div className="relative mt-6 flex min-h-48 items-center justify-center overflow-hidden rounded bg-slate-900">
              {pixelTransformation.phase === 'source' && sourceInfo && (
                <div className="pixel-transform-source">
                  <PixelSprite id={sourceInfo.id} scale={7} fps={6} />
                </div>
              )}
              {pixelTransformation.phase === 'transforming' && sourceInfo && (
                <div className="pixel-transform-source pixel-transforming">
                  <PixelSprite id={sourceInfo.id} scale={7} fps={6} />
                </div>
              )}
              {(pixelTransformation.phase === 'result' || pixelTransformation.phase === 'complete') && targetInfo && (
                <div className="pixel-transform-result">
                  <PixelSprite id={targetInfo.id} scale={7} fps={6} />
                </div>
              )}
              {pixelTransformation.phase === 'transforming' && <div className="pixel-transform-flash" />}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <span className="rounded bg-gray-100 px-2 py-1 capitalize">{sourceInfo.rarity}</span>
              <span className="font-semibold text-amber-600">to</span>
              <span className="rounded bg-amber-100 px-2 py-1 capitalize">{targetInfo.rarity}</span>
            </div>

            {pixelTransformation.phase === 'complete' && (
              <button onClick={() => setPixelTransformation(null)} className="mt-5 rounded bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-500">
                Continue
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pixel-transform-source {
          0% { opacity: 1; transform: scale(1); }
          45% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0; transform: scale(0.35); }
        }
        @keyframes pixel-transform-result {
          0% { opacity: 0; transform: scale(0.45); }
          65% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pixel-transform-flash {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .pixel-transform-source { image-rendering: pixelated; }
        .pixel-transforming { animation: pixel-transform-source 900ms ease-in forwards; }
        .pixel-transform-result { animation: pixel-transform-result 500ms ease-out; image-rendering: pixelated; }
        .pixel-transform-flash { position: absolute; inset: 0; background: #fef3c7; animation: pixel-transform-flash 900ms ease-in-out; }
      `}</style>
    </div>
  );
};

export default PixelGallery;

import React, { useRef, useState, useEffect } from 'react';

type Props = {
  onArchive?: () => void;
  onPrioritize?: () => void;
  onColorChange?: (color: string) => void;
  onToggleNote?: () => void;
  onDuplicate?: () => void;
  disabled?: boolean;
  // optional ref to the trigger button so menu can position relative to it
  buttonRef?: React.RefObject<HTMLElement>;
  skillName?: string;
  canArchive?: boolean;
};

const SkillMenu: React.FC<Props> = ({ onArchive, onPrioritize, onColorChange, onToggleNote, onDuplicate, disabled = false, buttonRef, skillName, canArchive }) => {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const colorRef = useRef<HTMLInputElement | null>(null);
  const internalBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const triggerRef = buttonRef ? buttonRef : internalBtnRef;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!open) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (triggerRef && (triggerRef as any).current && (triggerRef as any).current.contains && (triggerRef as any).current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [open, triggerRef]);

  // compute floating style based on trigger rect (use left so menu doesn't go off-screen)
  const computeStyle = (): React.CSSProperties => {
    try {
      const el = (triggerRef as any).current as HTMLElement | null;
      if (!el) return { position: 'fixed', right: '12px', top: '12px', zIndex: 9999 };
      const r = el.getBoundingClientRect();
      // r.bottom is already viewport-relative; for fixed positioning use it directly
      const top = r.bottom + 6;
      const menuWidth = 220;
      let left = r.left;
      // clamp so the menu stays visible
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      return { position: 'fixed', top: `${top}px`, left: `${left}px`, zIndex: 9999 };
    } catch (err) {
      return { position: 'fixed', right: '12px', top: '12px', zIndex: 9999 };
    }
  };

  return (
    <div className="relative">
      <button
        ref={internalBtnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-2 rounded hover:bg-gray-100"
        aria-label="Skill menu"
        disabled={disabled}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div ref={menuRef} style={computeStyle()} className="w-40 bg-white border rounded shadow z-50" onClick={(e) => e.stopPropagation()}>
          {/* <button
            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${lastClicked === 'archive' ? 'bg-blue-700 text-white shadow-md transform scale-105 transition' : ''}`}
            onClick={() => {
              if (disabled) return;
              // if caller indicates archiving is not allowed (incomplete), call onArchive immediately so parent can show error
              if (typeof (canArchive) !== 'undefined' && !canArchive) {
                if (onArchive) onArchive();
                return;
              }
              // open confirmation overlay instead of immediately archiving
              setConfirmOpen(true);
            }}
          >
            Archive
          </button> */}
          <button
            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${lastClicked === 'note' ? 'bg-blue-700 text-white shadow-md transform scale-105 transition' : ''}`}
            onClick={() => {
              if (disabled) return;
              setLastClicked('note');
              if (onToggleNote) onToggleNote();
              window.setTimeout(() => { setLastClicked(null); setOpen(false); }, 180);
            }}
          >
            Note
          </button>
          <button
            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${lastClicked === 'prioritize' ? 'bg-blue-700 text-white shadow-md transform scale-105 transition' : ''}`}
            onClick={() => {
              if (disabled) return;
              setLastClicked('prioritize');
              if (onPrioritize) onPrioritize();
              window.setTimeout(() => { setLastClicked(null); setOpen(false); }, 180);
            }}
          >
            Prioritize
          </button>
          <button
            className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${lastClicked === 'duplicate' ? 'bg-blue-700 text-white shadow-md transform scale-105 transition' : ''}`}
            onClick={() => {
              if (disabled) return;
              setLastClicked('duplicate');
              if (onDuplicate) onDuplicate();
              window.setTimeout(() => { setLastClicked(null); setOpen(false); }, 180);
            }}
          >
            Duplicate
          </button>
          {/* conversion options removed — feature deprecated */}
          <div className="w-full px-3 py-2 border-t">
            <label className="text-sm text-gray-700">Color</label>
            <div className="flex items-center gap-2 mt-2">
              <input ref={colorRef} type="color" defaultValue="#bde0fe" />
              <button
                className={`px-2 py-1 ${lastClicked === 'color' ? 'bg-blue-700 text-white shadow-md transform scale-105 transition' : 'bg-gray-100'} rounded`}
                onClick={() => {
                  if (disabled) return;
                  if (colorRef.current && onColorChange) onColorChange(colorRef.current.value);
                  setLastClicked('color');
                  window.setTimeout(() => { setLastClicked(null); setOpen(false); }, 180);
                }}
              >
                Set
              </button>
            </div>
          </div>
        </div>
      )}
      {/* {confirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 200000 }} onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded-lg p-6 shadow-lg w-[90%] max-w-sm" style={{ zIndex: 200001 }} onClick={(e) => e.stopPropagation()}>
            <div className="text-center text-lg font-semibold mb-4">Archive "{skillName ?? 'this skill'}"?</div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={() => {
                setConfirmOpen(false);
                setOpen(false);
                setLastClicked('archive');
                if (onArchive) onArchive();
                window.setTimeout(() => { setLastClicked(null); }, 180);
              }} className="px-4 py-2 bg-red-600 text-white rounded">Archive</button>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default SkillMenu;

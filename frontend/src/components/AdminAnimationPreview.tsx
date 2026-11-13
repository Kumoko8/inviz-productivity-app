import React, { useEffect, useRef, useState } from "react";
import { characterData } from "./CharacterData";
import { fetchAnimUrl } from "../utils/storageUtils";
import AdminCharacterFieldEditor from "./AdminCharacterFieldEditor";
import type { CharacterDocumentTarget } from "../services/adminCharacterFields";

type PreviewCharacter = { id: string; name?: string; playerName?: string; [key: string]: unknown };
type Props = {
    characters: PreviewCharacter[];
    customCharacters: PreviewCharacter[];
    uid: string;
    onFieldSaved: (target: CharacterDocumentTarget, field: string, value: unknown) => void;
};

const CATEGORIES: { key: string; label: string }[] = [
    { key: "transformAnimations", label: "Form" },
    { key: "transformTempAnimations", label: "Transform" },
    { key: "actionAnimations", label: "Action" },
    { key: "woundedAnimations", label: "Wounded" },
    { key: "damageAnimations", label: "Damage" },
    { key: "defeatAnimations", label: "Defeat" },
];

const Cell: React.FC<{ path?: string; index: number }> = ({ path, index }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        let alive = true;
        setUrl(null);
        if (path) fetchAnimUrl(path).then(u => { if (alive) setUrl(u || ""); });
        return () => { alive = false; };
    }, [path]);
    const toggle = () => {
        const v = videoRef.current;
        if (!v) return;
        if (playing) {
            v.pause();
            v.currentTime = 0;
            setPlaying(false);
        } else {
            v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        }
    };
    return (
        <div className="flex flex-col items-center">
            <div onClick={toggle} className="relative w-full aspect-square bg-gray-100 border rounded overflow-hidden flex items-center justify-center cursor-pointer">
                {url ? (
                    <video ref={videoRef} src={url} muted loop playsInline preload="metadata" className="w-full h-full object-contain" />
                ) : null}
                {url && !playing && <span className="absolute text-white bg-black/50 rounded-full w-6 h-6 flex items-center justify-center text-xs pointer-events-none">▶</span>}
            </div>
            <span className="text-[10px] text-gray-500">{index + 1}</span>
        </div>
    );
};

const AdminAnimationPreview: React.FC<Props> = ({ characters, customCharacters, uid, onFieldSaved }) => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [category, setCategory] = useState<string | null>(null);

    const options = [
        ...characters.map(character => ({ key: `base:${character.id}`, character, target: { kind: "base" as const, id: character.id } })),
        ...customCharacters.map(character => ({ key: `custom:${character.id}`, character, target: { kind: "custom" as const, uid, id: character.id } })),
    ];
    const selected = options.find(option => option.key === selectedKey);
    const char = selected?.character;
    const merged = (key: string): string[] => {
        const a = char?.[key];
        const fallback = characterData.find(c => c.name === char?.name);
        const b = fallback?.[key as keyof typeof fallback];
        if (Array.isArray(a)) return a.map(value => typeof value === "string" ? value : "");
        return Array.isArray(b) ? b.map(value => typeof value === "string" ? value : "") : [];
    };
    const paths = category ? merged(category) : [];
    const count = Math.max(paths.length, 7);

    const btn = (active: boolean) =>
        `px-2 py-1 text-sm rounded border ${active ? "bg-blue-500 text-white" : "bg-white hover:bg-gray-100"}`;

    return (
        <div className="col-span-3 border-t pt-3 mt-2">
            <div className="font-semibold text-center mb-2">Animation Preview (admin)</div>
            <div className="flex flex-wrap gap-2 justify-center mb-2">
                {options.map(option => (
                    <button key={option.key} className={btn(option.key === selectedKey)} onClick={() => { setSelectedKey(option.key === selectedKey ? null : option.key); setCategory(null); }}>
                        {option.character.playerName || option.character.name || option.character.id} ({option.target.kind})
                    </button>
                ))}
            </div>
            {selected && (
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                    {CATEGORIES.map(c => (
                        <button key={c.key} className={btn(c.key === category)} onClick={() => setCategory(c.key === category ? null : c.key)}>{c.label}</button>
                    ))}
                </div>
            )}
            {selected && category && (
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: count }, (_, i) => (
                        <Cell key={`${selectedKey}-${category}-${i}`} path={paths[i]} index={i} />
                    ))}
                </div>
            )}
            {selected && <AdminCharacterFieldEditor
                key={selected.key}
                target={selected.target}
                previewValues={{ ...selected.character, ...Object.fromEntries(CATEGORIES.map(item => [item.key, merged(item.key)])) }}
                onSaved={onFieldSaved}
            />}
        </div>
    );
};

export default AdminAnimationPreview;

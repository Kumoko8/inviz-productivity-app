import React, { useEffect, useRef, useState } from "react";
import { characterData } from "./CharacterData";
import { fetchAnimUrl } from "../utils/storageUtils";

type Props = { characters: any[] };

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

const AdminAnimationPreview: React.FC<Props> = ({ characters }) => {
    const [charName, setCharName] = useState<string | null>(null);
    const [category, setCategory] = useState<string | null>(null);

    const names = (characters.length ? characters : characterData).map((c: any) => c.name as string);
    const find = (n: string) =>
        characters.find((c: any) => c.name === n) || characterData.find(c => c.name === n);

    const char: any = charName ? find(charName) : null;
    const merged = (key: string): string[] => {
        const a = (char?.[key] as string[]) || [];
        const b = ((characterData.find(c => c.name === charName) as any)?.[key] as string[]) || [];
        return a.length ? a : b;
    };
    const paths = category ? merged(category) : [];
    const count = Math.max(paths.length, 7);

    const btn = (active: boolean) =>
        `px-2 py-1 text-sm rounded border ${active ? "bg-blue-500 text-white" : "bg-white hover:bg-gray-100"}`;

    return (
        <div className="col-span-3 border-t pt-3 mt-2">
            <div className="font-semibold text-center mb-2">Animation Preview (admin)</div>
            <div className="flex flex-wrap gap-2 justify-center mb-2">
                {names.map(n => (
                    <button key={n} className={btn(n === charName)} onClick={() => { setCharName(n === charName ? null : n); setCategory(null); }}>{n}</button>
                ))}
            </div>
            {charName && (
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                    {CATEGORIES.map(c => (
                        <button key={c.key} className={btn(c.key === category)} onClick={() => setCategory(c.key === category ? null : c.key)}>{c.label}</button>
                    ))}
                </div>
            )}
            {charName && category && (
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: count }, (_, i) => (
                        <Cell key={`${charName}-${category}-${i}`} path={paths[i]} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminAnimationPreview;

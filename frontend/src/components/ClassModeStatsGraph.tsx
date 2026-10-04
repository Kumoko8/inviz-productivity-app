import React, { useState } from "react";

interface SubDatum {
    id: string;
    label: string;
    pct: number;
    subs?: SubDatum[];
}

interface SkillDatum extends SubDatum {}

interface CharDatum {
    id: string;
    name: string;
    skills: SkillDatum[];
}

interface Props {
    characters: any[];
    userCharacters: Record<string, any>;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    onClose: () => void;
}

const getBarColor = (p: number) => {
    if (p < 30) return '#8b0000';
    if (p < 50) return '#ff0000';
    if (p < 65) return '#ff8c00';
    if (p < 80) return '#ffd700';
    if (p < 90) return '#22c55e';
    return '#06b6d4';
};

// recursively averages a skill/subskill's own progress with its children's
const computeAverage = (node: any): number => {
    if (!node) return 0;
    if (!node.subskills || node.subskills.length === 0) return Math.max(0, Math.min(100, Math.round(node.progress ?? 0)));
    const vals: number[] = node.subskills.map((s: any) => computeAverage(s));
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

// recursively builds a subskill (and its nested subskills, to any depth) into graph data
const buildSubs = (nodes: any[]): SubDatum[] =>
    (nodes ?? []).map((n: any) => ({
        id: n.id,
        label: n.name || 'Subskill',
        pct: computeAverage(n),
        subs: buildSubs(n.subskills ?? []),
    }));

const buildSkills = (uc: any): SkillDatum[] => {
    const skills: any[] = uc?.skills ?? [];
    return skills.map((skill) => ({
        id: skill.id,
        label: skill.name || 'Skill',
        pct: computeAverage(skill),
        subs: buildSubs(skill.subskills ?? []),
    }));
};

// merges same-named nodes (by label) across characters, recursing into their children
const aggregateSubNodes = (nodesList: SubDatum[][]): SubDatum[] => {
    const map = new Map<string, { label: string; vals: number[]; childrenList: SubDatum[][] }>();
    for (const nodes of nodesList) {
        for (const node of nodes) {
            const key = node.label.toLowerCase();
            if (!map.has(key)) map.set(key, { label: node.label, vals: [], childrenList: [] });
            const entry = map.get(key)!;
            entry.vals.push(node.pct);
            entry.childrenList.push(node.subs ?? []);
        }
    }
    return Array.from(map.entries()).map(([key, entry]) => ({
        id: key,
        label: entry.label,
        pct: Math.round(entry.vals.reduce((a, b) => a + b, 0) / entry.vals.length),
        subs: aggregateSubNodes(entry.childrenList),
    }));
};

const Bar: React.FC<{ label: string; pct: number; onClick?: () => void }> = ({ label, pct, onClick }) => (
    <div
        className={`flex flex-col items-center justify-end h-full w-6 ${onClick ? 'cursor-pointer' : ''}`}
        title={`${label}: ${pct}%`}
        onClick={onClick}
    >
        <div className="text-[10px] text-white/70 mb-1">{pct}%</div>
        <div className="w-4 rounded-t transition-all" style={{ height: `${Math.max(2, pct)}%`, background: getBarColor(pct) }} />
        <div className="text-[9px] text-white/50 mt-1 w-6 text-center break-words leading-tight">
            {label.length > 10 ? `${label.slice(0, 9)}…` : label}
        </div>
    </div>
);

// Renders a bar for `node`, and — if expanded and it has its own subskills — recurses
// to render those as sibling bars with a labeled bracket underneath, to any depth.
const SkillBranch: React.FC<{
    node: SubDatum;
    path: string[];
    expanded: Record<string, boolean>;
    toggle: (key: string) => void;
}> = ({ node, path, expanded, toggle }) => {
    const key = path.join('/');
    const subs = node.subs ?? [];
    const hasSubs = subs.length > 0;
    const isOpen = hasSubs && !!expanded[key];
    return (
        <div className="flex flex-col items-center justify-end h-full">
            <div className="flex items-end gap-1.5 flex-1">
                <Bar label={node.label} pct={node.pct} onClick={hasSubs ? () => toggle(key) : undefined} />
                {isOpen && subs.map((sub) => (
                    <SkillBranch key={sub.id} node={sub} path={[...path, sub.id]} expanded={expanded} toggle={toggle} />
                ))}
            </div>
            {isOpen && (
                <div className="relative w-full mt-1 border-t border-white/40">
                    <div className="absolute left-0 top-0 w-px h-1.5 bg-white/40" />
                    <div className="absolute right-0 top-0 w-px h-1.5 bg-white/40" />
                    <div className="text-center text-[9px] text-white/60 mt-1.5 whitespace-nowrap">{node.label}</div>
                </div>
            )}
        </div>
    );
};

// Breakdown row used inside the skill-detail modal's per-character subskill list.
// Leaf nodes (no children) are editable; nodes with subskills stay auto-computed from their children.
const SkillDetailNode: React.FC<{
    node: SubDatum;
    charId: string;
    idPath: string[];
    depth: number;
    expanded: Record<string, boolean>;
    toggle: (key: string) => void;
    scoreInputs: Record<string, string>;
    setScoreInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    onCommit: (charId: string, idPath: string[], value: number) => void;
}> = ({ node, charId, idPath, depth, expanded, toggle, scoreInputs, setScoreInputs, onCommit }) => {
    const key = `${charId}/${idPath.join('/')}`;
    const subs = node.subs ?? [];
    const hasSubs = subs.length > 0;
    const isOpen = hasSubs && !!expanded[key];
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3" style={{ paddingLeft: depth * 16 }}>
                <span className="text-white/80 text-xs flex-1 truncate">↳ {node.label}</span>
                <button
                    type="button"
                    onClick={hasSubs ? () => toggle(key) : undefined}
                    disabled={!hasSubs}
                    title={hasSubs ? 'Click to view subskills' : undefined}
                    className={`w-20 h-2 bg-gray-700 rounded overflow-hidden flex-shrink-0 ${hasSubs ? 'cursor-pointer' : 'cursor-default'}`}
                >
                    <div className="h-2" style={{ width: `${node.pct}%`, background: getBarColor(node.pct) }} />
                </button>
                {hasSubs ? (
                    <span className="text-gray-500 text-xs w-14 text-right flex-shrink-0" title="Has subskills — edit the individual subskills to change this">
                        {node.pct}% (auto)
                    </span>
                ) : (
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreInputs[key] ?? String(node.pct)}
                        onChange={(e) => setScoreInputs(prev => ({ ...prev, [key]: e.target.value }))}
                        onBlur={(e) => {
                            const v = Math.max(0, Math.min(100, Math.round(parseFloat(e.target.value) || 0)));
                            onCommit(charId, idPath, v);
                            setScoreInputs(prev => { const next = { ...prev }; delete next[key]; return next; });
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-14 bg-gray-800 text-white text-right rounded px-1.5 py-0.5 text-xs flex-shrink-0"
                        aria-label={`${node.label} score`}
                    />
                )}
            </div>
            {isOpen && subs.map((sub) => (
                <SkillDetailNode
                    key={sub.id}
                    node={sub}
                    charId={charId}
                    idPath={[...idPath, sub.id]}
                    depth={depth + 1}
                    expanded={expanded}
                    toggle={toggle}
                    scoreInputs={scoreInputs}
                    setScoreInputs={setScoreInputs}
                    onCommit={onCommit}
                />
            ))}
        </div>
    );
};

const ClassModeStatsGraph: React.FC<Props> = ({ characters, userCharacters, setUserCharacters, saveCharacter, onClose }) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [excludedNames, setExcludedNames] = useState<Set<string>>(new Set());
    const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [focusedCharId, setFocusedCharId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [isolatedSkillName, setIsolatedSkillName] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'character' | 'skill'>('skill');
    const [skillDetailName, setSkillDetailName] = useState<string | null>(null);
    const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
    const [detailExpanded, setDetailExpanded] = useState<Record<string, boolean>>({});
    const toastTimeout = React.useRef<number | null>(null);


    const allData: CharDatum[] = (characters || []).map((c: any) => {
        const uc = userCharacters[c.id] ?? c;
        return {
            id: c.id,
            name: (userCharacters[c.id] && (userCharacters[c.id].playerName || userCharacters[c.id].name)) || c.name || c.id,
            skills: buildSkills(uc),
        };
    });

    const data: CharDatum[] = viewMode === 'skill'
        ? (() => {
            const commonNames = isolatedSkillName
                ? new Set(allData.flatMap(char => char.skills)
                    .filter(skill => skill.label.toLowerCase() === isolatedSkillName.toLowerCase())
                    .map(skill => skill.label.toLowerCase()))
                : allData.length === 0 ? new Set<string>() : allData.reduce((common, char, idx) => {
                    const names = new Set(char.skills.map(s => s.label.toLowerCase()));
                    if (idx === 0) return names;
                    return new Set([...common].filter(n => names.has(n)));
                }, new Set<string>());
            return Array.from(commonNames)
                .filter(nameLower => !excludedNames.has(nameLower))
                .map(nameLower => {
                    const entries = allData
                        .map(char => char.skills.find(s => s.label.toLowerCase() === nameLower))
                        .filter(Boolean) as SkillDatum[];
                    const label = entries[0]?.label ?? nameLower;
                    const pct = Math.round(entries.reduce((sum, e) => sum + e.pct, 0) / entries.length);
                    const subs = aggregateSubNodes(entries.map(e => e.subs ?? []));
                    return { id: nameLower, label, pct, subs };
                })
                .sort((a, b) => a.label.localeCompare(b.label))
                .map(skill => ({ id: skill.id, name: skill.label, skills: [skill] }));
        })()
        : allData
            .filter(char => !focusedCharId || char.id === focusedCharId)
            .map(char => ({
                ...char,
                skills: char.skills.filter(skill =>
                    !excludedNames.has(skill.label.toLowerCase()) &&
                    (!isolatedSkillName || skill.label.toLowerCase() === isolatedSkillName.toLowerCase())
                ),
            }))
            .filter(char => !isolatedSkillName || char.skills.length > 0);

    const uniqueTopLevelNames = Array.from(new Set(allData.flatMap(char => char.skills.map(s => s.label)))).sort();
    const searchMatches = searchTerm.trim()
        ? uniqueTopLevelNames.filter(name => name.toLowerCase().includes(searchTerm.trim().toLowerCase()) && !excludedNames.has(name.toLowerCase()))
        : [];

    const excludeSkill = (name: string) => {
        setExcludedNames(prev => new Set(prev).add(name.toLowerCase()));
        setSearchTerm('');
    };

    const includeSkill = (name: string) => {
        setExcludedNames(prev => { const next = new Set(prev); next.delete(name.toLowerCase()); return next; });
    };

    const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    // Every character that has a top-level skill matching `skillDetailName`, grouped by characterGroup.
    const skillDetailGroups = React.useMemo(() => {
        if (!skillDetailName) return [];
        const targetLower = skillDetailName.toLowerCase();
        const rows = (characters || [])
            .map((c: any) => {
                const uc = userCharacters[c.id] ?? c;
                const skill = (uc?.skills ?? []).find((s: any) => (s.name || '').toLowerCase() === targetLower);
                if (!skill) return null;
                return {
                    charId: c.id,
                    charName: (uc.playerName || uc.name) || c.name || c.id,
                    group: (uc.characterGroup || '').trim() || 'Ungrouped',
                    skillId: skill.id,
                    hasSubskills: Array.isArray(skill.subskills) && skill.subskills.length > 0,
                    pct: computeAverage(skill),
                    subs: buildSubs(skill.subskills ?? []),
                };
            })
            .filter(Boolean) as Array<{ charId: string; charName: string; group: string; skillId: string; hasSubskills: boolean; pct: number; subs: SubDatum[] }>;

        const groups = new Map<string, typeof rows>();
        for (const row of rows) {
            if (!groups.has(row.group)) groups.set(row.group, []);
            groups.get(row.group)!.push(row);
        }
        return Array.from(groups.entries())
            .sort(([a], [b]) => (a === 'Ungrouped' ? 1 : b === 'Ungrouped' ? -1 : a.localeCompare(b)))
            .map(([group, groupRows]) => ({ group, rows: groupRows.sort((a, b) => a.charName.localeCompare(b.charName)) }));
    }, [skillDetailName, characters, userCharacters]);

    const toggleDetail = (key: string) => setDetailExpanded(prev => ({ ...prev, [key]: !prev[key] }));


    // Directly sets a leaf skill's progress (no subskills) — used by the skill-detail editor.
    const updateSkillScore = async (charId: string, skillId: string, value: number) => {
        const c = characters.find((ch: any) => ch.id === charId);
        const uc = userCharacters[charId] ?? c ?? {};
        const clamped = Math.max(0, Math.min(100, Math.round(value)));
        const updated = {
            ...uc,
            skills: (uc.skills ?? []).map((s: any) => (s.id === skillId ? { ...s, progress: clamped, mastered: clamped >= 100 } : s)),
        };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    // Directly sets a leaf subskill's progress, walking down `idPath` (top-level skill id, then nested subskill ids).
    const updateNestedScore = async (charId: string, idPath: string[], value: number) => {
        const c = characters.find((ch: any) => ch.id === charId);
        const uc = userCharacters[charId] ?? c ?? {};
        const clamped = Math.max(0, Math.min(100, Math.round(value)));
        const updateNodes = (nodes: any[], remainingPath: string[]): any[] => {
            const [id, ...rest] = remainingPath;
            return nodes.map((n: any) => {
                if (n.id !== id) return n;
                if (rest.length === 0) return { ...n, progress: clamped, mastered: clamped >= 100 };
                return { ...n, subskills: updateNodes(n.subskills ?? [], rest) };
            });
        };
        const updated = { ...uc, skills: updateNodes(uc.skills ?? [], idPath) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    const isolateSkill = (name: string) => {
        setIsolatedSkillName(name);
        setFocusedCharId(null);
        setSearchTerm('');
    };

    const confirmDeleteSkill = async () => {
        const name = confirmDeleteName;
        if (!name) return;
        const targetLower = name.toLowerCase();
        setDeleting(true);
        const updates: any[] = [];
        for (const c of characters || []) {
            const charId = c.id;
            const uc = userCharacters[charId] ?? c;
            const skills: any[] = uc?.skills ?? [];
            if (!skills.some(s => (s.name || '').toLowerCase() === targetLower)) continue;
            const updated = { ...uc, skills: skills.filter(s => (s.name || '').toLowerCase() !== targetLower) };
            updates.push([charId, updated]);
        }
        if (updates.length > 0) {
            setUserCharacters(prev => ({ ...prev, ...Object.fromEntries(updates) }));
            await Promise.all(updates.map(([, updated]) => saveCharacter(updated).catch(console.error)));
        }
        setDeleting(false);
        setConfirmDeleteName(null);
        setSearchTerm('');
        if (toastTimeout.current) window.clearTimeout(toastTimeout.current);
        setToast(`"${name}" deleted from ${updates.length} character${updates.length !== 1 ? 's' : ''}`);
        toastTimeout.current = window.setTimeout(() => setToast(null), 3000) as unknown as number;
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => setViewMode(prev => prev === 'character' ? 'skill' : 'character')}
                    className="text-white text-xl font-bold hover:text-yellow-300 transition-colors text-left"
                    title="Click to switch view"
                >
                    {viewMode === 'character' ? 'Skill Progress by Character' : 'Progress by Skill'}
                </button>
                <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
            </div>

            <div className="mb-4">
                <div className="relative max-w-xs">
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search a top-level skill to exclude…"
                        className="w-full border rounded px-2 py-1 text-sm"
                    />
                    {searchMatches.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                            {searchMatches.map(name => (
                                <div key={name} className="flex items-center justify-between px-2 py-1 text-sm hover:bg-gray-100">
                                    <span className="truncate">{name}</span>
                                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                        <button onClick={() => isolateSkill(name)} className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs">Isolate</button>
                                        <button onClick={() => excludeSkill(name)} className="px-2 py-0.5 bg-red-500 text-white rounded text-xs">Exclude</button>
                                        <button onClick={() => setConfirmDeleteName(name)} className="px-2 py-0.5 bg-red-800 text-white rounded text-xs">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {excludedNames.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {Array.from(excludedNames).map(name => (
                            <button key={name} onClick={() => includeSkill(name)} className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-white rounded-full text-xs">
                                {name} <span className="text-white/60">✕</span>
                            </button>
                        ))}
                    </div>
                )}
                {isolatedSkillName && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded text-sm w-fit">
                        <span>Showing only "{isolatedSkillName}"</span>
                        <button onClick={() => setIsolatedSkillName(null)} className="text-blue-700 hover:text-blue-900 font-semibold">Show all bars</button>
                    </div>
                )}
            </div>

            {viewMode === 'character' && focusedCharId && (
                <div className="mb-2">
                    <button onClick={() => setFocusedCharId(null)} className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-semibold">
                        ← Show all characters
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-x-auto overflow-y-auto bg-gray-900 rounded-xl p-4">
                {data.length === 0 ? (
                    <p className="text-gray-400 text-sm">{viewMode === 'skill' ? 'No skills common to every character in this group.' : 'No characters to show.'}</p>
                ) : (
                    <div className="flex items-end gap-6 h-full min-w-max">
                        {data.map(char => (
                            <div key={char.id} className="flex flex-col items-center h-full">
                                <div className="flex items-end gap-3 flex-1">
                                    {char.skills.length === 0 ? (
                                        <div className="text-gray-500 text-xs self-center px-2">No skills</div>
                                    ) : char.skills.map((skill) => (
                                        <SkillBranch
                                            key={skill.id}
                                            node={skill}
                                            path={[char.id, skill.id]}
                                            expanded={expanded}
                                            toggle={toggle}
                                        />
                                    ))}
                                </div>
                                {viewMode === 'character' ? (
                                    <button
                                        onClick={() => setFocusedCharId(prev => prev === char.id ? null : char.id)}
                                        className="mt-2 pt-2 border-t border-white/20 text-white font-semibold text-sm whitespace-nowrap hover:text-yellow-300 transition-colors"
                                    >
                                        {char.name}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setSkillDetailName(char.name)}
                                        className="mt-2 pt-2 border-t border-white/20 text-white font-semibold text-sm whitespace-nowrap hover:text-yellow-300 transition-colors"
                                        title="Click to view every character's score for this skill"
                                    >
                                        {char.name}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {skillDetailName && (
                <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-white text-lg font-bold truncate pr-2">{skillDetailName}</h4>
                            <button onClick={() => { setSkillDetailName(null); setScoreInputs({}); setDetailExpanded({}); }} className="text-gray-400 hover:text-white text-sm px-2 flex-shrink-0">✕</button>
                        </div>
                        {skillDetailGroups.length === 0 ? (
                            <p className="text-gray-400 text-sm">No characters have this skill.</p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {skillDetailGroups.map(({ group, rows }) => (
                                    <div key={group}>
                                        <div className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">{group}</div>
                                        <div className="flex flex-col gap-2">
                                            {rows.map((row) => {
                                                const inputKey = `${row.charId}_${row.skillId}`;
                                                const isRowOpen = row.hasSubskills && !!detailExpanded[inputKey];
                                                return (
                                                    <div key={row.charId} className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-white text-sm flex-1 truncate">{row.charName}</span>
                                                            <button
                                                                type="button"
                                                                onClick={row.hasSubskills ? () => toggleDetail(inputKey) : undefined}
                                                                disabled={!row.hasSubskills}
                                                                title={row.hasSubskills ? 'Click to view subskills' : undefined}
                                                                className={`w-24 h-2 bg-gray-700 rounded overflow-hidden flex-shrink-0 ${row.hasSubskills ? 'cursor-pointer' : 'cursor-default'}`}
                                                            >
                                                                <div className="h-2" style={{ width: `${row.pct}%`, background: getBarColor(row.pct) }} />
                                                            </button>
                                                            {row.hasSubskills ? (
                                                                <span className="text-gray-500 text-xs w-16 text-right" title="Has subskills — edit the individual subskills to change this">
                                                                    {row.pct}% (auto)
                                                                </span>
                                                            ) : (
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    value={scoreInputs[inputKey] ?? String(row.pct)}
                                                                    onChange={(e) => setScoreInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                                    onBlur={(e) => {
                                                                        const v = Math.max(0, Math.min(100, Math.round(parseFloat(e.target.value) || 0)));
                                                                        updateSkillScore(row.charId, row.skillId, v);
                                                                        setScoreInputs(prev => { const next = { ...prev }; delete next[inputKey]; return next; });
                                                                    }}
                                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                    className="w-16 bg-gray-800 text-white text-right rounded px-1.5 py-0.5 text-sm"
                                                                    aria-label={`${row.charName} score for ${skillDetailName}`}
                                                                />
                                                            )}
                                                        </div>
                                                        {isRowOpen && row.subs.map((sub) => (
                                                            <SkillDetailNode
                                                                key={sub.id}
                                                                node={sub}
                                                                charId={row.charId}
                                                                idPath={[row.skillId, sub.id]}
                                                                depth={1}
                                                                expanded={detailExpanded}
                                                                toggle={toggleDetail}
                                                                scoreInputs={scoreInputs}
                                                                setScoreInputs={setScoreInputs}
                                                                onCommit={updateNestedScore}
                                                            />
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {confirmDeleteName && (
                <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full text-center">
                        <h4 className="text-lg font-bold mb-2">Delete "{confirmDeleteName}"?</h4>
                        <p className="text-sm text-gray-600 mb-4">This will permanently remove this skill from every character in the selected group that has it. This cannot be undone.</p>
                        <div className="flex justify-center gap-3">
                            <button onClick={() => setConfirmDeleteName(null)} disabled={deleting} className="px-3 py-1.5 bg-gray-200 rounded disabled:opacity-50">Cancel</button>
                            <button onClick={confirmDeleteSkill} disabled={deleting} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50">
                                {deleting ? 'Deleting…' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
                    <div className="bg-red-700 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once">
                        {toast}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassModeStatsGraph;

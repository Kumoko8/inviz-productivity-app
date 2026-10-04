import { useEffect, useRef, useState } from 'react';
import { getItemsForCharacter } from '../../services/characterService';
import { getDrawings } from '../../services/drawingService';
import { loadPrayerOrbGroups, savePrayerOrbGroups } from '../../services/prayerService';
import {
    CMY_PALETTE,
    PrayOrb,
    PrayOrbGroup,
    nextGroupColor,
    randomOrbPosition,
    seededOrbColor,
    seededOrbPosition,
} from './focusOrbUtils';

export function useFocusOrbs(uid: string | undefined, characterId: string) {
    const [prayerOrbs, setPrayerOrbs] = useState<PrayOrb[]>([]);
    const [orbGroups, setOrbGroups] = useState<PrayOrbGroup[]>([]);
    const [collapsing, setCollapsing] = useState<{ orbs: PrayOrb[]; x: number; y: number; color: string } | null>(null);
    const seededRef = useRef(false);
    // Mirrors `orbGroups` so the commit step below can read the latest value
    // without calling setState from inside another updater (see memory notes).
    const orbGroupsRef = useRef<PrayOrbGroup[]>([]);
    useEffect(() => { orbGroupsRef.current = orbGroups; }, [orbGroups]);

    // Once the vacuum-in animation finishes, commit the collapsed orbs into a real group.
    useEffect(() => {
        if (!collapsing) return;
        const timer = window.setTimeout(() => {
            const newGroup: PrayOrbGroup = {
                id: `group-${Date.now()}-${Math.random()}`,
                x: collapsing.x,
                y: collapsing.y,
                color: collapsing.color,
                orbs: collapsing.orbs,
                expanded: false,
            };
            setOrbGroups(groups => [...groups, newGroup]);
            setCollapsing(null);
            if (uid) {
                const updated = [...orbGroupsRef.current, newGroup];
                savePrayerOrbGroups(uid, characterId, updated).catch(console.warn);
            }
        }, 650);
        return () => window.clearTimeout(timer);
    }, [collapsing, uid, characterId]);

    // Fetch prayers, drawings and any persisted groups from Firestore on mount.
    useEffect(() => {
        if (!uid || seededRef.current) return;
        seededRef.current = true;

        Promise.all([
            getItemsForCharacter(uid, characterId, 'prayers'),
            getDrawings(uid, characterId),
            loadPrayerOrbGroups(uid, characterId),
        ]).then(([prayers, drawings, groups]) => {
            const textOrbs: PrayOrb[] = prayers.map((p: any) => {
                const seed = p.createdAt ?? Math.random();
                return {
                    id: `persisted-${seed}`,
                    ...seededOrbPosition(seed),
                    color: seededOrbColor(seed),
                    text: p.text,
                };
            });
            const drawOrbs: PrayOrb[] = drawings.map(d => {
                const seed = d.date ?? Math.random();
                return {
                    id: `drawing-${d.id}`,
                    ...seededOrbPosition(seed),
                    color: seededOrbColor(seed),
                    imageUrl: d.dataUrl,
                };
            });
            // Groups always reload collapsed; orbs already inside a group stay out of the loose list.
            const groupedIds = new Set(groups.flatMap(g => g.orbs.map(o => o.id)));
            setPrayerOrbs([...textOrbs, ...drawOrbs].filter(o => !groupedIds.has(o.id)));
            setOrbGroups(groups.map(g => ({ ...g, expanded: false })));
        }).catch(() => {});
    }, [uid, characterId]);

    const spawnOrb = (content: { text?: string; imageUrl?: string }) => {
        const { x, y } = randomOrbPosition();
        const orb: PrayOrb = {
            id: `${Date.now()}-${Math.random()}`,
            x, y,
            color: CMY_PALETTE[Math.floor(Math.random() * CMY_PALETTE.length)],
            ...content,
        };
        setPrayerOrbs(prev => [...prev, orb]);
    };

    // Collapse every currently-loose orb into one new, larger green cluster orb.
    // Orbs are staged in `collapsing` first so the layer can play a vacuum-in
    // animation before the real group gets committed (see effect above).
    const groupOrbs = () => {
        if (prayerOrbs.length < 2 || collapsing) return;
        const { x, y } = randomOrbPosition();
        setCollapsing({ orbs: prayerOrbs, x, y, color: nextGroupColor(orbGroups.length) });
        setPrayerOrbs([]);
    };

    const toggleGroupExpanded = (groupId: string) => {
        setOrbGroups(groups => groups.map(g =>
            g.id === groupId ? { ...g, expanded: !g.expanded } : g
        ));
    };

    return { prayerOrbs, orbGroups, collapsing, spawnOrb, groupOrbs, toggleGroupExpanded };
}


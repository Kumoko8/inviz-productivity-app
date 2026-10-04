#!/usr/bin/env node
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON before running.');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const uid = process.argv[2];
const charId = process.argv[3];
if (!uid || !charId) {
    console.error('Usage: node debug_transform_ready.js <uid> <charDocId>');
    process.exit(1);
}

async function main() {
    // load base character by id
    const baseSnap = await db.collection('characters').doc(charId).get();
    if (!baseSnap.exists) {
        console.error('Base character not found:', charId);
        return;
    }
    const base = baseSnap.data() || {};

    // load user char doc
    const userCharSnap = await db.collection('users').doc(uid).collection('characters').doc(charId).get();
    const u = userCharSnap.exists ? (userCharSnap.data() || {}) : {};

    // fallback to local characterData not available here; assume base contains transform arrays
    const merged = {
        ...base,
        animation: typeof u.animation === 'string' ? u.animation : base.animation,
        transformIndex: typeof u.transformIndex === 'number' ? u.transformIndex : (base.transformIndex ?? 0),
        xp: typeof u.xp === 'number' ? u.xp : u.xp ?? 0,
        level: typeof u.level === 'number' ? u.level : u.level ?? 1,
        skills: Array.isArray(u.skills) ? u.skills : [],
        prayers: Array.isArray(u.prayers) ? u.prayers : [],
    };

    const transformIndex = typeof merged.transformIndex === 'number' ? merged.transformIndex : 0;
    const thresholds = merged.transformThresholds ?? [];
    const nextThreshold = thresholds[transformIndex];
    const hasMoreTransforms = transformIndex < thresholds.length;
    const transformReady = !!(merged && hasMoreTransforms && typeof nextThreshold === 'number' && (merged.level >= nextThreshold));

    console.log('Merged for', uid, charId);
    console.log(' level=', merged.level, ' xp=', merged.xp, ' transformIndex=', merged.transformIndex);
    console.log(' thresholds=', thresholds);
    console.log(' nextThreshold=', nextThreshold, ' hasMore=', hasMoreTransforms);
    console.log(' transformReady=', transformReady);
}

main().catch(err => { console.error(err); process.exit(1); });

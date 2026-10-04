#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON before running.');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const CHAR_DATA_PATH = path.resolve(__dirname, '../frontend/src/components/CharacterData.tsx');

function parseArrayLiteral(text) {
    // returns array of strings or numbers by parsing simple JS array literal
    if (!text) return undefined;
    const items = text.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        // strip quotes
        const m = s.match(/^'(.*)'$/) || s.match(/^"(.*)"$/);
        if (m) return m[1];
        const n = Number(s);
        return Number.isNaN(n) ? s : n;
    });
    return items;
}

function extractCharacterData(src) {
    const entries = {};
    // split into blocks by top-level object braces inside the exported array
    const arrayMatch = src.match(/export const characterData:\s*BaseCharacterFirestore\[]\s*=\s*\[([\s\S]*?)\];/m) || src.match(/export const characterData:\s*BaseCharacterFirestore\[]\s*=\s*\[([\s\S]*?)\]/m) || src.match(/export const characterData\s*=\s*\[([\s\S]*?)\];/m);
    const body = arrayMatch ? arrayMatch[1] : src;
    const blocks = body.split(/\},\s*\{/).map(b => b.replace(/^[\s\{]+|[\}\s]+$/g, ''));
    for (const block of blocks) {
        const nameMatch = block.match(/name:\s*['"]([^'"]+)['"]/);
        const animMatch = block.match(/animation:\s*['"]([^'"]+)['"]/);
        const thrMatch = block.match(/transformThresholds:\s*\[([^\]]*)\]/);
        const finalMatch = block.match(/transformAnimations:\s*\[([^\]]*)\]/);
        const tempMatch = block.match(/transformTempAnimations:\s*\[([^\]]*)\]/);
        if (nameMatch) {
            const key = nameMatch[1];
            entries[key] = {};
            if (animMatch) entries[key].animation = animMatch[1];
            if (thrMatch) entries[key].transformThresholds = parseArrayLiteral(thrMatch[1]);
            if (finalMatch) entries[key].transformAnimations = parseArrayLiteral(finalMatch[1]);
            if (tempMatch) entries[key].transformTempAnimations = parseArrayLiteral(tempMatch[1]);
        }
    }
    return entries;
}

async function main() {
    console.log('Reading characterData from', CHAR_DATA_PATH);
    const src = fs.readFileSync(CHAR_DATA_PATH, 'utf8');
    const map = extractCharacterData(src);
    console.log('Found', Object.keys(map).length, 'entries in characterData');

    const snap = await db.collection('characters').get();
    console.log('Found', snap.size, 'characters in Firestore');

    for (const doc of snap.docs) {
        const data = doc.data() || {};
        const name = data.name || '';
        const anim = (data.animation || data._migratedFrom || '').toString().trim();

        let match = null;
        if (name && map[name]) match = map[name];
        if (!match && anim) {
            const token = anim.replace(/\.mp4$/i, '').split('/').pop();
            for (const k of Object.keys(map)) {
                const cd = map[k];
                if (cd.animation && cd.animation.includes(token)) { match = cd; break; }
            }
        }

        if (!match) {
            console.log(doc.id, 'no matching local data, skipping');
            continue;
        }

        const patch = {};
        if (match.transformThresholds) patch.transformThresholds = match.transformThresholds.map(x => Number(x));
        if (match.transformAnimations) patch.transformAnimations = match.transformAnimations;
        if (match.transformTempAnimations) patch.transformTempAnimations = match.transformTempAnimations;

        if (Object.keys(patch).length === 0) {
            console.log(doc.id, 'no transform fields to write, skipping');
            continue;
        }

        console.log('Updating', doc.id, 'with', Object.keys(patch));
        await db.collection('characters').doc(doc.id).set(patch, { merge: true });
    }

    console.log('Done.');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

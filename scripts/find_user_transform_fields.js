#!/usr/bin/env node
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON before running.');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function main() {
    console.log('Scanning users/*/characters for per-user transform fields...');
    const usersSnap = await db.collection('users').get();
    let count = 0;
    for (const u of usersSnap.docs) {
        const uid = u.id;
        const charsSnap = await db.collection('users').doc(uid).collection('characters').get();
        for (const c of charsSnap.docs) {
            const data = c.data();
            const fields = [];
            if (data.transformThresholds !== undefined) fields.push('transformThresholds');
            if (data.transformAnimations !== undefined) fields.push('transformAnimations');
            if (data.transformTempAnimations !== undefined) fields.push('transformTempAnimations');
            if (fields.length) {
                console.log(`User ${uid} char ${c.id} has: ${fields.join(', ')}`);
                console.log('  value sample:', fields.map(f => ({ [f]: data[f] })));
                count++;
            }
        }
    }
    console.log(`Scan complete. Found ${count} per-user character docs with transform fields.`);
}

main().catch(err => { console.error(err); process.exit(1); });

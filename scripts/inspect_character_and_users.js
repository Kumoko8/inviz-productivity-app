#!/usr/bin/env node
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON before running.');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const charId = process.argv[2];
if (!charId) {
    console.error('Usage: node inspect_character_and_users.js <characterDocId>');
    process.exit(1);
}

async function main() {
    console.log('Inspecting base character doc:', charId);
    const baseDoc = await db.collection('characters').doc(charId).get();
    if (!baseDoc.exists) {
        console.log('Base character not found');
    } else {
        console.log('Base character data:', baseDoc.data());
    }

    console.log('\nSearching for user docs containing this character id...');
    const usersSnap = await db.collection('users').get();
    for (const u of usersSnap.docs) {
        const uid = u.id;
        const charRef = db.collection('users').doc(uid).collection('characters').doc(charId);
        const snap = await charRef.get();
        if (snap.exists) {
            console.log(`User ${uid} has doc:`, snap.data());
        }
    }
}

main().catch(err => { console.error(err); process.exit(1); });

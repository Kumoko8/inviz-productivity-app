#!/usr/bin/env node
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON before running.');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const uid = 'JqzlnoRP7teD5HS96B7SUIp2Tyg2';
const charIds = ['C1KTa5qIfR5nqeIF3gQZ', 'F0v0vfmakh6iVJn5Yu4a'];

async function main() {
    for (const id of charIds) {
        const ref = db.collection('users').doc(uid).collection('characters').doc(id);
        await ref.set({ transformIndex: 0 }, { merge: true });
        console.log(`Reset transformIndex=0 for user ${uid} char ${id}`);
    }
    console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });

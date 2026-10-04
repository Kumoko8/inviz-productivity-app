#!/usr/bin/env node
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON before running.');
    process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const uid = process.argv[2];
if (!uid) {
    console.error('Usage: node inspect_user_transforms.js <uid> [characterName]');
    process.exit(1);
}

const charName = process.argv[3];

async function main() {
    console.log('Inspecting user:', uid);
    const userCharsSnap = await db.collection('users').doc(uid).collection('characters').get();
    if (userCharsSnap.empty) {
        console.log('No user characters found for', uid);
    } else {
        console.log('User characters:');
        for (const d of userCharsSnap.docs) {
            const data = d.data();
            console.log(`- ${d.id}: animation=${data.animation || ''} transformIndex=${data.transformIndex} level=${data.level} xp=${data.xp}`);
        }
    }

    if (charName) {
        console.log('\nLooking up base character by name token:', charName);
        const baseSnap = await db.collection('characters').get();
        for (const b of baseSnap.docs) {
            const data = b.data();
            const name = data.name || '';
            const anim = (data.animation || '').toString();
            if ((name && name.toLowerCase().includes(charName.toLowerCase())) || (anim && anim.includes(charName.toLowerCase()))) {
                console.log(`Base ${b.id}: name=${name} animation=${anim}`);
                console.log('  transformThresholds=', data.transformThresholds);
                console.log('  transformTempAnimations=', data.transformTempAnimations);
                console.log('  transformAnimations=', data.transformAnimations);
            }
        }
    }
}

main().catch(err => { console.error(err); process.exit(1); });

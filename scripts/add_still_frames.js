#!/usr/bin/env node
/**
 * Adds a `stillFrames` map to every doc in the `characters` collection.
 *
 * Upload your images to Firebase Storage using this layout (<name> = lowercase character name):
 *   characters/<name>/stills/<name>_default.png
 *   characters/<name>/stills/<name>_earnxp.png   (earn XP / level up)
 *   characters/<name>/stills/<name>_losehp.png
 *   characters/<name>/stills/<name>_wounded.png
 *
 * Use --ext=webp (or jpg) if your files aren't png. Existing stillFrames are kept unless --force.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json node scripts/add_still_frames.js [--dryRun] [--force] [--ext=png]
 */
const admin = require('firebase-admin');

const DRY = process.argv.includes('--dryRun');
const FORCE = process.argv.includes('--force');
const ext = (process.argv.find(a => a.startsWith('--ext=')) || '--ext=png').split('=')[1];

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('ERROR: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('characters').get();
  for (const doc of snap.docs) {
    const data = doc.data();
    const name = (data.name || '').toLowerCase().trim();
    if (!name) { console.warn(`[SKIP] ${doc.id} — no name`); continue; }
    if (data.stillFrames && !FORCE) { console.log(`[SKIP] ${doc.id} (${name}) — has stillFrames`); continue; }
    const base = `characters/${name}/stills/${name}`;
    const stillFrames = {
      default: `${base}_default.${ext}`,
      earnXp: `${base}_earnxp.${ext}`,
      loseHp: `${base}_losehp.${ext}`,
      wounded: `${base}_wounded.${ext}`,
    };
    console.log(doc.id, JSON.stringify(stillFrames));
    if (!DRY) await doc.ref.update({ stillFrames });
  }
  process.exit(0);
})();

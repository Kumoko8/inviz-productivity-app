#!/usr/bin/env node
/**
 * Adds woundedAnimations[] and defeatAnimations[] arrays to every doc
 * in the `characters` collection (base character docs).
 *
 * Path pattern (mirrors add_anim_fields.js):
 *   woundedAnimations[i] = characters/<name>/wounded/<name>_wounded_<i+1>.mp4
 *   defeatAnimations[i]  = characters/<name>/defeat/<name>_defeat_<i+1>.mp4
 *
 * Both arrays have 7 entries (index 0 = form 1 / base, index 1-6 = transforms).
 * Existing values are NOT overwritten — the script skips any doc that already
 * has both fields (use --force to overwrite).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json \
 *     node scripts/add_wounded_defeat_anims.js
 *
 *   # Preview without writing:
 *   GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json \
 *     node scripts/add_wounded_defeat_anims.js --dryRun
 *
 *   # Overwrite even if fields already exist:
 *   GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json \
 *     node scripts/add_wounded_defeat_anims.js --force
 */

const admin = require('firebase-admin');

const DRY = process.argv.includes('--dryRun');
const FORCE = process.argv.includes('--force');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('ERROR: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async () => {
  console.log(`Starting add_wounded_defeat_anims — dryRun=${DRY}  force=${FORCE}\n`);

  const snap = await db.collection('characters').get();
  console.log(`Found ${snap.size} character doc(s).\n`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = (data.name || '').toLowerCase().trim();

    if (!name) {
      console.warn(`  [SKIP] ${doc.id} — no name field`);
      continue;
    }

    const alreadyHasBoth = data.woundedAnimations && data.defeatAnimations;
    if (alreadyHasBoth && !FORCE) {
      console.log(`  [SKIP] ${doc.id} (${data.name}) — fields already exist (use --force to overwrite)`);
      continue;
    }

    // 7 entries: index 0 = base form, 1-6 = transform forms
    const woundedAnimations = Array.from({ length: 7 }, (_, i) =>
      `characters/${name}/wounded/${name}_wounded_${i + 1}.mp4`
    );
    const defeatAnimations = Array.from({ length: 7 }, (_, i) =>
      `characters/${name}/defeat/${name}_defeat_${i + 1}.mp4`
    );

    console.log(`  ${doc.id}  (${data.name})`);
    console.log(`    woundedAnimations : ${JSON.stringify(woundedAnimations)}`);
    console.log(`    defeatAnimations  : ${JSON.stringify(defeatAnimations)}`);

    if (!DRY) {
      await doc.ref.update({ woundedAnimations, defeatAnimations });
      console.log(`    ✓ written\n`);
    } else {
      console.log(`    (dry run — not written)\n`);
    }
  }

  console.log('Done.');
  process.exit(0);
})();

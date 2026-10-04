#!/usr/bin/env node
/**
 * Adds idleAnimations, actionAnimations, and damageAnimations arrays
 * to each doc in the `characters` collection.
 *
 * idleAnimations  = [animation (form 1), ...transformAnimations (forms 2-7)]
 * actionAnimations = animations/<name>/action/<name>_action_1..7.mp4
 * damageAnimations = animations/<name>/damage/<name>_damage_1..7.mp4
 *
 * Pass --dryRun to preview without writing.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json node scripts/add_anim_fields.js
 *   GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json node scripts/add_anim_fields.js --dryRun
 */

const admin = require('firebase-admin');

const DRY = process.argv.includes('--dryRun');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('ERROR: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async () => {
  console.log(`Starting add_anim_fields — dryRun=${DRY}\n`);

  const snap = await db.collection('characters').get();
  console.log(`Found ${snap.size} character docs.\n`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = (data.name || '').toLowerCase();

    if (!name) {
      console.warn(`  [SKIP] ${doc.id} — no name field`);
      continue;
    }

    // idleAnimations: form 1 (animation) + forms 2-7 (transformAnimations)
    const baseAnim = (data.animation || '').trim();
    const transformAnims = (data.transformAnimations || []).map(s => s.trim());
    const idleAnimations = [baseAnim, ...transformAnims].filter(Boolean);

    // actionAnimations and damageAnimations: 7 entries, indexed by form (1-based)
    const actionAnimations = Array.from({ length: 7 }, (_, i) =>
      `characters/${name}/action/${name}_action_${i + 1}.mp4`
    );
    const damageAnimations = Array.from({ length: 7 }, (_, i) =>
      `characters/${name}/damage/${name}_damage_${i + 1}.mp4`
    );

    console.log(`  ${doc.id}  (${data.name})`);
    console.log(`    idleAnimations   : ${JSON.stringify(idleAnimations)}`);
    console.log(`    actionAnimations : ${JSON.stringify(actionAnimations)}`);
    console.log(`    damageAnimations : ${JSON.stringify(damageAnimations)}`);

    if (!DRY) {
      await doc.ref.update({ idleAnimations, actionAnimations, damageAnimations });
      console.log(`    ✓ written\n`);
    } else {
      console.log(`    (dry run — not written)\n`);
    }
  }

  console.log('Done.');
  process.exit(0);
})();

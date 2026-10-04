#!/usr/bin/env node
/**
 * migrate_character_notes.js
 *
 * Migration script to move notes stored under the user root doc
 * `users/{uid}.characterNotes[characterName]` into the per-character
 * document at `users/{uid}/characters/{characterId}.notes`.
 *
 * Usage:
 *   Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON, then:
 *     node scripts/migrate_character_notes.js [--force] [--remove-old]
 *
 * Options:
 *   --force       Overwrite existing `notes` on character docs.
 *   --remove-old  Remove the `characterNotes` object from the user doc after migrating.
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const REMOVE_OLD = args.includes('--remove-old');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS not set. Export a path to a service account JSON before running.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async function main() {
  try {
    console.log('Starting notes migration...');

    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} user docs`);

    let migratedCount = 0;
    let skippedCount = 0;
    let missingCount = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const root = userDoc.data() || {};
      const characterNotes = (root.characterNotes && typeof root.characterNotes === 'object') ? root.characterNotes : {};
      const keys = Object.keys(characterNotes || {});
      if (keys.length === 0) continue;

      console.log(`\nUser ${uid} has ${keys.length} legacy note key(s)`);

      // load user characters
      const charsSnap = await db.collection('users').doc(uid).collection('characters').get();
      const charDocs = charsSnap.docs;

      // build lookup by character.name and playerName
      const byName = new Map();
      for (const c of charDocs) {
        const data = c.data() || {};
        const name = (data.name || '').toString();
        const playerName = (data.playerName || '').toString();
        if (name) {
          if (!byName.has(name)) byName.set(name, []);
          byName.get(name).push({ id: c.id, data });
        }
        if (playerName) {
          if (!byName.has(playerName)) byName.set(playerName, []);
          byName.get(playerName).push({ id: c.id, data });
        }
      }

      for (const key of keys) {
        const note = characterNotes[key];
        const matches = byName.get(key) || [];
        if (matches.length === 0) {
          console.warn(`  - No matching character doc for key: "${key}" (skipping)`);
          missingCount++;
          continue;
        }

        // If multiple matches, prefer exact playerName first, then fallback to first
        let chosen = matches[0];
        if (matches.length > 1) {
          const playerMatch = matches.find(m => (m.data.playerName || '') === key);
          if (playerMatch) chosen = playerMatch;
          else {
            console.warn(`  - Multiple character docs match "${key}", using first: ${matches.map(m => m.id).join(', ')}`);
          }
        }

        const charRef = db.collection('users').doc(uid).collection('characters').doc(chosen.id);
        const current = chosen.data || {};
        if (current.notes && !FORCE) {
          console.log(`  - Character ${chosen.id} already has notes, skipping (use --force to overwrite)`);
          skippedCount++;
          continue;
        }

        // write notes to character doc
        await charRef.set({ notes: note }, { merge: true });
        console.log(`  - Migrated note for character ${chosen.id} (key "${key}")`);
        migratedCount++;
      }

      if (REMOVE_OLD) {
        // remove characterNotes from user doc
        await db.collection('users').doc(uid).update({ characterNotes: admin.firestore.FieldValue.delete() });
        console.log(`  - Removed legacy characterNotes from user ${uid}`);
      }
    }

    console.log('\nMigration complete.');
    console.log(`  Migrated: ${migratedCount}`);
    console.log(`  Skipped (existing notes): ${skippedCount}`);
    console.log(`  Missing (no matching char): ${missingCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(2);
  }
})();

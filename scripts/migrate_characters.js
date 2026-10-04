#!/usr/bin/env node
/*
Migration helper for characters schema changes.

What it does:
- Reads all base characters from `characters` (source collection)
- For each base character it creates (or detects) a new target document id.
  - If `--retain-ids` is passed, it will keep existing IDs (no base changes)
  - Otherwise it will create new docs in `characters_new` (safe) or `characters` with a new id
- Builds a map oldBaseId -> newBaseId
- For each user under `users/{uid}/characters/{oldBaseId}` it will copy that doc and its nested subcollections to `users/{uid}/characters/{newBaseId}`
- Supports `--dryRun` which logs actions but does not write

Usage:
  # Install deps (once):
  # npm install firebase-admin yargs

  # Dry run (recommended) using GOOGLE_APPLICATION_CREDENTIALS env var:
  node scripts/migrate_characters.js --dryRun

  # Live run (writes to Firestore):
  node scripts/migrate_characters.js

  # Options:
  --dryRun        : only log what would happen
  --sourceCol     : source base collection name (default: characters)
  --targetCol     : target base collection name (default: characters) — if different you can write into a new collection
  --retain-ids    : if passed, keep existing base character doc IDs (no remap)
  --projectId     : optional project id override

Important:
- BACKUP your DB before running (gcloud firestore export).
- Run dry run first and inspect the printed mapping.
- This script assumes user per-character docs are stored at users/{uid}/characters/{characterId} and that nested subcollections (e.g. prayers) must move under the new doc path.
*/

const admin = require("firebase-admin");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv))
  .option("dryRun", { type: "boolean", default: false })
  .option("sourceCol", { type: "string", default: "characters" })
  .option("targetCol", { type: "string", default: "characters" })
  .option("retainIds", { type: "boolean", default: false })
  .option("projectId", { type: "string" })
  .argv;

const DRY = argv.dryRun;
const SRC = argv.sourceCol;
const TGT = argv.targetCol;
const RETAIN = argv.retainIds;

async function main() {
  console.log(`Migration start — dryRun=${DRY}, src=${SRC}, tgt=${TGT}, retainIds=${RETAIN}`);

  // Initialize admin app
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("ERROR: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path before running.");
    console.error("Example: export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json");
    process.exit(1);
  }

  const adminOptions = {};
  if (argv.projectId) adminOptions.projectId = argv.projectId;

  admin.initializeApp({ credential: admin.credential.applicationDefault(), ...adminOptions });
  const db = admin.firestore();

  // 1) Read base characters
  const srcSnap = await db.collection(SRC).get();
  console.log(`Found ${srcSnap.size} base characters in '${SRC}'.`);

  // Build mapping oldId -> newId
  const idMap = {};

  for (const doc of srcSnap.docs) {
    const oldId = doc.id;
    if (RETAIN) {
      idMap[oldId] = oldId;
      continue;
    }

    // If target collection is same as source, we'll generate new ID and write to a temp collection
    let newId;
    if (SRC === TGT) {
      // create a new doc with auto id in target collection (or in characters_new if you prefer)
      const ref = db.collection(TGT).doc();
      newId = ref.id;
    } else {
      // different target collection; create new doc id
      const ref = db.collection(TGT).doc();
      newId = ref.id;
    }
    idMap[oldId] = newId;
  }

  console.log("ID mapping (old -> new):");
  console.log(idMap);

  if (DRY) {
    console.log("Dry run complete — no writes performed.");
    process.exit(0);
  }

  // 2) Write base characters to target (copy data)
  for (const doc of srcSnap.docs) {
    const oldId = doc.id;
    const newId = idMap[oldId];
    const data = doc.data();

    // Optionally you can add a field to indicate migration origin
    data._migratedFrom = oldId;
    data._migratedAt = admin.firestore.FieldValue.serverTimestamp();

    const tgtRef = db.collection(TGT).doc(newId);
    console.log(`Writing base character ${oldId} -> ${TGT}/${newId}`);
    await tgtRef.set(data, { merge: true });
  }

  // 3) Migrate user instances and nested subcollections
  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} users.`);

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userCharsRef = db.collection("users").doc(uid).collection("characters");
    const userCharsSnap = await userCharsRef.get();
    if (userCharsSnap.empty) continue;

    console.log(`User ${uid} has ${userCharsSnap.size} character docs.`);

    for (const charDoc of userCharsSnap.docs) {
      const oldCharId = charDoc.id;
      const newCharId = idMap[oldCharId] || oldCharId; // fallback to old id if not mapped
      const userCharData = charDoc.data();

      // Write to new path
      const newUserCharRef = db.collection("users").doc(uid).collection("characters").doc(newCharId);
      console.log(`Copying user ${uid} character ${oldCharId} -> ${newCharId}`);
      await newUserCharRef.set({ ...userCharData, _migratedFrom: oldCharId, _migratedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      // Copy nested subcollections (e.g., prayers)
      const nestedCols = await charDoc.ref.listCollections();
      for (const nested of nestedCols) {
        const nestedSnap = await nested.get();
        console.log(`  Found nested collection ${nested.id} with ${nestedSnap.size} docs`);
        for (const nestedDoc of nestedSnap.docs) {
          const nestedData = nestedDoc.data();
          const dest = newUserCharRef.collection(nested.id).doc(nestedDoc.id);
          await dest.set(nestedData, { merge: true });
        }
      }

      // Optionally delete old user char doc (commented out):
      // await charDoc.ref.delete();
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

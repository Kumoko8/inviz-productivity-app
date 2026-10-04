#!/usr/bin/env node
// Recover per-user character docs from legacy fields on users/{uid} document
// Usage: set GOOGLE_APPLICATION_CREDENTIALS and run with --user <uid>

const admin = require('firebase-admin');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('user', { type: 'string' })
  .option('all', { type: 'boolean', default: false })
  .option('dryRun', { type: 'boolean', default: false })
  .argv;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async () => {
  const dryRun = !!argv.dryRun;
  const runAll = !!argv.all;

  const baseSnap = await db.collection('characters').get();

  const usersToProcess = [];
  if (runAll) {
    const usersSnap = await db.collection('users').get();
    for (const u of usersSnap.docs) usersToProcess.push(u.id);
    console.log(`Dry-run=${dryRun} — processing ALL users (${usersToProcess.length})`);
  } else {
    if (!argv.user) {
      console.error('Specify --user <uid> or --all');
      process.exit(1);
    }
    usersToProcess.push(argv.user);
    console.log(`Dry-run=${dryRun} — processing user ${argv.user}`);
  }

  for (const uid of usersToProcess) {
    console.log('\n--- User:', uid, '---');
    const userRootRef = db.collection('users').doc(uid);
    const userRootSnap = await userRootRef.get();
    if (!userRootSnap.exists) {
      console.log('  User root doc not found — skipping');
      continue;
    }
    const legacy = userRootSnap.data() || {};

    for (const baseDoc of baseSnap.docs) {
      const baseId = baseDoc.id;
      const baseData = baseDoc.data() || {};

      // derive token/name similar to frontend: use animation token or migrated id
      const migrated = baseData._migratedFrom;
      const animRaw = (baseData.animation || migrated || "") + "";
      const token = animRaw.toString().trim().replace(/\.mp4$/i, "").split("/").pop() || "";
      const pretty = token.replace(/_\d+$/, "").replace(/[-_]/g, " ");
      const prettyName = pretty ? (pretty.charAt(0).toUpperCase() + pretty.slice(1)) : "";

      // try multiple keys that legacy data might be stored under
      const nameCandidates = [baseData.name, prettyName, migrated, baseId].filter(Boolean);

      const userCharRef = db.collection('users').doc(uid).collection('characters').doc(baseId);
      const userCharSnap = await userCharRef.get();
      const existing = userCharSnap.exists ? userCharSnap.data() || {} : {};

      // find legacy entries by candidate keys
      let legacySkills = [];
      let legacyXpObj = null;
      let legacyHp = undefined;
      for (const key of nameCandidates) {
        if (!legacySkills.length && legacy.characterSkills && Array.isArray(legacy.characterSkills[key])) {
          legacySkills = legacy.characterSkills[key];
        }
        if (!legacyXpObj && legacy.characterXp && legacy.characterXp[key]) {
          legacyXpObj = legacy.characterXp[key];
        }
        if (legacyHp === undefined && legacy.characterHp && typeof legacy.characterHp[key] === 'number') {
          legacyHp = legacy.characterHp[key];
        }
      }

      const payload = {};

      // only set fields if missing/empty OR if legacy data looks more complete
      if (existing.hp === undefined || existing.hp === null || (typeof legacyHp === 'number' && existing.hp === 100)) payload.hp = typeof legacyHp === 'number' ? legacyHp : 100;
      if (existing.maxHp === undefined || existing.maxHp === null) payload.maxHp = existing.maxHp ?? 100;
      if (existing.xp === undefined || existing.xp === null || (legacyXpObj && existing.xp === 0 && typeof legacyXpObj.xp === 'number')) payload.xp = legacyXpObj && typeof legacyXpObj.xp === 'number' ? legacyXpObj.xp : (typeof legacy.xp === 'number' ? legacy.xp : 0);
      if (existing.level === undefined || existing.level === null || (legacyXpObj && existing.level === 1 && typeof legacyXpObj.level === 'number')) payload.level = legacyXpObj && typeof legacyXpObj.level === 'number' ? legacyXpObj.level : (typeof legacy.level === 'number' ? legacy.level : 1);
      if (!Array.isArray(existing.skills) || existing.skills.length === 0) payload.skills = Array.isArray(legacySkills) ? legacySkills : [];
      if (!Array.isArray(existing.prayers) || existing.prayers.length === 0) payload.prayers = Array.isArray(legacy.prayers) ? legacy.prayers : [];
      if (!existing.createdAt) payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      payload._restoredFromLegacy = true;

      // if there is nothing to write, skip
      const keysToWrite = Object.keys(payload).filter(k => k !== '_restoredFromLegacy');
      if (keysToWrite.length === 0) {
        // nothing to write for this baseId
        continue;
      }

      if (dryRun) {
        console.log('  DRYRUN -> would merge into', baseId, 'keys:', keysToWrite.join(','), '\n    payload:', JSON.stringify(payload));
      } else {
        await userCharRef.set(payload, { merge: true });
        console.log('  Merged legacy into', baseId, 'keys:', keysToWrite.join(','));
      }

      // end base loop
    }
    // end user loop
  }

  console.log('Done.');
  process.exit(0);
})();

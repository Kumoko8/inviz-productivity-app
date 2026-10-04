#!/usr/bin/env node
// Check mismatch between base character IDs and user's character doc IDs
// Usage:
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//   node scripts/check_character_mismatch.js --user <UID>

const admin = require('firebase-admin');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv))
  .option('user', { type: 'string', demandOption: true })
  .option('projectId', { type: 'string' })
  .argv;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON');
  process.exit(1);
}

const adminOptions = {};
if (argv.projectId) adminOptions.projectId = argv.projectId;
admin.initializeApp({ credential: admin.credential.applicationDefault(), ...adminOptions });
const db = admin.firestore();

async function main() {
  const userId = argv.user;
  const baseSnap = await db.collection('characters').get();
  const baseIds = baseSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

  const userCharsSnap = await db.collection('users').doc(userId).collection('characters').get();
  const userIds = userCharsSnap.docs.map(d => ({ id: d.id, data: d.data() }));

  console.log(`Base characters (${baseIds.length}):`, baseIds.map(b => b.id).join(', '));
  console.log(`User ${userId} characters (${userIds.length}):`, userIds.map(u => u.id).join(', '));

  // find base IDs missing in user
  const missingForUser = baseIds.filter(b => !userIds.some(u => u.id === b.id));
  if (missingForUser.length === 0) {
    console.log('All base character IDs found in user characters.');
  } else {
    console.log('Base IDs missing in user characters:');
    missingForUser.forEach(b => console.log(`  ${b.id} (${b.name || 'no-name'})`));
  }

  // find user ids that do not correspond to any base id
  const orphanUserIds = userIds.filter(u => !baseIds.some(b => b.id === u.id));
  if (orphanUserIds.length === 0) {
    console.log('No orphan user character IDs.');
  } else {
    console.log('User character IDs not found in base collection (orphaned):');
    orphanUserIds.forEach(u => console.log(`  ${u.id} -> ${JSON.stringify(u.data)}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });

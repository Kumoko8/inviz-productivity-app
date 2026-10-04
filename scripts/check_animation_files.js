#!/usr/bin/env node
// Check animation field and storage file existence for specific migrated tokens

const admin = require('firebase-admin');
const fs = require('fs');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON');
  process.exit(1);
}

const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
let svc;
try { svc = JSON.parse(fs.readFileSync(svcPath)); } catch (e) { console.error('Could not read service account:', e); process.exit(1); }
const projectId = svc.project_id;
const defaultBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

admin.initializeApp({ credential: admin.credential.applicationDefault(), storageBucket: defaultBucket });
const db = admin.firestore();
const bucket = admin.storage().bucket();

(async () => {
  console.log('Using project:', projectId, 'bucket:', defaultBucket);
  const tokens = ['mushi_1', 'maguro_1', 'lucas_1', 'yumi_1'];
  const snap = await db.collection('characters').get();
  for (const d of snap.docs) {
    const data = d.data();
    const migrated = (data._migratedFrom || '').toString();
    const animation = (data.animation || '').toString();
    for (const t of tokens) {
      if (migrated.includes(t) || animation.includes(t)) {
        console.log('\nDoc:', d.id);
        console.log('  _migratedFrom:', JSON.stringify(migrated));
        console.log('  animation raw:', JSON.stringify(animation));
        const animTrim = animation.trim();
        try {
          const file = bucket.file(animTrim);
          const [exists] = await file.exists();
          console.log('  trimmed animation:', JSON.stringify(animTrim), 'exists in storage?', exists);
        } catch (e) {
          console.error('  error checking storage file:', e.message || e);
        }
      }
    }
  }
  process.exit(0);
})();

#!/usr/bin/env node
const admin = require('firebase-admin');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('characters').limit(10).get();
  console.log(`Found ${snap.size} docs in characters`);
  snap.docs.forEach(d => console.log(d.id, JSON.stringify(d.data())));
})();

#!/usr/bin/env node
// Diagnostic: check how many users have legacy root fields and how many per-user character docs contain skills/level/xp

const admin = require('firebase-admin');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to service account JSON');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

(async () => {
  const usersSnap = await db.collection('users').get();
  console.log(`Scanning ${usersSnap.size} users...`);

  let usersWithLegacy = 0;
  let totalUserChars = 0;
  let totalCharsWithSkills = 0;
  let totalCharsWithLevelGt1 = 0;
  let totalCharsWithXpGt0 = 0;
  const sampleProblems = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const root = userDoc.data() || {};
    const hasLegacy = Boolean(root.characterSkills || root.characterXp || root.characterHp || root.skills || root.xp || root.level);
    if (hasLegacy) usersWithLegacy++;

    const charsSnap = await db.collection('users').doc(uid).collection('characters').get();
    const charCount = charsSnap.size;
    totalUserChars += charCount;

    let charsWithSkills = 0;
    let charsWithLevelGt1Local = 0;
    let charsWithXpGt0Local = 0;

    for (const c of charsSnap.docs) {
      const data = c.data() || {};
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        totalCharsWithSkills++; charsWithSkills++;
      }
      if (typeof data.level === 'number' && data.level > 1) {
        totalCharsWithLevelGt1++; charsWithLevelGt1Local++;
      }
      if (typeof data.xp === 'number' && data.xp > 0) {
        totalCharsWithXpGt0++; charsWithXpGt0Local++;
      }
    }

    // collect a few samples where legacy exists but per-user docs appear empty
    if (hasLegacy && charCount > 0 && charsWithSkills === 0 && charsWithLevelGt1Local === 0 && charsWithXpGt0Local === 0) {
      sampleProblems.push({ uid, charCount, note: 'legacy present but per-user docs appear default/empty' });
    }

    // also collect users with legacy but no per-user character docs
    if (hasLegacy && charCount === 0) {
      sampleProblems.push({ uid, charCount, note: 'legacy present and no per-user docs' });
    }
  }

  console.log('SUMMARY');
  console.log('Users scanned:', usersSnap.size);
  console.log('Users with legacy root fields:', usersWithLegacy);
  console.log('Total per-user character docs:', totalUserChars);
  console.log('Total per-user chars with skills:', totalCharsWithSkills);
  console.log('Total per-user chars with level>1:', totalCharsWithLevelGt1);
  console.log('Total per-user chars with xp>0:', totalCharsWithXpGt0);
  console.log('\nSample problems (up to 20):');
  console.log(JSON.stringify(sampleProblems.slice(0, 20), null, 2));

  process.exit(0);
})();

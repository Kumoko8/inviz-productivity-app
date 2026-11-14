#!/usr/bin/env node
'use strict';

// Dry-run by default. Requires gcloud credentials with Storage and Firestore access.
const { execFileSync } = require('node:child_process');

const PROJECT = 'inviz-ae0c0';
const BUCKET = 'inviz-ae0c0.firebasestorage.app';
const NAMES = 'kumo|kiiro|maguro|yumi|mushi|roku';
const LEGACY = new RegExp(`^characters/(${NAMES})_(?:(transform_temp)_)?([0-9]+)\\.mp4$`);

function destination(path) {
  const match = LEGACY.exec(path);
  if (!match) return null;
  return `characters/${match[1]}/${match[2] ? 'transformations' : 'idle'}/${path.slice('characters/'.length)}`;
}

function replaceValue(value, paths, missing) {
  if (typeof value.stringValue === 'string') {
    const path = value.stringValue.trim();
    const newPath = destination(path);
    if (!newPath) {
      if (path !== value.stringValue && [...paths].some(source => destination(source) === path)) {
        return { stringValue: path };
      }
      return value;
    }
    if (!paths.has(path)) {
      missing.add(path);
      return value;
    }
    return { stringValue: newPath };
  }
  if (value.arrayValue?.values) {
    return { ...value, arrayValue: { ...value.arrayValue, values: value.arrayValue.values.map(v => replaceValue(v, paths, missing)) } };
  }
  if (value.mapValue?.fields) {
    return { ...value, mapValue: { ...value.mapValue, fields: replaceFields(value.mapValue.fields, paths, missing) } };
  }
  return value;
}

function replaceFields(fields, paths, missing) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, replaceValue(value, paths, missing)]));
}

function fieldPath(field) {
  return `\`${field.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``;
}

async function main({
  args = process.argv.slice(2),
  getToken = () => execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim(),
  fetchFn = fetch,
} = {}) {
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node scripts/migrate_character_animation_paths.js [--apply]');
  const apply = args.includes('--apply');
  let token;
  let tokenTime = 0;
  async function request(url, options = {}) {
    if (!token || Date.now() - tokenTime > 40 * 60 * 1000) {
      token = getToken();
      tokenTime = Date.now();
    }
    const response = await fetchFn(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(`Cloud API ${response.status}: ${data.error?.message || response.statusText}`);
    return data;
  }

  const storageUrl = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o`;
  const objects = new Map();
  let pageToken;
  do {
    const query = new URLSearchParams({ prefix: 'characters/', maxResults: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await request(`${storageUrl}?${query}`);
    for (const object of page.items || []) objects.set(object.name, object);
    pageToken = page.nextPageToken;
  } while (pageToken);

  const paths = new Set([...objects.keys()].filter(path => destination(path)));
  if (!paths.size) throw new Error('No matching source files found; refusing migration.');
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const results = await request(`${firestoreUrl}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'characters', allDescendants: true }] } }),
  });
  const docs = results.flatMap(result => result.document ? [result.document] : []).filter(doc => {
    const path = doc.name.split('/documents/')[1].split('/');
    return (path.length === 2 && path[0] === 'characters') ||
      (path.length === 4 && path[0] === 'users' && path[2] === 'characters');
  });
  const missing = new Set();
  const changes = docs.flatMap(doc => {
    const updated = replaceFields(doc.fields || {}, paths, missing);
    const fields = Object.keys(updated).filter(key => JSON.stringify(updated[key]) !== JSON.stringify(doc.fields[key]));
    return fields.length ? [{ doc, updated, fields }] : [];
  });
  let alreadyCopied = 0;
  for (const path of paths) {
    const old = objects.get(path);
    if (!old.md5Hash || !old.metadata?.firebaseStorageDownloadTokens) {
      throw new Error(`Source is missing MD5 or Firebase download token: ${path}`);
    }
    const existing = objects.get(destination(path));
    if (existing) {
      if (!existing.md5Hash || old.md5Hash !== existing.md5Hash || old.size !== existing.size ||
          old.contentType !== existing.contentType || !existing.metadata?.firebaseStorageDownloadTokens) {
        throw new Error(`Destination exists with different content: ${destination(path)}`);
      }
      alreadyCopied++;
    }
  }
  const baseCount = changes.filter(change => change.doc.name.split('/documents/')[1].startsWith('characters/')).length;
  console.log(`${apply ? 'Apply' : 'Dry run'}: ${paths.size} source files, ${alreadyCopied} already copied; ${baseCount} base and ${changes.length - baseCount} user documents need updates.`);
  console.log(`Missing referenced legacy files (left unchanged): ${missing.size}`);
  for (const path of [...missing].sort()) console.log(`  ${path}`);
  if (!apply) return;

  for (const path of paths) {
    if (objects.has(destination(path))) continue;
    const source = objects.get(path);
    const target = destination(path);
    const query = new URLSearchParams({ ifGenerationMatch: '0', ifSourceGenerationMatch: source.generation });
    let rewriteToken;
    do {
      if (rewriteToken) query.set('rewriteToken', rewriteToken);
      const result = await request(`${storageUrl}/${encodeURIComponent(path)}/rewriteTo/b/${BUCKET}/o/${encodeURIComponent(target)}?${query}`, { method: 'POST' });
      rewriteToken = result.rewriteToken;
      if (result.done) {
        if (result.resource.md5Hash !== source.md5Hash || result.resource.size !== source.size ||
            result.resource.contentType !== source.contentType || !result.resource.metadata?.firebaseStorageDownloadTokens) {
          throw new Error(`Copy verification failed: ${target}`);
        }
        objects.set(target, result.resource);
        break;
      }
      if (!rewriteToken) throw new Error(`Copy did not complete: ${target}`);
    } while (true);
  }
  for (const path of paths) {
    const target = destination(path);
    const downloadToken = objects.get(target).metadata.firebaseStorageDownloadTokens.split(',')[0];
    const query = new URLSearchParams({ alt: 'media', token: downloadToken });
    const response = await fetchFn(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(target)}?${query}`, { method: 'HEAD' });
    if (!response.ok) throw new Error(`Firebase download URL verification failed (${response.status}): ${target}`);
  }
  console.log('All copied files and Firebase download URLs verified. Updating Firestore pointers...');
  for (const { doc, updated, fields } of changes) {
    const query = new URLSearchParams({ 'currentDocument.updateTime': doc.updateTime });
    for (const field of fields) query.append('updateMask.fieldPaths', fieldPath(field));
    const patch = Object.fromEntries(fields.map(field => [field, updated[field]]));
    await request(`https://firestore.googleapis.com/v1/${doc.name}?${query}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: patch }),
    });
  }
  console.log(`Updated ${changes.length} documents. Original files were retained.`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { destination, replaceFields, fieldPath, main };

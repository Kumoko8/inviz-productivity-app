'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { destination, replaceFields, fieldPath, main } = require('./migrate_character_animation_paths');

test('maps only exact legacy paths for the six base characters', () => {
  assert.equal(destination('characters/maguro_3.mp4'), 'characters/maguro/idle/maguro_3.mp4');
  assert.equal(destination('characters/maguro_transform_temp_2.mp4'), 'characters/maguro/transformations/maguro_transform_temp_2.mp4');
  for (const path of ['characters/other_1.mp4', 'characters/maguro/action/maguro_action_1.mp4', 'characters/maguro_1.mp4.bak', 'characters/maguro/idle/maguro_1.mp4']) {
    assert.equal(destination(path), null);
  }
});

test('replaces only verified paths, preserving Firestore values and missing assets', () => {
  const fields = {
    animation: { stringValue: 'characters/maguro_1.mp4' },
    forms: { arrayValue: { values: [
      { stringValue: 'characters/maguro_2.mp4' },
      { stringValue: 'characters/maguro_3.mp4' },
      { integerValue: '9' },
    ] } },
    nested: { mapValue: { fields: { temp: { stringValue: 'characters/maguro_transform_temp_1.mp4' }, stamp: { timestampValue: '2025-01-01T00:00:00Z' } } } },
  };
  const copy = structuredClone(fields);
  const missing = new Set();
  const result = replaceFields(fields, new Set(['characters/maguro_1.mp4', 'characters/maguro_2.mp4', 'characters/maguro_transform_temp_1.mp4']), missing);
  assert.equal(result.animation.stringValue, 'characters/maguro/idle/maguro_1.mp4');
  assert.equal(result.forms.arrayValue.values[0].stringValue, 'characters/maguro/idle/maguro_2.mp4');
  assert.equal(result.forms.arrayValue.values[1].stringValue, 'characters/maguro_3.mp4');
  assert.deepEqual(result.nested.mapValue.fields.stamp, fields.nested.mapValue.fields.stamp);
  assert.deepEqual([...missing], ['characters/maguro_3.mp4']);
  assert.deepEqual(fields, copy);
  assert.deepEqual(replaceFields(result, new Set(), new Set()), result);
});

test('quotes field paths so dots and special characters remain literal', () => {
  assert.equal(fieldPath('a.b`c\\d'), '`a.b\\`c\\\\d`');
});

test('migrates whitespace-padded legacy paths and normalizes verified destination paths', () => {
  const paths = new Set(['characters/maguro_1.mp4']);
  const missing = new Set();
  const fields = {
    legacy: { stringValue: 'characters/maguro_1.mp4\n' },
    migrated: { stringValue: ' characters/maguro/idle/maguro_1.mp4 ' },
    missing: { stringValue: 'characters/maguro_7.mp4\n' },
    unrelated: { stringValue: '  some other text  ' },
  };
  const result = replaceFields(fields, paths, missing);
  assert.equal(result.legacy.stringValue, 'characters/maguro/idle/maguro_1.mp4');
  assert.equal(result.migrated.stringValue, 'characters/maguro/idle/maguro_1.mp4');
  assert.equal(result.missing.stringValue, fields.missing.stringValue);
  assert.equal(result.unrelated.stringValue, fields.unrelated.stringValue);
  assert.deepEqual([...missing], ['characters/maguro_7.mp4']);
  assert.deepEqual(replaceFields(result, paths, new Set()), result);
});

function fakeCloud({ failDownload = false } = {}) {
  const source = {
    name: 'characters/maguro_1.mp4',
    generation: '123',
    size: '5',
    md5Hash: 'checksum',
    contentType: 'video/mp4',
    metadata: { firebaseStorageDownloadTokens: 'test-token' },
  };
  const docs = [
    { name: 'projects/inviz-ae0c0/databases/(default)/documents/characters/base', updateTime: '2025-01-01T00:00:00Z', fields: { 'animation.path': { stringValue: source.name }, other: { integerValue: '2' } } },
    { name: 'projects/inviz-ae0c0/databases/(default)/documents/groups/x/characters/ignored', updateTime: '2025-01-01T00:00:00Z', fields: { animation: { stringValue: source.name } } },
  ];
  const objects = [source];
  const writes = [];
  const fetchFn = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'firebasestorage.googleapis.com') {
      return { ok: !failDownload, status: failDownload ? 403 : 200 };
    }
    let data;
    if (url.pathname.endsWith(':runQuery')) {
      data = docs.map(document => ({ document }));
    } else if (options.method === 'PATCH') {
      writes.push({ url, body: JSON.parse(options.body) });
      assert.equal(url.searchParams.get('currentDocument.updateTime'), docs[0].updateTime);
      assert.deepEqual(url.searchParams.getAll('updateMask.fieldPaths'), ['`animation.path`']);
      docs[0].fields = { ...docs[0].fields, ...JSON.parse(options.body).fields };
      data = docs[0];
    } else if (url.pathname.includes('/rewriteTo/')) {
      assert.equal(url.searchParams.get('ifGenerationMatch'), '0');
      assert.equal(url.searchParams.get('ifSourceGenerationMatch'), source.generation);
      objects.push({ ...source, name: destination(source.name) });
      data = { done: true, resource: objects[objects.length - 1] };
    } else {
      data = { items: objects };
    }
    return { ok: true, json: async () => data };
  };
  return { fetchFn, docs, objects, writes };
}

test('apply copies and verifies before selectively updating documents; reruns are idempotent', async () => {
  const cloud = fakeCloud();
  const options = { args: ['--apply'], getToken: () => 'test', fetchFn: cloud.fetchFn };
  await main(options);
  assert.equal(cloud.objects.length, 2);
  assert.equal(cloud.writes.length, 1);
  assert.equal(cloud.docs[0].fields['animation.path'].stringValue, 'characters/maguro/idle/maguro_1.mp4');
  assert.equal(cloud.docs[0].fields.other.integerValue, '2');
  await main(options);
  assert.equal(cloud.objects.length, 2);
  assert.equal(cloud.writes.length, 1);
});

test('download verification failure prevents Firestore writes', async () => {
  const cloud = fakeCloud({ failDownload: true });
  await assert.rejects(main({ args: ['--apply'], getToken: () => 'test', fetchFn: cloud.fetchFn }), /download URL verification failed/);
  assert.equal(cloud.writes.length, 0);
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

function config(overrides, expression = 'appOrigin()') {
  const env = { ...process.env, NODE_ENV: 'production', ...overrides };
  for (const key of ['APP_URL', 'URL', 'NETLIFY', 'SITE_ID', 'AUTH_STORAGE']) {
    if (!Object.hasOwn(overrides, key)) delete env[key];
  }
  const source = `import { appOrigin, localStorageEnabled, sessionCookieName } from './lib/server/config.ts';
try { console.log(JSON.stringify({ value: ${expression} })); }
catch (error) { console.log(JSON.stringify({ error: error.message })); }`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--experimental-strip-types', '--input-type=module', '-e', source], { env, encoding: 'utf8', cwd: new URL('..', import.meta.url) }));
}

test('Netlify runtime uses URL when the NETLIFY build flag and APP_URL are absent', () => {
  assert.deepEqual(config({ URL: 'https://invoice-fixture.netlify.app' }), { value: 'https://invoice-fixture.netlify.app' });
  assert.deepEqual(config({ URL: 'https://invoice-fixture.netlify.app' }, 'sessionCookieName()'), { value: '__Host-dream-session' });
});

test('explicit APP_URL wins; blank overrides retain the platform URL', () => {
  assert.deepEqual(config({ APP_URL: ' https://invoices.example.com/ ', URL: 'https://invoice-fixture.netlify.app' }), { value: 'https://invoices.example.com' });
  assert.deepEqual(config({ APP_URL: '   ', URL: 'https://invoice-fixture.netlify.app' }), { value: 'https://invoice-fixture.netlify.app' });
});

test('production configuration stays closed to missing or unsafe origins', () => {
  assert.ok(config({}).error);
  assert.ok(config({ URL: 'http://invoices.example.com' }).error);
  assert.ok(config({ APP_URL: 'https://user:secret@invoices.example.com' }).error);
  assert.ok(config({ APP_URL: 'invalid', URL: 'https://invoice-fixture.netlify.app' }).error);
});

test('Netlify runtime cannot enable local storage even with a loopback override', () => {
  assert.ok(config({ APP_URL: 'http://localhost:3000', AUTH_STORAGE: 'local', SITE_ID: 'netlify-runtime-fixture' }, 'localStorageEnabled()').error);
  assert.deepEqual(config({ APP_URL: 'http://localhost:3000', AUTH_STORAGE: 'local' }, 'localStorageEnabled()'), { value: true });
});

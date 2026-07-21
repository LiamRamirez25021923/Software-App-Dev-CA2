const test = require('node:test');
const assert = require('node:assert/strict');

// These tests only inspect the exported database API. They do not require
// the remote Azure database to be reachable during the test run.
test('database config exposes promise-based query and execute methods', () => {
  const db = require('../config/db');
  assert.equal(typeof db.query, 'function');
  assert.equal(typeof db.execute, 'function');
  assert.ok(db.connection);
});

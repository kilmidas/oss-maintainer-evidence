import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEndpoint, ENDPOINTS } from '../src/github/endpoints.js';

test('builds fixed GitHub API endpoint and rejects traversal', () => {
  assert.equal(buildEndpoint(ENDPOINTS.repository, { owner: 'octo', repo: 'hello' }).path, '/repos/octo/hello');
  assert.throws(() => buildEndpoint(ENDPOINTS.repository, { owner: '../x', repo: 'hello' }));
  assert.throws(() => buildEndpoint(ENDPOINTS.searchIssues, { q: 'a', page: 1 }, { host: 'evil.test' } as never));
});

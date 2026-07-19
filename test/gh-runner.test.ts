import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runGhApi, GhApiError } from '../src/process/gh-runner.js';

test('uses fixed safe gh command boundary', async () => {
  let seen: any;
  const spawn = ((...args: any[]) => { seen = args; const e: any = new EventEmitter(); e.stdout = new EventEmitter(); e.stderr = new EventEmitter(); queueMicrotask(() => { e.stdout.emit('data', Buffer.from('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"ok":true}')); e.emit('close', 0); }); return e; }) as any;
  const result = await runGhApi('/repos/octo/hello', { spawn });
  assert.deepEqual(result.body, { ok: true });
  assert.equal(seen[2].shell, false);
  assert.deepEqual(seen[1], ['api','--hostname','github.com','--method','GET','--include','-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2026-03-10','/repos/octo/hello']);
});

test('maps malformed response safely', async () => {
  const spawn = ((...args: any[]) => { const e: any = new EventEmitter(); e.stdout = new EventEmitter(); e.stderr = new EventEmitter(); queueMicrotask(() => { e.stdout.emit('data', Buffer.from('not headers')); e.emit('close', 0); }); return e; }) as any;
  await assert.rejects(runGhApi('/repos/octo/hello', { spawn }), (e: unknown) => e instanceof GhApiError && e.category === 'protocol');
});

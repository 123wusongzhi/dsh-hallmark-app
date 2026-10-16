/** Loaded before the unmodified packed entry. Reject every non-builtin module
 * that resolves outside this run's extracted archive / copied harness. */
import assert from 'node:assert/strict';
import {isBuiltin, registerHooks} from 'node:module';
import {existsSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = realpathSync(process.env.PACKAGING_RUN_ROOT);
const inside = path => path === root || path.startsWith(root + sep);
assert.equal(process.env.NODE_PATH, undefined);
assert.equal(process.env.NODE_OPTIONS, undefined);
assert.ok(inside(realpathSync(process.cwd())), 'isolated cwd');
assert.ok(inside(realpathSync(process.env.HOME)), 'isolated HOME');
for (let path = root;; path = dirname(path)) {
  assert.ok(!existsSync(resolve(path, 'node_modules')), `ancestor node_modules: ${path}`);
  if (path === dirname(path)) break;
}
const modules = new Set();
const auditMode = process.env.PACKAGING_AUDIT_MODE ?? 'strict-module-resolution';
assert.ok(['strict-module-resolution', 'timing-no-resolver-hook'].includes(auditMode));
if (auditMode === 'strict-module-resolution') registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (!isBuiltin(result.url)) {
      assert.ok(result.url.startsWith('file:'), `unexpected module URL: ${result.url}`);
      const path = realpathSync(fileURLToPath(result.url));
      assert.ok(inside(path), `module escaped isolated run: ${path}`);
      modules.add(path.slice(root.length + 1));
    }
    return result;
  },
});
// The fixture uses no outbound network. The CLI benchmark communicates only
// through its local HTTP server, not through fetch from within the Runtime.
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('EXTERNAL_NETWORK_FORBIDDEN'); };
process.on('exit', () => {
  writeFileSync(process.env.PACKAGING_RESOURCE_FILE, JSON.stringify({
    node: process.version, cpuMicros: process.cpuUsage(),
    memory: process.memoryUsage(), maxRSSKiB: process.resourceUsage().maxRSS,
    loadedModules: [...modules].sort(), networkAttempts,
    auditMode, moduleResolutionGuard: auditMode === 'strict-module-resolution',
    isolated: true, nodePathUnset: true, nodeOptionsUnset: true,
  }, null, 2) + '\n');
});

import { PresentationError, safeJSON, validateViewSpec } from './validation.ts';
import type { Patch, ViewSpec } from './types.ts';
const clone = <T>(value: T): T => structuredClone(value);
function tokens(path: string): string[] {
  if (typeof path !== 'string' || (path !== '' && !path.startsWith('/'))) throw new PresentationError('INVALID_PATCH', 'Expected a JSON Pointer');
  if (path === '') return [];
  return path.slice(1).split('/').map(part => {
    if (/~(?:[^01]|$)/.test(part)) throw new PresentationError('INVALID_PATCH', 'Invalid JSON Pointer escape');
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (['__proto__','constructor','prototype'].includes(key)) throw new PresentationError('UNSAFE_PATCH', 'Unsafe JSON Pointer');
    return key;
  });
}
function index(array: any[], key: string, add: boolean): number {
  if (key === '-' && add) return array.length;
  if (!/^(0|[1-9]\d*)$/.test(key)) throw new PresentationError('INVALID_PATCH', 'Invalid array index');
  const n = Number(key);
  if (n >= array.length + (add ? 1 : 0)) throw new PresentationError('INVALID_PATCH', 'Array index out of bounds');
  return n;
}
function locate(root: any, parts: string[]): { parent: any; key: string } {
  if (!parts.length) throw new PresentationError('INVALID_PATCH', 'Root replacement is not supported');
  let parent = root;
  for (const key of parts.slice(0, -1)) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key)) throw new PresentationError('INVALID_PATCH', 'Path does not exist');
    parent = parent[Array.isArray(parent) ? index(parent, key, false) : key];
  }
  if (!parent || typeof parent !== 'object') throw new PresentationError('INVALID_PATCH', 'Path parent is not an object');
  return { parent, key: parts.at(-1)! };
}
function get(root: any, path: string): any {
  const parts = tokens(path); if (!parts.length) return root;
  const {parent,key} = locate(root,parts);
  if (Array.isArray(parent)) return parent[index(parent,key,false)];
  if (!Object.hasOwn(parent,key)) throw new PresentationError('INVALID_PATCH', 'Path does not exist');
  return parent[key];
}
function change(root: any, path: string, op: 'add'|'replace'|'remove', value?: any): void {
  const {parent,key} = locate(root,tokens(path));
  if (Array.isArray(parent)) { const n = index(parent,key,op === 'add'); if (op === 'add') parent.splice(n,0,clone(value)); else if (op === 'remove') parent.splice(n,1); else parent[n] = clone(value); }
  else { if (op !== 'add' && !Object.hasOwn(parent,key)) throw new PresentationError('INVALID_PATCH', 'Path does not exist'); if (op === 'remove') delete parent[key]; else parent[key] = clone(value); }
}
function equal(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b,k) && equal(a[k],b[k]));
}
export function applyPatch(spec: ViewSpec, patch: Patch[], validator: (value:ViewSpec)=>void = validateViewSpec): ViewSpec {
  safeJSON(patch);
  if (!Array.isArray(patch) || !patch.length || patch.length > 100) throw new PresentationError('INVALID_PATCH', 'Patch requires 1–100 operations');
  const draft = clone(spec);
  for (const item of patch) {
    tokens(item.path);
    if (['add','replace'].includes(item.op) && !Object.hasOwn(item,'value')) throw new PresentationError('INVALID_PATCH', 'Patch value is required');
    if (item.op === 'add' || item.op === 'replace' || item.op === 'remove') change(draft,item.path,item.op,item.value);
    else if (item.op === 'test') { if (!equal(get(draft,item.path),item.value)) throw new PresentationError('PATCH_TEST_FAILED', 'JSON Patch test failed'); }
    else if (item.op === 'copy' || item.op === 'move') {
      if (typeof item.from !== 'string') throw new PresentationError('INVALID_PATCH', 'from is required');
      tokens(item.from);
      if (item.op === 'move' && item.path.startsWith(item.from + '/')) throw new PresentationError('INVALID_PATCH', 'Cannot move into own descendant');
      const value = clone(get(draft,item.from));
      if (item.op === 'move') change(draft,item.from,'remove');
      change(draft,item.path,'add',value);
    } else throw new PresentationError('INVALID_PATCH', 'Unsupported patch operation');
  }
  if (draft.id !== spec.id) throw new PresentationError('INVALID_PATCH', 'View id is immutable');
  validator(draft);
  return draft;
}

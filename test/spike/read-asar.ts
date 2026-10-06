// Read-only ASAR evidence extractor. Never writes to the source archive/profile.
import { openSync, readSync, closeSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
const archive = process.argv[2];
if (!archive) throw new Error('archive argument required');
const fd = openSync(archive, 'r');
const prefix = Buffer.alloc(16); readSync(fd, prefix, 0, 16, 0);
const headerLength = prefix.readUInt32LE(12);
const headerBuffer = Buffer.alloc(headerLength); readSync(fd, headerBuffer, 0, headerLength, 16);
const header = JSON.parse(headerBuffer.toString('utf8'));
const base = 8 + prefix.readUInt32LE(4);
const entries: {path: string; node: any}[] = [];
function walk(node: any, path = '') { for (const [name, item] of Object.entries(node.files ?? {}) as any) { const next = path ? `${path}/${name}` : name; if (item.files) walk(item, next); else entries.push({path:next,node:item}); } }
walk(header);
const pattern = new RegExp(process.argv[3] ?? 'dsh.*(package.json|index.d.ts)$');
const selected = entries.filter(entry => pattern.test(entry.path));
for (const entry of selected) {
  console.log(entry.path, entry.node.link ? `-> ${entry.node.link}` : `${entry.node.size} bytes`);
  if (!process.argv[4] || entry.node.link) continue;
  const root = resolve(process.argv[4]); const destination = resolve(root, entry.path);
  if (!destination.startsWith(root + sep)) throw new Error('invalid archive path');
  let bytes: Buffer;
  if (entry.node.unpacked) bytes = readFileSync(`${archive}.unpacked/${entry.path}`);
  else { bytes = Buffer.alloc(entry.node.size); readSync(fd, bytes, 0, entry.node.size, base + Number(entry.node.offset)); }
  mkdirSync(dirname(destination), {recursive:true}); writeFileSync(destination, bytes);
}
closeSync(fd);
